from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.deliveries.models import DeliveryStatus
from apps.fleet.models import DriverProfile, Vehicle, VehicleStatus
from apps.orders.models import Order, OrderStatus

from .models import RoutePlan, RouteRun, RouteRunStatus, RouteStop, RouteStopStatus
from .providers.ors import build_matrix as ors_build_matrix
from .services import routing_provider, service_minutes_per_stop


START_OF_DAY = time(0, 0)
END_OF_DAY = time(23, 59)


@dataclass
class Demand:
    kg: Decimal
    m3: Decimal


@dataclass
class CandidateStop:
    order: Order
    demand: Demand
    window_start_at: datetime
    window_end_at: datetime
    latitude: float
    longitude: float
    matrix_index: int


@dataclass
class RouteEval:
    feasible: bool
    total_distance_km: Decimal = Decimal("0")
    total_duration_min: Decimal = Decimal("0")
    stop_etas: list[datetime] = field(default_factory=list)
    leg_distance_km: list[Decimal] = field(default_factory=list)
    leg_duration_min: list[Decimal] = field(default_factory=list)


@dataclass
class RouteState:
    driver: DriverProfile
    vehicle: Vehicle | None = None
    stops: list[CandidateStop] = field(default_factory=list)
    load_kg: Decimal = Decimal("0")
    load_m3: Decimal = Decimal("0")
    total_distance_km: Decimal = Decimal("0")
    total_duration_min: Decimal = Decimal("0")
    stop_etas: list[datetime] = field(default_factory=list)
    leg_distance_km: list[Decimal] = field(default_factory=list)
    leg_duration_min: list[Decimal] = field(default_factory=list)

    def __post_init__(self):
        self.vehicle = self.driver.assigned_vehicle


def generate_route_plan(*, distributor, dispatch_date, generated_by=None, order_ids=None, driver_ids=None, vehicle_ids=None):
    orders = list(_eligible_orders(distributor, dispatch_date, order_ids))
    if not orders:
        raise ValidationError("No hay pedidos para la fecha seleccionada.")
    drivers = list(_eligible_drivers(distributor, driver_ids, vehicle_ids))
    if not drivers:
        raise ValidationError("No hay choferes con vehiculo asignado y capacidad disponible para generar rutas.")
    if distributor.latitude is None or distributor.longitude is None:
        raise ValidationError("La distribuidora necesita coordenadas para generar rutas.")

    candidate_stops, unassigned = _build_candidates(orders, dispatch_date)
    matrix = (
        _build_matrix(
            origin=(float(distributor.latitude), float(distributor.longitude)),
            destinations=[(candidate.latitude, candidate.longitude) for candidate in candidate_stops],
        )
        if candidate_stops
        else {"durations_min": [[0]], "distances_km": [[0]]}
    )
    routes = [RouteState(driver=driver) for driver in drivers]

    for candidate in sorted(candidate_stops, key=lambda item: (item.window_end_at, item.order.id)):
        choice, reason = _best_insertion(routes, candidate, matrix, dispatch_date)
        if not choice:
            unassigned.append({"order_id": candidate.order.id, "reason": reason})
            continue
        route, index, evaluation = choice
        route.stops.insert(index, candidate)
        route.load_kg += candidate.demand.kg
        route.load_m3 += candidate.demand.m3
        _apply_route_evaluation(route, evaluation)

    return _persist_route_plan(
        distributor=distributor,
        dispatch_date=dispatch_date,
        generated_by=generated_by,
        routes=routes,
        unassigned=unassigned,
    )


@transaction.atomic
def edit_route_plan(*, route_plan, runs_payload):
    distributor = route_plan.distributor
    if distributor.latitude is None or distributor.longitude is None:
        raise ValidationError("La distribuidora necesita coordenadas para editar rutas.")

    existing_runs = {
        run.id: run
        for run in route_plan.runs.select_related("driver", "vehicle").prefetch_related("stops__order").all()
    }
    if not existing_runs:
        raise ValidationError("No hay recorridos cargados para editar.")

    run_ids = [item["id"] for item in runs_payload]
    if len(run_ids) != len(set(run_ids)):
        raise ValidationError("No puedes repetir recorridos en la edicion.")
    if set(run_ids) != set(existing_runs.keys()):
        raise ValidationError("Debes enviar todos los recorridos actuales para editar el plan.")

    all_stops = {
        stop.id: stop
        for stop in RouteStop.objects.select_related("order").filter(route_run__route_plan=route_plan)
    }
    submitted_stop_ids = [stop_id for item in runs_payload for stop_id in item["stop_ids"]]
    if len(submitted_stop_ids) != len(set(submitted_stop_ids)):
        raise ValidationError("No puedes repetir pedidos dentro de la edicion de la ruta.")
    if set(submitted_stop_ids) != set(all_stops.keys()):
        raise ValidationError("Debes redistribuir todas las paradas actuales del plan.")

    candidates = []
    candidate_by_stop_id = {}
    for stop in all_stops.values():
        order = stop.order
        if order.delivery_latitude is None or order.delivery_longitude is None:
            raise ValidationError(f"El pedido #{order.id} ya no tiene coordenadas validas.")
        candidate = CandidateStop(
            order=order,
            demand=Demand(kg=Decimal(str(stop.demand_kg)), m3=Decimal(str(stop.demand_m3))),
            window_start_at=stop.window_start_at,
            window_end_at=stop.window_end_at,
            latitude=float(order.delivery_latitude),
            longitude=float(order.delivery_longitude),
            matrix_index=len(candidates) + 1,
        )
        candidates.append(candidate)
        candidate_by_stop_id[stop.id] = candidate

    matrix = _build_matrix(
        origin=(float(distributor.latitude), float(distributor.longitude)),
        destinations=[(candidate.latitude, candidate.longitude) for candidate in candidates],
    )

    run_states = {}
    for item in runs_payload:
        run = existing_runs[item["id"]]
        route_state = RouteState(driver=run.driver)
        route_state.vehicle = run.vehicle
        route_state.stops = [candidate_by_stop_id[stop_id] for stop_id in item["stop_ids"]]
        route_state.load_kg = sum((candidate.demand.kg for candidate in route_state.stops), start=Decimal("0"))
        route_state.load_m3 = sum((candidate.demand.m3 for candidate in route_state.stops), start=Decimal("0"))
        capacity_kg = Decimal(str(route_state.vehicle.capacity_kg or 0)) if route_state.vehicle else Decimal("0")
        capacity_m3 = Decimal(str(route_state.vehicle.capacity_m3 or 0)) if route_state.vehicle else Decimal("0")
        if capacity_kg and route_state.load_kg > capacity_kg:
            raise ValidationError(f"El recorrido de {run.driver.user.full_name} supera la capacidad en kg.")
        if capacity_m3 and route_state.load_m3 > capacity_m3:
            raise ValidationError(f"El recorrido de {run.driver.user.full_name} supera la capacidad en m3.")
        evaluation = _evaluate_route(route_state.stops, matrix, route_plan.dispatch_date)
        if not evaluation.feasible:
            raise ValidationError("La edicion propuesta no respeta las ventanas horarias vigentes.")
        _apply_route_evaluation(route_state, evaluation)
        run_states[run.id] = route_state

    next_sequence = 1
    active_runs = []
    for temp_index, stop in enumerate(all_stops.values(), start=1):
        stop.sequence = len(all_stops) + temp_index
        stop.save(update_fields=["sequence", "updated_at"])

    for item in runs_payload:
        run = existing_runs[item["id"]]
        route_state = run_states[run.id]
        if not route_state.stops:
            continue
        run.sequence = next_sequence
        run.total_stops = len(route_state.stops)
        run.total_distance_km = route_state.total_distance_km
        run.total_duration_min = route_state.total_duration_min
        run.load_kg = route_state.load_kg
        run.load_m3 = route_state.load_m3
        run.save(
            update_fields=[
                "sequence",
                "total_stops",
                "total_distance_km",
                "total_duration_min",
                "load_kg",
                "load_m3",
                "updated_at",
            ]
        )
        next_sequence += 1
        active_runs.append(run)
        for stop_index, stop_id in enumerate(item["stop_ids"], start=1):
            stop = all_stops[stop_id]
            stop.route_run = run
            stop.sequence = stop_index
            stop.planned_eta = route_state.stop_etas[stop_index - 1]
            stop.leg_distance_km = route_state.leg_distance_km[stop_index - 1]
            stop.leg_duration_min = route_state.leg_duration_min[stop_index - 1]
            stop.save(
                update_fields=[
                    "route_run",
                    "sequence",
                    "planned_eta",
                    "leg_distance_km",
                    "leg_duration_min",
                    "updated_at",
                ]
            )

    for run in existing_runs.values():
        if run not in active_runs:
            run.delete()

    route_plan.total_runs = len(active_runs)
    route_plan.total_orders = len(all_stops)
    route_plan.total_distance_km = sum((state.total_distance_km for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_duration_min = sum((state.total_duration_min for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_load_kg = sum((state.load_kg for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_load_m3 = sum((state.load_m3 for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.save(
        update_fields=[
            "total_runs",
            "total_orders",
            "total_distance_km",
            "total_duration_min",
            "total_load_kg",
            "total_load_m3",
            "updated_at",
        ]
    )
    route_plan.refresh_from_db()
    return route_plan


def _eligible_orders(distributor, dispatch_date, order_ids):
    queryset = (
        Order.objects.select_related("commerce", "distributor")
        .prefetch_related("items")
        .filter(
            distributor=distributor,
            dispatch_date=dispatch_date,
            status__in=[OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.SCHEDULED],
        )
        .exclude(delivery__status=DeliveryStatus.DELIVERED)
        .order_by("id")
    )
    if order_ids:
        queryset = queryset.filter(id__in=order_ids)
    return queryset


def _eligible_drivers(distributor, driver_ids, vehicle_ids):
    queryset = (
        DriverProfile.objects.select_related("assigned_vehicle", "user")
        .filter(distributor=distributor, active=True, available=True, assigned_vehicle__isnull=False)
        .exclude(assigned_vehicle__active=False)
        .exclude(assigned_vehicle__status=VehicleStatus.MAINTENANCE)
        .exclude(assigned_vehicle__status=VehicleStatus.INACTIVE)
    )
    if driver_ids:
        queryset = queryset.filter(id__in=driver_ids)
    if vehicle_ids:
        queryset = queryset.filter(assigned_vehicle_id__in=vehicle_ids)
    return queryset.order_by("user__full_name", "id")


def _build_candidates(orders, dispatch_date):
    candidates = []
    unassigned = []
    for order in orders:
        if order.delivery_latitude is None or order.delivery_longitude is None:
            unassigned.append({"order_id": order.id, "reason": "missing_coords"})
            continue
        demand = Demand(
            kg=sum((item.weight_kg for item in order.items.all()), start=Decimal("0")),
            m3=sum((item.volume_m3 for item in order.items.all()), start=Decimal("0")),
        )
        window_start = order.delivery_window_start or getattr(order.commerce, "default_window_start", None) or START_OF_DAY
        window_end = order.delivery_window_end or getattr(order.commerce, "default_window_end", None) or END_OF_DAY
        if window_start > window_end:
            unassigned.append({"order_id": order.id, "reason": "window_infeasible"})
            continue
        candidates.append(
            CandidateStop(
                order=order,
                demand=demand,
                window_start_at=timezone.make_aware(datetime.combine(dispatch_date, window_start)),
                window_end_at=timezone.make_aware(datetime.combine(dispatch_date, window_end)),
                latitude=float(order.delivery_latitude),
                longitude=float(order.delivery_longitude),
                matrix_index=len(candidates) + 1,
            )
        )
    return candidates, unassigned


def _build_matrix(origin, destinations):
    provider = routing_provider()
    if provider != "ors":
        raise ValidationError(f"Proveedor de ruteo no soportado: {provider}")
    try:
        return ors_build_matrix(origin, destinations)
    except ImproperlyConfigured as exc:
        raise ValidationError("Falta configurar OPENROUTESERVICE_API_KEY para generar rutas.") from exc
    except RuntimeError as exc:
        raise ValidationError(str(exc)) from exc


def _best_insertion(routes, candidate, matrix, dispatch_date):
    best = None
    capacity_fit = False
    for route in routes:
        if not route.vehicle:
            continue
        capacity_kg = Decimal(str(route.vehicle.capacity_kg or 0))
        capacity_m3 = Decimal(str(route.vehicle.capacity_m3 or 0))
        if capacity_kg and route.load_kg + candidate.demand.kg > capacity_kg:
            continue
        if capacity_m3 and route.load_m3 + candidate.demand.m3 > capacity_m3:
            continue
        capacity_fit = True
        for index in range(len(route.stops) + 1):
            proposed = route.stops[:index] + [candidate] + route.stops[index:]
            evaluation = _evaluate_route(proposed, matrix, dispatch_date)
            if not evaluation.feasible:
                continue
            incremental = evaluation.total_distance_km - route.total_distance_km
            if best is None or incremental < best[3]:
                best = (route, index, evaluation, incremental)
    if best is None:
        return None, "capacity_exceeded" if not capacity_fit else "window_infeasible"
    route, index, evaluation, _ = best
    return (route, index, evaluation), None


def _evaluate_route(stops, matrix, dispatch_date):
    current_at = timezone.make_aware(datetime.combine(dispatch_date, START_OF_DAY))
    previous_index = 0
    total_distance = Decimal("0")
    total_duration = Decimal("0")
    stop_etas = []
    leg_distance = []
    leg_duration = []
    for stop in stops:
        travel_min = Decimal(str(matrix["durations_min"][previous_index][stop.matrix_index]))
        travel_distance = Decimal(str(matrix["distances_km"][previous_index][stop.matrix_index]))
        arrival_at = current_at + timedelta(minutes=float(travel_min))
        service_start = max(arrival_at, stop.window_start_at)
        if service_start > stop.window_end_at:
            return RouteEval(feasible=False)
        total_distance += travel_distance
        total_duration += travel_min + Decimal(str((service_start - arrival_at).total_seconds() / 60))
        stop_etas.append(service_start)
        leg_distance.append(travel_distance)
        leg_duration.append(travel_min)
        current_at = service_start + timedelta(minutes=service_minutes_per_stop())
        previous_index = stop.matrix_index

    if stops:
        return_min = Decimal(str(matrix["durations_min"][previous_index][0]))
        return_distance = Decimal(str(matrix["distances_km"][previous_index][0]))
        total_distance += return_distance
        total_duration += return_min
    return RouteEval(
        feasible=True,
        total_distance_km=total_distance.quantize(Decimal("0.001")),
        total_duration_min=total_duration.quantize(Decimal("0.01")),
        stop_etas=stop_etas,
        leg_distance_km=leg_distance,
        leg_duration_min=leg_duration,
    )


def _apply_route_evaluation(route, evaluation):
    route.total_distance_km = evaluation.total_distance_km
    route.total_duration_min = evaluation.total_duration_min
    route.stop_etas = evaluation.stop_etas
    route.leg_distance_km = evaluation.leg_distance_km
    route.leg_duration_min = evaluation.leg_duration_min


@transaction.atomic
def _persist_route_plan(*, distributor, dispatch_date, generated_by, routes, unassigned):
    active_routes = [route for route in routes if route.stops]
    route_plan = RoutePlan.objects.create(
        distributor=distributor,
        dispatch_date=dispatch_date,
        generated_by=generated_by,
        provider=routing_provider(),
        total_runs=len(active_routes),
        total_orders=sum(len(route.stops) for route in active_routes),
        total_distance_km=sum((route.total_distance_km for route in active_routes), start=Decimal("0")),
        total_duration_min=sum((route.total_duration_min for route in active_routes), start=Decimal("0")),
        total_load_kg=sum((route.load_kg for route in active_routes), start=Decimal("0")),
        total_load_m3=sum((route.load_m3 for route in active_routes), start=Decimal("0")),
        unassigned_summary=unassigned,
    )
    for route_index, route in enumerate(active_routes, start=1):
        run = RouteRun.objects.create(
            route_plan=route_plan,
            driver=route.driver,
            vehicle=route.vehicle,
            sequence=route_index,
            status=RouteRunStatus.CONFIRMED,
            total_stops=len(route.stops),
            total_distance_km=route.total_distance_km,
            total_duration_min=route.total_duration_min,
            load_kg=route.load_kg,
            load_m3=route.load_m3,
        )
        for stop_index, stop in enumerate(route.stops, start=1):
            RouteStop.objects.create(
                route_run=run,
                order=stop.order,
                sequence=stop_index,
                status=RouteStopStatus.PENDING,
                planned_eta=route.stop_etas[stop_index - 1],
                window_start_at=stop.window_start_at,
                window_end_at=stop.window_end_at,
                leg_distance_km=route.leg_distance_km[stop_index - 1],
                leg_duration_min=route.leg_duration_min[stop_index - 1],
                demand_kg=stop.demand.kg,
                demand_m3=stop.demand.m3,
            )
    return route_plan

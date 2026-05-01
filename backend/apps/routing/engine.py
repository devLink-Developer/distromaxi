from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.deliveries.models import DeliveryStatus
from apps.fleet.models import DriverProfile, Vehicle, VehicleStatus
from apps.orders.models import Order, OrderStatus

from .models import (
    RouteAuditEvent,
    RouteOptimizationRun,
    RoutePlan,
    RoutePlanStatus,
    RouteRun,
    RouteRunStatus,
    RouteStop,
    RouteStopLine,
    RouteStopStatus,
)
from .providers.ors import build_directions as ors_build_directions
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
    address_snapshot: dict
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
    driver: DriverProfile | None = None
    vehicle: Vehicle | None = None
    stops: list[CandidateStop] = field(default_factory=list)
    load_kg: Decimal = Decimal("0")
    load_m3: Decimal = Decimal("0")
    total_distance_km: Decimal = Decimal("0")
    total_duration_min: Decimal = Decimal("0")
    stop_etas: list[datetime] = field(default_factory=list)
    leg_distance_km: list[Decimal] = field(default_factory=list)
    leg_duration_min: list[Decimal] = field(default_factory=list)
    route_geometry: dict | None = None
    origin_snapshot: dict = field(default_factory=dict)

    def __post_init__(self):
        if self.vehicle is None and self.driver is not None:
            self.vehicle = self.driver.assigned_vehicle


def generate_route_plan(*, distributor, dispatch_date, generated_by=None, order_ids=None, driver_ids=None, vehicle_ids=None, vehicle_driver_ids=None):
    draft_plans = list(
        RoutePlan.objects.filter(
            distributor=distributor,
            dispatch_date=dispatch_date,
            status=RoutePlanStatus.DRAFT,
        ).prefetch_related("runs__stops")
    )
    draft_order_ids = {
        stop.order_id
        for plan in draft_plans
        for run in plan.runs.all()
        for stop in run.stops.all()
    }
    requested_order_ids = set(order_ids or [])
    combined_order_ids = sorted(requested_order_ids | draft_order_ids) if requested_order_ids or draft_order_ids else None
    orders = list(_eligible_orders(distributor, dispatch_date, combined_order_ids, include_draft_plan_ids=[plan.id for plan in draft_plans]))
    if not orders:
        raise ValidationError("No hay pedidos para la fecha seleccionada.")
    route_resources = _eligible_route_resources(
        distributor=distributor,
        driver_ids=driver_ids,
        vehicle_ids=vehicle_ids,
        vehicle_driver_ids=vehicle_driver_ids,
    )
    if not route_resources:
        raise ValidationError("No hay vehiculos disponibles con capacidad cargada para generar rutas.")
    origin = _resolve_origin(distributor)
    if origin is None:
        raise ValidationError("La distribuidora necesita coordenadas para generar rutas.")

    candidate_stops, unassigned = _build_candidates(orders, dispatch_date)
    if not candidate_stops:
        raise ValidationError("No hay pedidos ruteables con coordenadas validas.")
    matrix_result = (
        _build_matrix(
            origin=(origin["latitude"], origin["longitude"]),
            destinations=[(candidate.latitude, candidate.longitude) for candidate in candidate_stops],
        )
        if candidate_stops
        else {
            "durations_min": [[0]],
            "distances_km": [[0]],
            "provider": "manual",
            "routing_status": "fallback_insufficient_points",
        }
    )
    routes = [RouteState(vehicle=vehicle, driver=driver) for vehicle, driver in route_resources]
    for route in routes:
        route.origin_snapshot = origin

    for candidate in sorted(candidate_stops, key=lambda item: (item.window_end_at, item.order.id)):
        choice, reason = _best_insertion(routes, candidate, matrix_result, dispatch_date)
        if not choice:
            unassigned.append({"order_id": candidate.order.id, "reason": reason})
            continue
        route, index, evaluation = choice
        route.stops.insert(index, candidate)
        route.load_kg += candidate.demand.kg
        route.load_m3 += candidate.demand.m3
        _apply_route_evaluation(route, evaluation)

    active_routes = [route for route in routes if route.stops]
    for route in active_routes:
        _apply_route_geometry(route, origin=origin, base_routing_status=matrix_result["routing_status"])

    return _persist_route_plan(
        distributor=distributor,
        dispatch_date=dispatch_date,
        generated_by=generated_by,
        routes=active_routes,
        unassigned=unassigned,
        draft_plans=draft_plans,
        requested_order_ids=order_ids,
        routing_provider=matrix_result["provider"],
        routing_status=matrix_result["routing_status"],
        origin=origin,
        requested_vehicle_ids=vehicle_ids,
        vehicle_driver_ids=vehicle_driver_ids,
    )


@transaction.atomic
def edit_route_plan(*, route_plan, runs_payload, reviewed_by=None):
    distributor = route_plan.distributor
    origin = _resolve_origin(distributor)
    if origin is None:
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
        latitude = stop.latitude if stop.latitude is not None else getattr(order.commerce, "latitude", None)
        longitude = stop.longitude if stop.longitude is not None else getattr(order.commerce, "longitude", None)
        if latitude is None or longitude is None:
            raise ValidationError(f"El pedido #{order.id} ya no tiene coordenadas validas.")
        candidate = CandidateStop(
            order=order,
            demand=Demand(kg=Decimal(str(stop.demand_kg)), m3=Decimal(str(stop.demand_m3))),
            window_start_at=stop.window_start_at,
            window_end_at=stop.window_end_at,
            latitude=float(latitude),
            longitude=float(longitude),
            address_snapshot=stop.address_snapshot or _address_snapshot(order),
            matrix_index=len(candidates) + 1,
        )
        candidates.append(candidate)
        candidate_by_stop_id[stop.id] = candidate

    matrix = _build_matrix(
        origin=(origin["latitude"], origin["longitude"]),
        destinations=[(candidate.latitude, candidate.longitude) for candidate in candidates],
    )

    run_states = {}
    for item in runs_payload:
        run = existing_runs[item["id"]]
        route_state = RouteState(driver=run.driver)
        route_state.vehicle = run.vehicle
        route_state.origin_snapshot = origin
        route_state.stops = [candidate_by_stop_id[stop_id] for stop_id in item["stop_ids"]]
        route_state.load_kg = sum((candidate.demand.kg for candidate in route_state.stops), start=Decimal("0"))
        route_state.load_m3 = sum((candidate.demand.m3 for candidate in route_state.stops), start=Decimal("0"))
        capacity_kg = Decimal(str(route_state.vehicle.capacity_kg or 0)) if route_state.vehicle else Decimal("0")
        capacity_m3 = Decimal(str(route_state.vehicle.capacity_m3 or 0)) if route_state.vehicle else Decimal("0")
        if capacity_kg and route_state.load_kg > capacity_kg:
            raise ValidationError(f"El recorrido de {_run_label(run)} supera la capacidad en kg.")
        if capacity_m3 and route_state.load_m3 > capacity_m3:
            raise ValidationError(f"El recorrido de {_run_label(run)} supera la capacidad en m3.")
        evaluation = _evaluate_route(route_state.stops, matrix, route_plan.dispatch_date)
        if not evaluation.feasible:
            raise ValidationError("La edicion propuesta no respeta las ventanas horarias vigentes.")
        _apply_route_evaluation(route_state, evaluation)
        _apply_route_geometry(route_state, origin=origin, base_routing_status=matrix["routing_status"])
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
        run.route_geometry = route_state.route_geometry
        run.origin_snapshot = route_state.origin_snapshot
        run.save(
            update_fields=[
                "sequence",
                "total_stops",
                "total_distance_km",
                "total_duration_min",
                "load_kg",
                "load_m3",
                "route_geometry",
                "origin_snapshot",
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
            stop.latitude = Decimal(str(route_state.stops[stop_index - 1].latitude)).quantize(Decimal("0.0000001"))
            stop.longitude = Decimal(str(route_state.stops[stop_index - 1].longitude)).quantize(Decimal("0.0000001"))
            stop.address_snapshot = route_state.stops[stop_index - 1].address_snapshot
            stop.save(
                update_fields=[
                    "route_run",
                    "sequence",
                    "planned_eta",
                    "leg_distance_km",
                    "leg_duration_min",
                    "latitude",
                    "longitude",
                    "address_snapshot",
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
    route_plan.route_geometry = _merge_route_geometries([state.route_geometry for state in run_states.values() if state.stops])
    route_plan.provider = matrix["provider"]
    route_plan.routing_status = matrix["routing_status"]
    route_plan.planning_version += 1
    route_plan.reviewed_at = timezone.now()
    route_plan.reviewed_by = reviewed_by
    route_plan.preview_payload = {
        **(route_plan.preview_payload or {}),
        "routing_status": matrix["routing_status"],
        "last_edit": {"type": "runs", "at": timezone.now().isoformat()},
    }
    route_plan.save(
        update_fields=[
            "total_runs",
            "total_orders",
            "total_distance_km",
            "total_duration_min",
            "total_load_kg",
            "total_load_m3",
            "route_geometry",
            "provider",
            "routing_status",
            "planning_version",
            "reviewed_at",
            "reviewed_by",
            "preview_payload",
            "updated_at",
        ]
    )
    RouteAuditEvent.objects.create(
        route_plan=route_plan,
        event_type="stops_updated",
        actor=reviewed_by,
        payload={"mode": "runs", "planning_version": route_plan.planning_version},
    )
    route_plan.refresh_from_db()
    return route_plan


def _eligible_orders(distributor, dispatch_date, order_ids, include_draft_plan_ids=None):
    queryset = (
        Order.objects.select_related("commerce", "distributor")
        .prefetch_related("items", "items__product")
        .filter(
            distributor=distributor,
            dispatch_date=dispatch_date,
            status__in=[OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.SCHEDULED],
        )
        .order_by("id")
    )
    if order_ids:
        queryset = queryset.filter(id__in=order_ids)
    active_delivery_statuses = [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY, DeliveryStatus.DELIVERED]
    queryset = queryset.exclude(delivery__status__in=active_delivery_statuses)
    active_plan_statuses = [RoutePlanStatus.CONFIRMED, RoutePlanStatus.DISPATCHED, RoutePlanStatus.COMPLETED]
    queryset = queryset.exclude(route_stops__route_run__route_plan__status__in=active_plan_statuses)
    include_draft_plan_ids = include_draft_plan_ids or []
    if include_draft_plan_ids:
        queryset = queryset.filter(
            Q(route_stops__isnull=True)
            | Q(route_stops__route_run__route_plan_id__in=include_draft_plan_ids)
            | Q(route_stops__route_run__route_plan__status=RoutePlanStatus.CANCELLED)
        )
    else:
        queryset = queryset.exclude(route_stops__route_run__route_plan__status=RoutePlanStatus.DRAFT)
    return queryset.distinct()


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


def _eligible_route_resources(*, distributor, driver_ids, vehicle_ids, vehicle_driver_ids):
    if not vehicle_ids:
        return [(driver.assigned_vehicle, driver) for driver in _eligible_drivers(distributor, driver_ids, vehicle_ids)]

    requested_vehicle_ids = _unique_ints(vehicle_ids)
    vehicles = {
        vehicle.id: vehicle
        for vehicle in Vehicle.objects.filter(distributor=distributor, active=True, id__in=requested_vehicle_ids)
        .exclude(status=VehicleStatus.MAINTENANCE)
        .exclude(status=VehicleStatus.INACTIVE)
    }
    ordered_vehicles = [vehicles[vehicle_id] for vehicle_id in requested_vehicle_ids if vehicle_id in vehicles]
    if not ordered_vehicles:
        return []

    vehicle_driver_ids = vehicle_driver_ids or {}
    mapped_driver_ids = []
    for value in vehicle_driver_ids.values():
        if value not in (None, ""):
            mapped_driver_ids.append(int(value))
    requested_driver_ids = _unique_ints(driver_ids or mapped_driver_ids)
    if len(mapped_driver_ids) != len(set(mapped_driver_ids)):
        raise ValidationError("No puedes asignar el mismo chofer a mas de un vehiculo.")

    available_drivers = {
        driver.id: driver
        for driver in DriverProfile.objects.select_related("user")
        .filter(distributor=distributor, active=True, available=True)
        .filter(id__in=requested_driver_ids or [])
    }
    missing_driver_ids = set(requested_driver_ids) - set(available_drivers)
    if missing_driver_ids:
        raise ValidationError("Hay choferes seleccionados que no estan disponibles.")

    resources = []
    fallback_drivers = [available_drivers[driver_id] for driver_id in requested_driver_ids]
    fallback_index = 0
    for vehicle in ordered_vehicles:
        driver = None
        mapped_driver_id = vehicle_driver_ids.get(str(vehicle.id)) or vehicle_driver_ids.get(vehicle.id)
        if mapped_driver_id:
            driver = available_drivers.get(int(mapped_driver_id))
        elif fallback_index < len(fallback_drivers):
            driver = fallback_drivers[fallback_index]
            fallback_index += 1
        resources.append((vehicle, driver))
    return resources


def _unique_ints(values):
    unique = []
    for value in values or []:
        item = int(value)
        if item not in unique:
            unique.append(item)
    return unique


def _run_label(run):
    if run.driver_id:
        return run.driver.user.full_name
    return run.vehicle.plate


def _build_candidates(orders, dispatch_date):
    candidates = []
    unassigned = []
    for order in orders:
        commerce = order.commerce
        if commerce.latitude is None or commerce.longitude is None:
            unassigned.append({"order_id": order.id, "reason": "missing_coords"})
            continue
        _refresh_order_capacity_from_master(order)
        demand = Demand(
            kg=sum((item.weight_kg for item in order.items.all()), start=Decimal("0")),
            m3=sum((item.volume_m3 for item in order.items.all()), start=Decimal("0")),
        )
        if not order.items.exists() or (demand.kg <= 0 and demand.m3 <= 0):
            unassigned.append({"order_id": order.id, "reason": "missing_physical_lines"})
            continue
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
                latitude=float(commerce.latitude),
                longitude=float(commerce.longitude),
                address_snapshot=_address_snapshot(order),
                matrix_index=len(candidates) + 1,
            )
        )
    return candidates, unassigned


def _build_matrix(origin, destinations):
    provider = routing_provider()
    if provider == "ors" and _ors_api_key():
        try:
            matrix = ors_build_matrix(origin, destinations)
            matrix["provider"] = "ors"
            matrix["routing_status"] = "optimized"
            return matrix
        except (ImproperlyConfigured, RuntimeError):
            return _build_fallback_matrix(origin, destinations, routing_status="fallback_ors_unavailable")
    if provider == "ors":
        return _build_fallback_matrix(origin, destinations, routing_status="fallback_no_ors_key")
    return _build_fallback_matrix(origin, destinations, routing_status="fallback_provider_unsupported")


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
def _persist_route_plan(
    *,
    distributor,
    dispatch_date,
    generated_by,
    routes,
    unassigned,
    draft_plans,
    requested_order_ids,
    routing_provider,
    routing_status,
    origin,
    requested_vehicle_ids=None,
    vehicle_driver_ids=None,
):
    active_routes = [route for route in routes if route.stops]
    superseded = [plan.id for plan in draft_plans]
    route_plan = RoutePlan.objects.create(
        distributor=distributor,
        dispatch_date=dispatch_date,
        generated_by=generated_by,
        provider=routing_provider,
        routing_status=routing_status,
        route_geometry=_merge_route_geometries([route.route_geometry for route in active_routes]),
        total_runs=len(active_routes),
        total_orders=sum(len(route.stops) for route in active_routes),
        total_distance_km=sum((route.total_distance_km for route in active_routes), start=Decimal("0")),
        total_duration_min=sum((route.total_duration_min for route in active_routes), start=Decimal("0")),
        total_load_kg=sum((route.load_kg for route in active_routes), start=Decimal("0")),
        total_load_m3=sum((route.load_m3 for route in active_routes), start=Decimal("0")),
        unassigned_summary=unassigned,
        preview_payload={
            "excluded": unassigned,
            "routing_status": routing_status,
            "input": {
                "dispatch_date": dispatch_date.isoformat(),
                "requested_order_ids": requested_order_ids or [],
                "requested_vehicle_ids": requested_vehicle_ids or [],
                "vehicle_driver_ids": vehicle_driver_ids or {},
                "origin": origin,
            },
            "superseded_route_plan_ids": superseded,
        },
    )
    route_plan.route_number = f"HR-{route_plan.id:06d}"
    route_plan.save(update_fields=["route_number", "updated_at"])
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
            route_geometry=route.route_geometry,
            origin_snapshot=route.origin_snapshot,
        )
        for stop_index, stop in enumerate(route.stops, start=1):
            route_stop = RouteStop.objects.create(
                route_run=run,
                order=stop.order,
                sequence=stop_index,
                status=RouteStopStatus.PENDING,
                address_snapshot=stop.address_snapshot,
                latitude=Decimal(str(stop.latitude)).quantize(Decimal("0.0000001")),
                longitude=Decimal(str(stop.longitude)).quantize(Decimal("0.0000001")),
                planned_eta=route.stop_etas[stop_index - 1],
                window_start_at=stop.window_start_at,
                window_end_at=stop.window_end_at,
                leg_distance_km=route.leg_distance_km[stop_index - 1],
                leg_duration_min=route.leg_duration_min[stop_index - 1],
                demand_kg=stop.demand.kg,
                demand_m3=stop.demand.m3,
            )
            _create_stop_lines(route_stop)
    for draft_plan in draft_plans:
        draft_plan.status = RoutePlanStatus.CANCELLED
        draft_plan.preview_payload = {
            **(draft_plan.preview_payload or {}),
            "superseded_by": route_plan.id,
        }
        draft_plan.save(update_fields=["status", "preview_payload", "updated_at"])
        RouteAuditEvent.objects.create(
            route_plan=draft_plan,
            event_type="draft_superseded",
            actor=generated_by,
            payload={"superseded_by": route_plan.id},
        )
    RouteOptimizationRun.objects.create(
        route_plan=route_plan,
        actor=generated_by,
        input_payload=route_plan.preview_payload.get("input", {}),
        output_payload={
            "routing_status": routing_status,
            "provider": routing_provider,
            "total_runs": route_plan.total_runs,
            "total_orders": route_plan.total_orders,
            "excluded": unassigned,
        },
    )
    RouteAuditEvent.objects.create(
        route_plan=route_plan,
        event_type="preview_created",
        actor=generated_by,
        payload={"routing_status": routing_status, "provider": routing_provider},
    )
    return route_plan


@transaction.atomic
def patch_route_plan_stops(*, route_plan, stops_payload, remove_stop_ids=None, reviewed_by=None):
    if route_plan.status != RoutePlanStatus.DRAFT:
        raise ValidationError("Solo se pueden editar paradas de rutas en borrador.")
    distributor = route_plan.distributor
    origin = _resolve_origin(distributor)
    if origin is None:
        raise ValidationError("La distribuidora necesita coordenadas para editar rutas.")

    remove_stop_ids = set(remove_stop_ids or [])
    all_stops = {
        stop.id: stop
        for stop in RouteStop.objects.select_related("route_run", "order", "order__commerce")
        .prefetch_related("lines")
        .filter(route_run__route_plan=route_plan)
    }
    unknown_remove_ids = remove_stop_ids - set(all_stops.keys())
    if unknown_remove_ids:
        raise ValidationError("Hay paradas a quitar que no pertenecen a esta ruta.")

    for stop_id in remove_stop_ids:
        all_stops[stop_id].delete()

    remaining_stops = {stop_id: stop for stop_id, stop in all_stops.items() if stop_id not in remove_stop_ids}
    submitted_ids = [item["id"] for item in stops_payload]
    if len(submitted_ids) != len(set(submitted_ids)):
        raise ValidationError("No puedes repetir paradas en la edicion.")
    if set(submitted_ids) != set(remaining_stops.keys()):
        raise ValidationError("Debes enviar todas las paradas restantes para recalcular la ruta.")

    runs = {run.id: run for run in route_plan.runs.select_related("driver", "vehicle").all()}
    candidates = []
    candidate_by_stop_id = {}
    grouped_stop_ids = {run_id: [] for run_id in runs}
    for item in sorted(stops_payload, key=lambda row: (row.get("route_run_id") or remaining_stops[row["id"]].route_run_id, row["sequence"])):
        stop = remaining_stops[item["id"]]
        run_id = item.get("route_run_id") or stop.route_run_id
        if run_id not in runs:
            raise ValidationError("Hay paradas asignadas a un recorrido inexistente.")
        latitude = item.get("lat", item.get("latitude", stop.latitude))
        longitude = item.get("lng", item.get("longitude", stop.longitude))
        if latitude is None or longitude is None:
            latitude = getattr(stop.order.commerce, "latitude", None)
            longitude = getattr(stop.order.commerce, "longitude", None)
        if latitude is None or longitude is None:
            raise ValidationError(f"El pedido #{stop.order_id} no tiene coordenadas validas.")
        candidate = CandidateStop(
            order=stop.order,
            demand=Demand(kg=Decimal(str(stop.demand_kg)), m3=Decimal(str(stop.demand_m3))),
            window_start_at=stop.window_start_at,
            window_end_at=stop.window_end_at,
            latitude=float(latitude),
            longitude=float(longitude),
            address_snapshot=stop.address_snapshot or _address_snapshot(stop.order),
            matrix_index=len(candidates) + 1,
        )
        candidates.append(candidate)
        candidate_by_stop_id[stop.id] = candidate
        grouped_stop_ids[run_id].append(stop.id)

    matrix = _build_matrix(
        origin=(origin["latitude"], origin["longitude"]),
        destinations=[(candidate.latitude, candidate.longitude) for candidate in candidates],
    )

    run_states = {}
    for run_id, run in runs.items():
        route_state = RouteState(driver=run.driver)
        route_state.vehicle = run.vehicle
        route_state.origin_snapshot = origin
        route_state.stops = [candidate_by_stop_id[stop_id] for stop_id in grouped_stop_ids.get(run_id, [])]
        route_state.load_kg = sum((candidate.demand.kg for candidate in route_state.stops), start=Decimal("0"))
        route_state.load_m3 = sum((candidate.demand.m3 for candidate in route_state.stops), start=Decimal("0"))
        capacity_kg = Decimal(str(route_state.vehicle.capacity_kg or 0)) if route_state.vehicle else Decimal("0")
        capacity_m3 = Decimal(str(route_state.vehicle.capacity_m3 or 0)) if route_state.vehicle else Decimal("0")
        if capacity_kg and route_state.load_kg > capacity_kg:
            raise ValidationError(f"El recorrido de {_run_label(run)} supera la capacidad en kg.")
        if capacity_m3 and route_state.load_m3 > capacity_m3:
            raise ValidationError(f"El recorrido de {_run_label(run)} supera la capacidad en m3.")
        evaluation = _evaluate_route(route_state.stops, matrix, route_plan.dispatch_date)
        if not evaluation.feasible:
            raise ValidationError("La edicion propuesta no respeta las ventanas horarias vigentes.")
        _apply_route_evaluation(route_state, evaluation)
        _apply_route_geometry(route_state, origin=origin, base_routing_status=matrix["routing_status"])
        run_states[run_id] = route_state

    for offset, stop in enumerate(remaining_stops.values(), start=1):
        stop.sequence = len(remaining_stops) + offset
        stop.save(update_fields=["sequence", "updated_at"])

    active_runs = []
    next_sequence = 1
    for run_id, run in runs.items():
        route_state = run_states[run_id]
        if not route_state.stops:
            run.delete()
            continue
        run.sequence = next_sequence
        run.total_stops = len(route_state.stops)
        run.total_distance_km = route_state.total_distance_km
        run.total_duration_min = route_state.total_duration_min
        run.load_kg = route_state.load_kg
        run.load_m3 = route_state.load_m3
        run.route_geometry = route_state.route_geometry
        run.origin_snapshot = route_state.origin_snapshot
        run.save(
            update_fields=[
                "sequence",
                "total_stops",
                "total_distance_km",
                "total_duration_min",
                "load_kg",
                "load_m3",
                "route_geometry",
                "origin_snapshot",
                "updated_at",
            ]
        )
        active_runs.append(run)
        next_sequence += 1
        for stop_index, candidate in enumerate(route_state.stops, start=1):
            stop = next(stop for stop in remaining_stops.values() if stop.order_id == candidate.order.id)
            stop.route_run = run
            stop.sequence = stop_index
            stop.planned_eta = route_state.stop_etas[stop_index - 1]
            stop.leg_distance_km = route_state.leg_distance_km[stop_index - 1]
            stop.leg_duration_min = route_state.leg_duration_min[stop_index - 1]
            stop.latitude = Decimal(str(candidate.latitude)).quantize(Decimal("0.0000001"))
            stop.longitude = Decimal(str(candidate.longitude)).quantize(Decimal("0.0000001"))
            stop.address_snapshot = candidate.address_snapshot
            stop.save(
                update_fields=[
                    "route_run",
                    "sequence",
                    "planned_eta",
                    "leg_distance_km",
                    "leg_duration_min",
                    "latitude",
                    "longitude",
                    "address_snapshot",
                    "updated_at",
                ]
            )

    route_plan.total_runs = len(active_runs)
    route_plan.total_orders = len(remaining_stops)
    route_plan.total_distance_km = sum((state.total_distance_km for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_duration_min = sum((state.total_duration_min for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_load_kg = sum((state.load_kg for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.total_load_m3 = sum((state.load_m3 for state in run_states.values() if state.stops), start=Decimal("0"))
    route_plan.route_geometry = _merge_route_geometries([state.route_geometry for state in run_states.values() if state.stops])
    route_plan.provider = matrix["provider"]
    route_plan.routing_status = matrix["routing_status"]
    route_plan.planning_version += 1
    route_plan.reviewed_at = timezone.now()
    route_plan.reviewed_by = reviewed_by
    route_plan.preview_payload = {
        **(route_plan.preview_payload or {}),
        "routing_status": matrix["routing_status"],
        "last_edit": {"type": "stops", "at": route_plan.reviewed_at.isoformat()},
        "removed_stop_ids": sorted(remove_stop_ids),
    }
    route_plan.save(
        update_fields=[
            "total_runs",
            "total_orders",
            "total_distance_km",
            "total_duration_min",
            "total_load_kg",
            "total_load_m3",
            "route_geometry",
            "provider",
            "routing_status",
            "planning_version",
            "reviewed_at",
            "reviewed_by",
            "preview_payload",
            "updated_at",
        ]
    )
    RouteAuditEvent.objects.create(
        route_plan=route_plan,
        event_type="stops_updated",
        actor=reviewed_by,
        payload={"mode": "stops", "planning_version": route_plan.planning_version, "removed_stop_ids": sorted(remove_stop_ids)},
    )
    route_plan.refresh_from_db()
    return route_plan


def pending_route_orders(*, distributor, dispatch_date):
    orders = list(_eligible_orders(distributor, dispatch_date, order_ids=None))
    rows = []
    for order in orders:
        _refresh_order_capacity_from_master(order)
        commerce = order.commerce
        weight = sum((item.weight_kg for item in order.items.all()), start=Decimal("0"))
        volume = sum((item.volume_m3 for item in order.items.all()), start=Decimal("0"))
        missing_coords = commerce.latitude is None or commerce.longitude is None
        rows.append(
            {
                "id": order.id,
                "commerce": commerce.id,
                "commerce_name": commerce.trade_name,
                "status": order.status,
                "dispatch_date": order.dispatch_date.isoformat(),
                "delivery_address": order.delivery_address or commerce.address,
                "address_snapshot": _address_snapshot(order),
                "lat": None if commerce.latitude is None else str(commerce.latitude),
                "lng": None if commerce.longitude is None else str(commerce.longitude),
                "planned_weight_kg": str(weight.quantize(Decimal("0.001"))),
                "planned_volume_m3": str(volume.quantize(Decimal("0.000001"))),
                "routable": not missing_coords and weight > 0,
                "exclusion_reason": "missing_coordinates" if missing_coords else ("" if weight > 0 else "missing_physical_lines"),
            }
        )
    return rows


def _ors_api_key():
    return getattr(settings, "ORS_API_KEY", "") or getattr(settings, "OPENROUTESERVICE_API_KEY", "")


def _build_fallback_matrix(origin, destinations, *, routing_status):
    points = [origin, *destinations]
    distances = []
    durations = []
    for source in points:
        distance_row = []
        duration_row = []
        for target in points:
            distance = _haversine_km(source[0], source[1], target[0], target[1])
            distance_row.append(round(distance, 3))
            duration_row.append(round((distance / 40) * 60, 2))
        distances.append(distance_row)
        durations.append(duration_row)
    return {
        "durations_min": durations,
        "distances_km": distances,
        "provider": "manual",
        "routing_status": routing_status,
    }


def _haversine_km(lat1, lon1, lat2, lon2):
    radius_km = 6371
    lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * radius_km * asin(sqrt(value))


def _resolve_origin(distributor):
    if distributor.latitude is None or distributor.longitude is None:
        return None
    return {
        "lat": str(distributor.latitude),
        "lng": str(distributor.longitude),
        "latitude": float(distributor.latitude),
        "longitude": float(distributor.longitude),
        "formatted": distributor.address or distributor.business_name,
        "source": "distributor",
    }


def _apply_route_geometry(route, *, origin, base_routing_status):
    points = [(origin["latitude"], origin["longitude"])]
    points.extend((stop.latitude, stop.longitude) for stop in route.stops)
    if route.stops:
        points.append((origin["latitude"], origin["longitude"]))
    if len(points) < 2:
        route.route_geometry = _line_geometry(points)
        return
    if base_routing_status == "optimized" and _ors_api_key():
        try:
            route.route_geometry = ors_build_directions(points)["geometry"]
            return
        except (ImproperlyConfigured, RuntimeError):
            pass
    route.route_geometry = _line_geometry(points)


def _line_geometry(points):
    return {
        "type": "LineString",
        "coordinates": [[float(longitude), float(latitude)] for latitude, longitude in points],
    }


def _merge_route_geometries(geometries):
    geometries = [geometry for geometry in geometries if geometry]
    if not geometries:
        return None
    if len(geometries) == 1:
        return geometries[0]
    return {
        "type": "MultiLineString",
        "coordinates": [geometry.get("coordinates", []) for geometry in geometries if geometry.get("type") == "LineString"],
    }


def _address_snapshot(order):
    commerce = order.commerce
    return {
        "commerce_id": commerce.id,
        "commerce_name": commerce.trade_name,
        "address": commerce.address or order.delivery_address,
        "city": commerce.city,
        "province": commerce.province,
        "postal_code": commerce.postal_code,
        "latitude": None if commerce.latitude is None else str(commerce.latitude),
        "longitude": None if commerce.longitude is None else str(commerce.longitude),
    }


def _refresh_order_capacity_from_master(order):
    changed_items = []
    for item in order.items.all():
        product = item.product
        quantity = Decimal(str(item.quantity))
        weight_kg = _weight_total_kg(product, quantity)
        volume_m3 = _volume_total_m3(product, quantity)
        if item.weight_kg != weight_kg or item.volume_m3 != volume_m3:
            item.weight_kg = weight_kg
            item.volume_m3 = volume_m3
            changed_items.append(item)
    if changed_items:
        for item in changed_items:
            item.save(update_fields=["weight_kg", "volume_m3"])


def _weight_total_kg(product, quantity):
    factor = Decimal("0.001") if product.weight_unit == "g" else Decimal("1")
    return (Decimal(product.weight) * factor * quantity).quantize(Decimal("0.001"))


def _volume_total_m3(product, quantity):
    unit_factor = {
        "mm": Decimal("0.001"),
        "cm": Decimal("0.01"),
        "m": Decimal("1"),
    }.get(product.dimension_unit, Decimal("0.01"))
    length_m = Decimal(product.length) * unit_factor
    width_m = Decimal(product.width) * unit_factor
    height_m = Decimal(product.height) * unit_factor
    return (length_m * width_m * height_m * quantity).quantize(Decimal("0.000001"))


def _create_stop_lines(route_stop):
    for item in route_stop.order.items.select_related("product").all():
        RouteStopLine.objects.create(
            stop=route_stop,
            order_item=item,
            product=item.product,
            quantity=item.quantity,
            uom=item.product.unit,
            weight_kg=item.weight_kg,
            volume_m3=item.volume_m3,
        )

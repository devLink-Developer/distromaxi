from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import decorators, mixins, permissions, response, status, viewsets
from rest_framework.views import APIView

from apps.deliveries.models import Delivery, DeliveryStatus
from apps.notifications.services import notify_order_status, notify_user
from apps.orders.models import OrderStatus
from apps.inventory.services import commit_reserved_stock

from .engine import create_manual_route_plan, edit_route_plan, generate_route_plan, patch_route_plan_stops, pending_route_orders
from .models import IdempotencyKey, IdempotencyStatus, RouteAuditEvent, RoutePlan, RoutePlanStatus, RouteRun, RouteRunStatus, RouteStop, RouteStopStatus
from .serializers import (
    CurrentRouteSerializer,
    ManualRoutePlanSerializer,
    RouteConfirmSerializer,
    RouteGenerateSerializer,
    RoutePlanEditSerializer,
    RoutePlanSerializer,
    RouteStopSerializer,
    RouteStopsPatchSerializer,
)
from .services import (
    distributor_has_manual_routing,
    get_automatic_routing_distributor,
    get_manual_routing_distributor,
    request_payload_hash,
    route_plan_delete_state,
)


class RoutePlanViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = RoutePlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        distributor = get_manual_routing_distributor(self.request.user)
        queryset = RoutePlan.objects.select_related("distributor", "delivery_slot").prefetch_related(
            "runs",
            "runs__driver",
            "runs__driver__user",
            "runs__vehicle",
            "runs__stops",
            "runs__stops__order",
            "runs__stops__order__commerce",
            "runs__stops__delivery",
            "runs__stops__lines",
            "runs__stops__lines__order_item",
            "runs__stops__lines__product",
        )
        dispatch_date = self.request.query_params.get("dispatch_date")
        queryset = queryset.filter(distributor=distributor)
        if dispatch_date:
            queryset = queryset.filter(dispatch_date=dispatch_date)
        delivery_slot_id = self.request.query_params.get("delivery_slot_id")
        if delivery_slot_id:
            queryset = queryset.filter(delivery_slot_id=delivery_slot_id)
        return queryset

    def destroy(self, request, *args, **kwargs):
        route_plan = self.get_object()
        can_delete, reason = route_plan_delete_state(route_plan)
        if not can_delete:
            return response.Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            route_plan.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(detail=False, methods=["get"], url_path="pending-orders")
    def pending_orders(self, request):
        dispatch_date = request.query_params.get("dispatch_date")
        if not dispatch_date:
            return response.Response({"detail": "dispatch_date es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RouteGenerateSerializer(
            data={
                "dispatch_date": dispatch_date,
                "delivery_slot_id": request.query_params.get("delivery_slot_id") or None,
            }
        )
        serializer.is_valid(raise_exception=True)
        distributor = get_manual_routing_distributor(request.user)
        return response.Response(
            pending_route_orders(
                distributor=distributor,
                dispatch_date=serializer.validated_data["dispatch_date"],
                delivery_slot_id=serializer.validated_data.get("delivery_slot_id"),
            )
        )

    @decorators.action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = RouteGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        distributor = get_automatic_routing_distributor(request.user)
        idempotency_key = request.headers.get("Idempotency-Key")
        idempotency_record = None
        payload_hash = request_payload_hash({"action": "route_plan_generate", "distributor_id": distributor.id, "payload": serializer.validated_data})
        if idempotency_key:
            idempotency_record, created = IdempotencyKey.objects.get_or_create(
                key=idempotency_key,
                defaults={"request_hash": payload_hash, "status": IdempotencyStatus.IN_PROGRESS},
            )
            if not created:
                if idempotency_record.request_hash != payload_hash:
                    return response.Response(
                        {"detail": "La Idempotency-Key ya fue usada con otro payload."},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )
                if idempotency_record.status == IdempotencyStatus.COMPLETED:
                    return response.Response(idempotency_record.response_payload, status=status.HTTP_201_CREATED)
        try:
            route_plan = generate_route_plan(
                distributor=distributor,
                dispatch_date=serializer.validated_data["dispatch_date"],
                generated_by=request.user,
                order_ids=serializer.validated_data.get("order_ids"),
                driver_ids=serializer.validated_data.get("driver_ids"),
                vehicle_ids=serializer.validated_data.get("vehicle_ids"),
                vehicle_driver_ids=serializer.validated_data.get("vehicle_driver_ids"),
                delivery_slot_id=serializer.validated_data.get("delivery_slot_id"),
            )
        except DjangoValidationError as exc:
            if idempotency_record:
                idempotency_record.status = IdempotencyStatus.FAILED
                idempotency_record.save(update_fields=["status", "updated_at"])
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        payload = self.get_serializer(route_plan).data
        if idempotency_record:
            idempotency_record.request_hash = payload_hash
            idempotency_record.response_payload = payload
            idempotency_record.status = IdempotencyStatus.COMPLETED
            idempotency_record.save(update_fields=["request_hash", "response_payload", "status", "updated_at"])
        return response.Response(payload, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"], url_path="manual")
    def manual(self, request):
        serializer = ManualRoutePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        distributor = get_manual_routing_distributor(request.user)
        try:
            route_plan = create_manual_route_plan(
                distributor=distributor,
                dispatch_date=serializer.validated_data["dispatch_date"],
                delivery_slot_id=serializer.validated_data.get("delivery_slot_id"),
                runs_payload=serializer.validated_data["runs"],
                generated_by=request.user,
            )
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(route_plan).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status not in {RoutePlanStatus.DRAFT, RoutePlanStatus.CONFIRMED}:
            return response.Response({"detail": "Solo se pueden confirmar planes en borrador."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RouteConfirmSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        if route_plan.status == RoutePlanStatus.DRAFT and route_plan.reviewed_at is None and not serializer.validated_data["reviewed"]:
            return response.Response({"detail": "Debes revisar el mapa antes de confirmar la ruta."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for run in route_plan.runs.select_related("driver", "driver__user", "vehicle").prefetch_related("stops__order"):
                if not run.driver_id:
                    return response.Response(
                        {"detail": "Selecciona un chofer para todos los recorridos antes de confirmar la ruta."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                capacity_error = _capacity_error(run)
                override_reason = serializer.validated_data.get("capacity_override_reason", "")
                if capacity_error and not override_reason:
                    return response.Response({"detail": capacity_error}, status=status.HTTP_400_BAD_REQUEST)
                run.status = RouteRunStatus.CONFIRMED
                run.save(update_fields=["status", "updated_at"])
                for stop in run.stops.all():
                    delivery, _ = Delivery.objects.update_or_create(
                        order=stop.order,
                        defaults={
                            "driver": run.driver,
                            "vehicle": run.vehicle,
                            "status": DeliveryStatus.ASSIGNED,
                        },
                    )
                    stop.delivery = delivery
                    stop.save(update_fields=["delivery", "updated_at"])
                    if stop.order.status != OrderStatus.SCHEDULED:
                        stop.order.status = OrderStatus.SCHEDULED
                        stop.order.save(update_fields=["status", "updated_at"])
                        notify_order_status(stop.order)
                    if run.driver_id and run.driver.user_id:
                        notify_user(
                            run.driver.user,
                            f"Entrega asignada #{delivery.id}",
                            f"Pedido #{stop.order_id} listo para reparto.",
                            "DELIVERY",
                            {"delivery_id": delivery.id, "order_id": stop.order_id},
                        )
            route_plan.status = RoutePlanStatus.CONFIRMED
            route_plan.reviewed_at = route_plan.reviewed_at or timezone.now()
            route_plan.reviewed_by = route_plan.reviewed_by or request.user
            route_plan.capacity_override_reason = serializer.validated_data.get("capacity_override_reason", "")
            route_plan.optimization_runs.update(accepted=True)
            route_plan.save(update_fields=["status", "reviewed_at", "reviewed_by", "capacity_override_reason", "updated_at"])
            RouteAuditEvent.objects.create(
                route_plan=route_plan,
                event_type="route_confirmed",
                actor=request.user,
                payload={"reviewed": True, "capacity_override": bool(route_plan.capacity_override_reason)},
            )
        return response.Response(self.get_serializer(route_plan).data)

    @decorators.action(detail=True, methods=["post"], url_path="edit")
    def edit(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status in {RoutePlanStatus.DISPATCHED, RoutePlanStatus.COMPLETED, RoutePlanStatus.CANCELLED}:
            return response.Response({"detail": "Solo puedes editar rutas pendientes de despacho."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RoutePlanEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = edit_route_plan(route_plan=route_plan, runs_payload=serializer.validated_data["runs"], reviewed_by=request.user)
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(updated).data)

    @decorators.action(detail=True, methods=["patch"], url_path="stops")
    def patch_stops(self, request, pk=None):
        route_plan = self.get_object()
        serializer = RouteStopsPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = patch_route_plan_stops(
                route_plan=route_plan,
                stops_payload=serializer.validated_data["stops"],
                remove_stop_ids=serializer.validated_data.get("remove_stop_ids", []),
                reviewed_by=request.user,
            )
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(updated).data)

    @decorators.action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_plan(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status != RoutePlanStatus.CONFIRMED:
            return response.Response({"detail": "Solo se pueden despachar planes confirmados."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for run in route_plan.runs.prefetch_related("stops__order", "stops__delivery"):
                run.status = RouteRunStatus.DISPATCHED
                run.save(update_fields=["status", "updated_at"])
                for stop in run.stops.all():
                    if stop.delivery_id:
                        stop.delivery.status = DeliveryStatus.ON_THE_WAY
                        stop.delivery.save(update_fields=["status", "updated_at"])
                    if stop.order.status != OrderStatus.ON_THE_WAY:
                        stop.order.status = OrderStatus.ON_THE_WAY
                        stop.order.save(update_fields=["status", "updated_at"])
                        notify_order_status(stop.order)
            route_plan.status = RoutePlanStatus.DISPATCHED
            route_plan.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(route_plan).data)

    @decorators.action(detail=True, methods=["post"], url_path="replan")
    def replan(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status == RoutePlanStatus.DISPATCHED:
            return response.Response({"detail": "No se puede replanificar una ruta ya despachada."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RouteGenerateSerializer(data={"dispatch_date": route_plan.dispatch_date})
        serializer.is_valid(raise_exception=True)
        distributor = get_automatic_routing_distributor(request.user)
        with transaction.atomic():
            for stop in RouteStop.objects.filter(route_run__route_plan=route_plan).select_related("delivery", "order"):
                if stop.delivery_id and stop.delivery.status == DeliveryStatus.ASSIGNED:
                    stop.delivery.delete()
                    stop.delivery = None
                    stop.save(update_fields=["delivery", "updated_at"])
                if stop.order.status == OrderStatus.SCHEDULED:
                    stop.order.status = OrderStatus.ACCEPTED
                    stop.order.save(update_fields=["status", "updated_at"])
            route_plan.status = RoutePlanStatus.CANCELLED
            route_plan.save(update_fields=["status", "updated_at"])
            try:
                next_plan = generate_route_plan(
                    distributor=distributor,
                    dispatch_date=route_plan.dispatch_date,
                    generated_by=request.user,
                    delivery_slot_id=route_plan.delivery_slot_id,
                )
            except DjangoValidationError as exc:
                return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(next_plan).data, status=status.HTTP_201_CREATED)


class DriverCurrentRouteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "DRIVER" or not hasattr(user, "driver_profile"):
            return response.Response({"detail": "Solo los choferes pueden consultar su ruta actual."}, status=status.HTTP_403_FORBIDDEN)
            if not distributor_has_manual_routing(user.driver_profile.distributor):
                return response.Response({"detail": "El ruteo manual esta disponible para el plan MaxiGestion activo."}, status=status.HTTP_403_FORBIDDEN)
        queryset = (
            RouteRun.objects.select_related("route_plan", "driver", "driver__user", "vehicle")
            .prefetch_related("stops", "stops__order", "stops__order__commerce", "stops__delivery", "stops__lines", "stops__lines__order_item", "stops__lines__product")
            .filter(driver=user.driver_profile, route_plan__status__in=[RoutePlanStatus.DISPATCHED, RoutePlanStatus.CONFIRMED])
            .order_by("-route_plan__dispatch_date", "sequence")
        )
        route_run = queryset.first()
        if route_run is None:
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        return response.Response(CurrentRouteSerializer(route_run).data)


class RouteStopViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RouteStopSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = RouteStop.objects.select_related(
            "route_run",
            "route_run__route_plan",
            "route_run__driver",
            "route_run__driver__user",
            "route_run__vehicle",
            "order",
            "order__commerce",
            "delivery",
        ).prefetch_related("lines", "lines__order_item", "lines__product")
        user = self.request.user
        if user.role == "DRIVER" and hasattr(user, "driver_profile"):
            if not distributor_has_manual_routing(user.driver_profile.distributor):
                return queryset.none()
            return queryset.filter(route_run__driver=user.driver_profile)
        distributor = get_manual_routing_distributor(user)
        return queryset.filter(route_run__route_plan__distributor=distributor)

    @decorators.action(detail=True, methods=["post"], url_path="arrive")
    def arrive(self, request, pk=None):
        stop = self.get_object()
        stop.status = RouteStopStatus.ARRIVED
        stop.save(update_fields=["status", "updated_at"])
        if stop.delivery_id and stop.delivery.status == DeliveryStatus.ON_THE_WAY:
            stop.delivery.status = DeliveryStatus.PICKED_UP
            stop.delivery.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(stop).data)

    @decorators.action(detail=True, methods=["post"], url_path="deliver")
    def deliver(self, request, pk=None):
        stop = self.get_object()
        with transaction.atomic():
            stop.status = RouteStopStatus.DELIVERED
            stop.save(update_fields=["status", "updated_at"])
            if stop.delivery_id:
                stop.delivery.status = DeliveryStatus.DELIVERED
                stop.delivery.save(update_fields=["status", "updated_at"])
            order = stop.order
            previous_status = order.status
            order.status = OrderStatus.DELIVERED
            try:
                if previous_status != OrderStatus.DELIVERED:
                    commit_reserved_stock(order)
            except DjangoValidationError as exc:
                return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
            order.save(update_fields=["status", "updated_at"])
            notify_order_status(order)
            run = stop.route_run
            if not run.stops.exclude(status=RouteStopStatus.DELIVERED).exists():
                run.status = RouteRunStatus.COMPLETED
                run.save(update_fields=["status", "updated_at"])
                route_plan = run.route_plan
                if not route_plan.runs.exclude(status=RouteRunStatus.COMPLETED).exists():
                    route_plan.status = RoutePlanStatus.COMPLETED
                    route_plan.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(stop).data)


def _capacity_error(run):
    vehicle = run.vehicle
    capacity_kg = vehicle.capacity_kg or 0
    capacity_m3 = vehicle.capacity_m3 or 0
    if capacity_kg and run.load_kg > capacity_kg:
        return f"El recorrido de {_run_label(run)} supera la capacidad en kg."
    if capacity_m3 and run.load_m3 > capacity_m3:
        return f"El recorrido de {_run_label(run)} supera la capacidad en m3."
    return ""


def _run_label(run):
    if run.driver_id:
        return run.driver.user.full_name
    return run.vehicle.plate

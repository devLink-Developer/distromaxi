from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import decorators, mixins, permissions, response, status, viewsets
from rest_framework.views import APIView

from apps.deliveries.models import Delivery, DeliveryStatus
from apps.notifications.services import notify_order_status, notify_user
from apps.orders.models import OrderStatus
from apps.inventory.services import commit_reserved_stock

from .engine import edit_route_plan, generate_route_plan
from .models import RoutePlan, RoutePlanStatus, RouteRun, RouteRunStatus, RouteStop, RouteStopStatus
from .serializers import CurrentRouteSerializer, RouteGenerateSerializer, RoutePlanEditSerializer, RoutePlanSerializer, RouteStopSerializer
from .services import get_routing_distributor, route_plan_delete_state


class RoutePlanViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = RoutePlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        distributor = get_routing_distributor(self.request.user)
        queryset = RoutePlan.objects.select_related("distributor").prefetch_related(
            "runs",
            "runs__driver",
            "runs__driver__user",
            "runs__vehicle",
            "runs__stops",
            "runs__stops__order",
            "runs__stops__order__commerce",
            "runs__stops__delivery",
        )
        dispatch_date = self.request.query_params.get("dispatch_date")
        queryset = queryset.filter(distributor=distributor)
        if dispatch_date:
            queryset = queryset.filter(dispatch_date=dispatch_date)
        return queryset

    def destroy(self, request, *args, **kwargs):
        route_plan = self.get_object()
        can_delete, reason = route_plan_delete_state(route_plan)
        if not can_delete:
            return response.Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            route_plan.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        serializer = RouteGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        distributor = get_routing_distributor(request.user)
        try:
            route_plan = generate_route_plan(
                distributor=distributor,
                dispatch_date=serializer.validated_data["dispatch_date"],
                generated_by=request.user,
                order_ids=serializer.validated_data.get("order_ids"),
                driver_ids=serializer.validated_data.get("driver_ids"),
                vehicle_ids=serializer.validated_data.get("vehicle_ids"),
            )
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(route_plan).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status not in {RoutePlanStatus.DRAFT, RoutePlanStatus.CONFIRMED}:
            return response.Response({"detail": "Solo se pueden confirmar planes en borrador."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for run in route_plan.runs.select_related("driver", "driver__user", "vehicle").prefetch_related("stops__order"):
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
                    if run.driver.user_id:
                        notify_user(
                            run.driver.user,
                            f"Entrega asignada #{delivery.id}",
                            f"Pedido #{stop.order_id} listo para reparto.",
                            "DELIVERY",
                            {"delivery_id": delivery.id, "order_id": stop.order_id},
                        )
            route_plan.status = RoutePlanStatus.CONFIRMED
            route_plan.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(route_plan).data)

    @decorators.action(detail=True, methods=["post"], url_path="edit")
    def edit(self, request, pk=None):
        route_plan = self.get_object()
        if route_plan.status in {RoutePlanStatus.DISPATCHED, RoutePlanStatus.COMPLETED, RoutePlanStatus.CANCELLED}:
            return response.Response({"detail": "Solo puedes editar rutas pendientes de despacho."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RoutePlanEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated = edit_route_plan(route_plan=route_plan, runs_payload=serializer.validated_data["runs"])
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
        distributor = get_routing_distributor(request.user)
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
        queryset = (
            RouteRun.objects.select_related("route_plan", "driver", "driver__user", "vehicle")
            .prefetch_related("stops", "stops__order", "stops__order__commerce", "stops__delivery")
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
        )
        user = self.request.user
        if user.role == "DRIVER" and hasattr(user, "driver_profile"):
            return queryset.filter(route_run__driver=user.driver_profile)
        distributor = get_routing_distributor(user)
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

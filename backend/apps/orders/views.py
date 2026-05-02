from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import decorators, response, status, viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor
from apps.inventory.services import commit_reserved_stock, release_reserved_stock
from apps.notifications.services import notify_order_status

from .models import Order, OrderStatus
from .serializers import OrderDecisionSerializer, OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        queryset = Order.objects.select_related("commerce", "distributor", "delivery", "delivery_slot").prefetch_related("items")
        user = self.request.user
        if user.role == "COMMERCE":
            return queryset.filter(commerce__user=user)
        if user.role == "DRIVER" and hasattr(user, "driver_profile"):
            return queryset.filter(delivery__driver=user.driver_profile)
        return filter_by_distributor(queryset, user)

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == "COMMERCE" and hasattr(user, "commerce_profile"):
            serializer.save(commerce=user.commerce_profile)
        elif user.role == "DISTRIBUTOR":
            serializer.save(distributor=get_user_distributor(user))
        else:
            serializer.save()

    @decorators.action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        if new_status not in OrderStatus.values:
            return response.Response({"detail": "Estado inválido."}, status=status.HTTP_400_BAD_REQUEST)
        previous_status = order.status
        order.status = new_status
        try:
            if new_status in {OrderStatus.CANCELLED, OrderStatus.REJECTED} and previous_status not in {OrderStatus.CANCELLED, OrderStatus.REJECTED}:
                release_reserved_stock(order)
            if new_status == OrderStatus.DELIVERED and previous_status != OrderStatus.DELIVERED:
                commit_reserved_stock(order)
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        order.save(update_fields=["status", "updated_at"])
        notify_order_status(order)
        return response.Response(self.get_serializer(order).data)

    @decorators.action(detail=True, methods=["patch"], url_path="decision")
    def decision(self, request, pk=None):
        if not (request.user.role == "DISTRIBUTOR" or request.user.role == "ADMIN" or request.user.is_superuser):
            return response.Response({"detail": "Solo la distribuidora puede aceptar o rechazar pedidos."}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        if order.status != OrderStatus.PENDING:
            return response.Response({"detail": "Solo se pueden aceptar o rechazar pedidos pendientes."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = OrderDecisionSerializer(data=request.data, context={"order": order})
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]
        try:
            with transaction.atomic():
                if decision == "REJECT":
                    release_reserved_stock(order)
                    order.status = OrderStatus.REJECTED
                    order.save(update_fields=["status", "updated_at"])
                else:
                    slot = serializer.validated_data["delivery_slot"]
                    order.status = OrderStatus.ACCEPTED
                    order.dispatch_date = serializer.validated_data["dispatch_date"]
                    order.delivery_slot = slot
                    order.delivery_window_start = slot.start_time
                    order.delivery_window_end = slot.end_time
                    order.save(
                        update_fields=[
                            "status",
                            "dispatch_date",
                            "delivery_slot",
                            "delivery_window_start",
                            "delivery_window_end",
                            "updated_at",
                        ]
                    )
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        notify_order_status(order)
        return response.Response(self.get_serializer(order).data)

# Create your views here.

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import decorators, response, status, viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor
from apps.inventory.services import commit_reserved_stock, release_reserved_stock
from apps.notifications.services import notify_order_status

from .models import Order, OrderStatus
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        queryset = Order.objects.select_related("commerce", "distributor", "delivery").prefetch_related("items")
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
            if new_status == OrderStatus.CANCELLED and previous_status != OrderStatus.CANCELLED:
                release_reserved_stock(order)
            if new_status == OrderStatus.DELIVERED and previous_status != OrderStatus.DELIVERED:
                commit_reserved_stock(order)
        except DjangoValidationError as exc:
            return response.Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        order.save(update_fields=["status", "updated_at"])
        notify_order_status(order)
        return response.Response(self.get_serializer(order).data)

# Create your views here.

from django.utils import timezone
from rest_framework import decorators, response, status, viewsets

from apps.distributors.utils import filter_by_distributor
from apps.fleet.models import DriverProfile
from apps.fleet.serializers import DriverProfileSerializer
from apps.notifications.services import notify_user
from apps.orders.models import OrderStatus

from .models import Delivery, DeliveryLocation, DeliveryStatus
from .serializers import DeliverySerializer


class DeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = DeliverySerializer

    def get_queryset(self):
        queryset = Delivery.objects.select_related(
            "order",
            "order__commerce",
            "order__distributor",
            "driver",
            "driver__user",
            "vehicle",
        ).prefetch_related("locations")
        user = self.request.user
        if user.role == "DRIVER" and hasattr(user, "driver_profile"):
            return queryset.filter(driver=user.driver_profile)
        return filter_by_distributor(queryset, user, "order__distributor")

    def perform_create(self, serializer):
        driver = serializer.validated_data["driver"]
        vehicle = serializer.validated_data.get("vehicle") or driver.assigned_vehicle
        delivery = serializer.save(vehicle=vehicle)
        delivery.order.status = OrderStatus.ON_THE_WAY
        delivery.order.save(update_fields=["status", "updated_at"])
        if delivery.driver.user_id:
            notify_user(
                delivery.driver.user,
                f"Entrega asignada #{delivery.id}",
                f"Pedido #{delivery.order_id} listo para reparto.",
                "DELIVERY",
                {"delivery_id": delivery.id, "order_id": delivery.order_id},
            )

    @decorators.action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        queryset = DriverProfile.objects.select_related("user", "assigned_vehicle")
        queryset = filter_by_distributor(queryset, request.user).filter(available=True, active=True)
        return response.Response(DriverProfileSerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["post", "patch"], url_path="location")
    def update_location(self, request, pk=None):
        delivery = self.get_object()
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")
        accuracy_m = request.data.get("accuracy_m")
        if latitude is None or longitude is None:
            return response.Response({"detail": "latitude y longitude son obligatorios."}, status=status.HTTP_400_BAD_REQUEST)
        DeliveryLocation.objects.create(
            delivery=delivery,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m or None,
        )
        delivery.last_latitude = latitude
        delivery.last_longitude = longitude
        delivery.last_accuracy_m = accuracy_m or None
        delivery.last_location_at = timezone.now()
        if delivery.status == DeliveryStatus.ASSIGNED:
            delivery.status = DeliveryStatus.ON_THE_WAY
        delivery.save(
            update_fields=[
                "last_latitude",
                "last_longitude",
                "last_accuracy_m",
                "last_location_at",
                "status",
                "updated_at",
            ]
        )
        return response.Response(self.get_serializer(delivery).data)

# Create your views here.

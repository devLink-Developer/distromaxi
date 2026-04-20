from rest_framework import serializers

from .models import Delivery, DeliveryLocation


class DeliveryLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryLocation
        fields = ["id", "latitude", "longitude", "accuracy_m", "recorded_at"]
        read_only_fields = ["id", "recorded_at"]


class DeliverySerializer(serializers.ModelSerializer):
    order_status = serializers.CharField(source="order.status", read_only=True)
    commerce_name = serializers.CharField(source="order.commerce.trade_name", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.plate", read_only=True)
    locations = DeliveryLocationSerializer(many=True, read_only=True)

    class Meta:
        model = Delivery
        fields = [
            "id",
            "order",
            "order_status",
            "commerce_name",
            "driver",
            "driver_name",
            "vehicle",
            "vehicle_plate",
            "status",
            "last_latitude",
            "last_longitude",
            "last_accuracy_m",
            "last_location_at",
            "locations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "last_location_at", "created_at", "updated_at"]
        extra_kwargs = {"vehicle": {"required": False}}

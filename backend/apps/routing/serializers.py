from rest_framework import serializers

from apps.deliveries.models import Delivery

from .models import RoutePlan, RouteRun, RouteStop
from .services import route_plan_delete_state


class RouteGenerateSerializer(serializers.Serializer):
    dispatch_date = serializers.DateField()
    order_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)
    driver_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)
    vehicle_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)


class RouteRunEditSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    stop_ids = serializers.ListField(child=serializers.IntegerField(), required=True)


class RoutePlanEditSerializer(serializers.Serializer):
    runs = RouteRunEditSerializer(many=True, allow_empty=False)


class RouteStopSerializer(serializers.ModelSerializer):
    order_status = serializers.CharField(source="order.status", read_only=True)
    commerce_name = serializers.CharField(source="order.commerce.trade_name", read_only=True)
    delivery_address = serializers.CharField(source="order.delivery_address", read_only=True)
    delivery_latitude = serializers.DecimalField(source="order.delivery_latitude", max_digits=10, decimal_places=7, read_only=True)
    delivery_longitude = serializers.DecimalField(source="order.delivery_longitude", max_digits=10, decimal_places=7, read_only=True)
    delivery_id = serializers.IntegerField(source="delivery.id", read_only=True, allow_null=True)

    class Meta:
        model = RouteStop
        fields = [
            "id",
            "order",
            "delivery_id",
            "order_status",
            "commerce_name",
            "delivery_address",
            "delivery_latitude",
            "delivery_longitude",
            "sequence",
            "status",
            "planned_eta",
            "window_start_at",
            "window_end_at",
            "leg_distance_km",
            "leg_duration_min",
            "demand_kg",
            "demand_m3",
        ]


class RouteRunSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.plate", read_only=True)
    stops = RouteStopSerializer(many=True, read_only=True)

    class Meta:
        model = RouteRun
        fields = [
            "id",
            "sequence",
            "status",
            "driver",
            "driver_name",
            "vehicle",
            "vehicle_plate",
            "total_stops",
            "total_distance_km",
            "total_duration_min",
            "load_kg",
            "load_m3",
            "stops",
        ]


class RoutePlanSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    runs = RouteRunSerializer(many=True, read_only=True)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = RoutePlan
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "dispatch_date",
            "status",
            "provider",
            "total_runs",
            "total_orders",
            "total_distance_km",
            "total_duration_min",
            "total_load_kg",
            "total_load_m3",
            "unassigned_summary",
            "can_delete",
            "runs",
            "created_at",
            "updated_at",
        ]

    def get_can_delete(self, obj):
        can_delete, _ = route_plan_delete_state(obj)
        return can_delete


class CurrentRouteSerializer(serializers.ModelSerializer):
    route_plan_id = serializers.IntegerField(source="route_plan.id", read_only=True)
    route_plan_status = serializers.CharField(source="route_plan.status", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True)
    vehicle_plate = serializers.CharField(source="vehicle.plate", read_only=True)
    stops = RouteStopSerializer(many=True, read_only=True)
    active_stop_id = serializers.SerializerMethodField()

    class Meta:
        model = RouteRun
        fields = [
            "id",
            "route_plan_id",
            "route_plan_status",
            "sequence",
            "status",
            "driver_name",
            "vehicle_plate",
            "total_stops",
            "total_distance_km",
            "total_duration_min",
            "load_kg",
            "load_m3",
            "active_stop_id",
            "stops",
        ]

    def get_active_stop_id(self, obj):
        active = obj.stops.filter(status__in=["PENDING", "ARRIVED"]).order_by("sequence").first()
        return active.id if active else None

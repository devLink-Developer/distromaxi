from rest_framework import serializers

from apps.deliveries.models import Delivery

from .models import RoutePlan, RouteRun, RouteStop, RouteStopLine
from .services import route_plan_delete_state


class RouteGenerateSerializer(serializers.Serializer):
    dispatch_date = serializers.DateField()
    delivery_slot_id = serializers.IntegerField(required=False, allow_null=True)
    order_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)
    driver_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)
    vehicle_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=False)
    vehicle_driver_ids = serializers.DictField(child=serializers.IntegerField(), required=False, allow_empty=True)


class ManualRouteRunSerializer(serializers.Serializer):
    vehicle_id = serializers.IntegerField()
    driver_id = serializers.IntegerField(required=False, allow_null=True)
    order_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)


class ManualRoutePlanSerializer(serializers.Serializer):
    dispatch_date = serializers.DateField()
    delivery_slot_id = serializers.IntegerField(required=False, allow_null=True)
    runs = ManualRouteRunSerializer(many=True, allow_empty=False)


class RouteConfirmSerializer(serializers.Serializer):
    reviewed = serializers.BooleanField(required=False, default=False)
    capacity_override_reason = serializers.CharField(required=False, allow_blank=True)


class RouteRunEditSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    stop_ids = serializers.ListField(child=serializers.IntegerField(), required=True)


class RoutePlanEditSerializer(serializers.Serializer):
    runs = RouteRunEditSerializer(many=True, allow_empty=False)


class RouteStopPatchItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    order_id = serializers.IntegerField(required=False)
    sequence = serializers.IntegerField(min_value=1)
    route_run_id = serializers.IntegerField(required=False)
    lat = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    lng = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs.get("id") and not attrs.get("order_id"):
            raise serializers.ValidationError("Envia id de parada existente u order_id para agregar una parada.")
        return attrs


class RouteStopsPatchSerializer(serializers.Serializer):
    stops = RouteStopPatchItemSerializer(many=True, allow_empty=True)
    remove_stop_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)


class RouteStopLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = RouteStopLine
        fields = [
            "id",
            "order_item",
            "product",
            "product_name",
            "sku",
            "quantity",
            "uom",
            "weight_kg",
            "volume_m3",
            "delivered_qty",
            "returned_qty",
            "difference_qty",
            "capacity_estimated",
        ]


class RouteStopSerializer(serializers.ModelSerializer):
    order_status = serializers.CharField(source="order.status", read_only=True)
    commerce_name = serializers.CharField(source="order.commerce.trade_name", read_only=True)
    delivery_address = serializers.CharField(source="order.delivery_address", read_only=True)
    delivery_latitude = serializers.DecimalField(source="latitude", max_digits=10, decimal_places=7, read_only=True)
    delivery_longitude = serializers.DecimalField(source="longitude", max_digits=10, decimal_places=7, read_only=True)
    delivery_id = serializers.IntegerField(source="delivery.id", read_only=True, allow_null=True)
    lat = serializers.DecimalField(source="latitude", max_digits=10, decimal_places=7, read_only=True)
    lng = serializers.DecimalField(source="longitude", max_digits=10, decimal_places=7, read_only=True)
    lines = RouteStopLineSerializer(many=True, read_only=True)

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
            "lat",
            "lng",
            "sequence",
            "status",
            "address_snapshot",
            "planned_eta",
            "window_start_at",
            "window_end_at",
            "leg_distance_km",
            "leg_duration_min",
            "demand_kg",
            "demand_m3",
            "lines",
        ]


class RouteRunSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()
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
            "route_geometry",
            "origin_snapshot",
            "stops",
        ]

    def get_driver_name(self, obj):
        return obj.driver.user.full_name if obj.driver_id else "Sin chofer asignado"


class RoutePlanSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    delivery_slot_name = serializers.CharField(source="delivery_slot.name", read_only=True, allow_null=True)
    runs = RouteRunSerializer(many=True, read_only=True)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = RoutePlan
        fields = [
            "id",
            "route_number",
            "distributor",
            "distributor_name",
            "dispatch_date",
            "delivery_slot",
            "delivery_slot_name",
            "delivery_window_start",
            "delivery_window_end",
            "status",
            "provider",
            "routing_status",
            "route_geometry",
            "preview_payload",
            "reviewed_at",
            "reviewed_by",
            "planning_version",
            "capacity_override_reason",
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
    driver_name = serializers.SerializerMethodField()
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

    def get_driver_name(self, obj):
        return obj.driver.user.full_name if obj.driver_id else "Sin chofer asignado"

    def get_active_stop_id(self, obj):
        active = obj.stops.filter(status__in=["PENDING", "ARRIVED"]).order_by("sequence").first()
        return active.id if active else None

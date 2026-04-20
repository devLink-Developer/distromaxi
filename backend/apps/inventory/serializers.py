from rest_framework import serializers

from .models import StockItem, StockMovement, Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = Warehouse
        fields = ["id", "distributor", "distributor_name", "name", "address", "active", "created_at"]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"distributor": {"required": False}}


class StockItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available_quantity = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)
    is_low = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id",
            "distributor",
            "warehouse",
            "warehouse_name",
            "product",
            "product_name",
            "sku",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "is_low",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at", "available_quantity", "is_low"]
        extra_kwargs = {"distributor": {"required": False}}


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "distributor",
            "warehouse",
            "product",
            "product_name",
            "order",
            "movement_type",
            "quantity",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

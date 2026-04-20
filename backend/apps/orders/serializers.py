from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.inventory.services import reserve_stock
from apps.products.models import Product

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "sku", "quantity", "price", "subtotal"]
        read_only_fields = ["id", "product_name", "sku", "price", "subtotal"]


class OrderLineInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))


class OrderSerializer(serializers.ModelSerializer):
    commerce_name = serializers.CharField(source="commerce.trade_name", read_only=True)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    line_items = OrderLineInputSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Order
        fields = [
            "id",
            "commerce",
            "commerce_name",
            "distributor",
            "distributor_name",
            "total",
            "status",
            "delivery_address",
            "delivery_latitude",
            "delivery_longitude",
            "notes",
            "items",
            "line_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total", "created_at", "updated_at"]
        extra_kwargs = {"commerce": {"required": False}, "distributor": {"required": False}}

    def validate(self, attrs):
        if self.instance is None and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "El pedido debe tener al menos un artículo."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        line_items = validated_data.pop("line_items", [])
        products = []
        total = Decimal("0")
        for line in line_items:
            product = Product.objects.select_related("distributor").get(pk=line["product_id"], active=True)
            products.append((product, line["quantity"]))
            if "distributor" not in validated_data:
                validated_data["distributor"] = product.distributor
            if product.distributor_id != validated_data["distributor"].id:
                raise serializers.ValidationError("Todos los productos deben ser de la misma distribuidora.")
            total += Decimal(product.price) * Decimal(line["quantity"])

        order = Order.objects.create(total=total, **validated_data)
        for product, quantity in products:
            try:
                reserve_stock(product, quantity, order)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"stock": exc.messages}) from exc
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                sku=product.sku,
                quantity=quantity,
                price=product.price,
                subtotal=Decimal(product.price) * Decimal(quantity),
            )
        return order

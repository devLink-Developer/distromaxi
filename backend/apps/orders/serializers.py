from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.distributors.utils import distributor_contains_point
from apps.distributors.models import DistributorDeliverySlot
from apps.inventory.services import reserve_stock
from apps.products.models import Product

from .models import Order, OrderItem
from .services import order_is_route_locked, order_route_lock_label


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "sku", "quantity", "price", "subtotal", "weight_kg", "volume_m3"]
        read_only_fields = ["id", "product_name", "sku", "price", "subtotal"]


class OrderLineInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))


class OrderSerializer(serializers.ModelSerializer):
    commerce_name = serializers.CharField(source="commerce.trade_name", read_only=True)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    delivery_slot_name = serializers.CharField(source="delivery_slot.name", read_only=True, allow_null=True)
    delivery_slot_start_time = serializers.TimeField(source="delivery_slot.start_time", read_only=True, allow_null=True)
    delivery_slot_end_time = serializers.TimeField(source="delivery_slot.end_time", read_only=True, allow_null=True)
    items = OrderItemSerializer(many=True, read_only=True)
    line_items = OrderLineInputSerializer(many=True, write_only=True, required=False)
    route_locked = serializers.SerializerMethodField()
    route_lock_label = serializers.SerializerMethodField()

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
            "dispatch_date",
            "delivery_slot",
            "delivery_slot_name",
            "delivery_slot_start_time",
            "delivery_slot_end_time",
            "delivery_address",
            "delivery_latitude",
            "delivery_longitude",
            "delivery_window_start",
            "delivery_window_end",
            "notes",
            "items",
            "line_items",
            "route_locked",
            "route_lock_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total", "created_at", "updated_at"]
        extra_kwargs = {"commerce": {"required": False}, "distributor": {"required": False}}

    def get_route_locked(self, obj):
        return order_is_route_locked(obj)

    def get_route_lock_label(self, obj):
        return order_route_lock_label(obj)

    def validate(self, attrs):
        if self.instance is None and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "El pedido debe tener al menos un articulo."})
        start = attrs.get("delivery_window_start", getattr(self.instance, "delivery_window_start", None))
        end = attrs.get("delivery_window_end", getattr(self.instance, "delivery_window_end", None))
        if start and end and start > end:
            raise serializers.ValidationError({"delivery_window_end": "La franja horaria es invalida."})
        delivery_slot = attrs.get("delivery_slot")
        if delivery_slot is not None:
            distributor = attrs.get("distributor", getattr(self.instance, "distributor", None))
            if distributor is not None and delivery_slot.distributor_id != distributor.id:
                raise serializers.ValidationError({"delivery_slot": "La franja no pertenece a la distribuidora del pedido."})
            if not delivery_slot.active:
                raise serializers.ValidationError({"delivery_slot": "Selecciona una franja activa."})
        if self.instance is None:
            request = self.context.get("request")
            commerce = attrs.get("commerce")
            if commerce is None and getattr(getattr(request, "user", None), "role", None) == "COMMERCE" and hasattr(request.user, "commerce_profile"):
                commerce = request.user.commerce_profile
            delivery_address = attrs.get("delivery_address") or getattr(commerce, "address", "")
            delivery_latitude = attrs.get("delivery_latitude", getattr(commerce, "latitude", None))
            delivery_longitude = attrs.get("delivery_longitude", getattr(commerce, "longitude", None))
            if not delivery_address or delivery_latitude is None or delivery_longitude is None:
                raise serializers.ValidationError(
                    {"delivery_address": "Debes guardar y geolocalizar la direccion del cliente antes de generar un pedido."}
                )
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

        if "dispatch_date" not in validated_data:
            validated_data["dispatch_date"] = timezone.localdate() + timedelta(days=1)

        request = self.context.get("request")
        commerce = validated_data.get("commerce")
        if commerce is None and getattr(getattr(request, "user", None), "role", None) == "COMMERCE" and hasattr(request.user, "commerce_profile"):
            commerce = request.user.commerce_profile
        if commerce is not None:
            validated_data.setdefault("delivery_address", commerce.address)
            validated_data.setdefault("delivery_latitude", commerce.latitude)
            validated_data.setdefault("delivery_longitude", commerce.longitude)
            validated_data.setdefault("delivery_window_start", commerce.default_window_start)
            validated_data.setdefault("delivery_window_end", commerce.default_window_end)
        if getattr(getattr(request, "user", None), "role", None) == "COMMERCE":
            distributor = validated_data.get("distributor")
            if commerce is None or distributor is None or not distributor_contains_point(distributor, commerce.latitude, commerce.longitude):
                raise serializers.ValidationError({"distributor": "La distribuidora no entrega en la direccion del cliente."})
        delivery_slot = validated_data.get("delivery_slot")
        if delivery_slot is not None:
            validated_data["delivery_window_start"] = delivery_slot.start_time
            validated_data["delivery_window_end"] = delivery_slot.end_time

        order = Order.objects.create(total=total, **validated_data)
        for product, quantity in products:
            try:
                reserve_stock(product, quantity, order)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"stock": exc.messages}) from exc
            quantity_decimal = Decimal(str(quantity))
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                sku=product.sku,
                quantity=quantity,
                price=product.price,
                subtotal=Decimal(product.price) * quantity_decimal,
                weight_kg=weight_total_kg(product, quantity_decimal),
                volume_m3=volume_total_m3(product, quantity_decimal),
            )
        return order

    def update(self, instance, validated_data):
        delivery_slot = validated_data.get("delivery_slot")
        if delivery_slot is not None:
            validated_data["delivery_window_start"] = delivery_slot.start_time
            validated_data["delivery_window_end"] = delivery_slot.end_time
        return super().update(instance, validated_data)


class OrderDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["ACCEPT", "REJECT"])
    dispatch_date = serializers.DateField(required=False)
    delivery_slot_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["decision"] == "ACCEPT":
            if not attrs.get("dispatch_date"):
                raise serializers.ValidationError({"dispatch_date": "La fecha de entrega es obligatoria."})
            if not attrs.get("delivery_slot_id"):
                raise serializers.ValidationError({"delivery_slot_id": "Selecciona una franja horaria."})
            order = self.context["order"]
            try:
                slot = DistributorDeliverySlot.objects.get(
                    pk=attrs["delivery_slot_id"],
                    distributor=order.distributor,
                    active=True,
                )
            except DistributorDeliverySlot.DoesNotExist as exc:
                raise serializers.ValidationError({"delivery_slot_id": "Selecciona una franja activa de la distribuidora."}) from exc
            attrs["delivery_slot"] = slot
        return attrs


def weight_total_kg(product, quantity):
    factor = Decimal("0.001") if product.weight_unit == "g" else Decimal("1")
    return (Decimal(product.weight) * factor * quantity).quantize(Decimal("0.001"))


def volume_total_m3(product, quantity):
    unit_factor = {
        "mm": Decimal("0.001"),
        "cm": Decimal("0.01"),
        "m": Decimal("1"),
    }[product.dimension_unit]
    length_m = Decimal(product.length) * unit_factor
    width_m = Decimal(product.width) * unit_factor
    height_m = Decimal(product.height) * unit_factor
    return (length_m * width_m * height_m * quantity).quantize(Decimal("0.000001"))

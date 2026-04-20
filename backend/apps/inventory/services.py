from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction

from .models import StockItem, StockMovement, StockMovementType, Warehouse


def ensure_default_warehouse(distributor):
    warehouse, _ = Warehouse.objects.get_or_create(
        distributor=distributor,
        name="Depósito principal",
        defaults={"address": distributor.address},
    )
    return warehouse


def get_or_create_stock_item(product, warehouse=None):
    warehouse = warehouse or ensure_default_warehouse(product.distributor)
    stock_item, _ = StockItem.objects.get_or_create(
        distributor=product.distributor,
        warehouse=warehouse,
        product=product,
    )
    return stock_item


@transaction.atomic
def adjust_stock(product, quantity, movement_type=StockMovementType.ADJUSTMENT, note="", warehouse=None):
    quantity = Decimal(str(quantity))
    stock_item = get_or_create_stock_item(product, warehouse)
    stock_item.quantity = quantity if movement_type == StockMovementType.ADJUSTMENT else stock_item.quantity + quantity
    if stock_item.quantity < 0:
        raise ValidationError("El stock no puede quedar negativo.")
    stock_item.save(update_fields=["quantity", "updated_at"])
    StockMovement.objects.create(
        distributor=product.distributor,
        warehouse=stock_item.warehouse,
        product=product,
        movement_type=movement_type,
        quantity=quantity,
        note=note,
    )
    return stock_item


@transaction.atomic
def reserve_stock(product, quantity, order=None):
    quantity = Decimal(str(quantity))
    stock_item = (
        StockItem.objects.select_for_update()
        .filter(distributor=product.distributor, product=product)
        .order_by("warehouse_id")
        .first()
    )
    if stock_item is None or stock_item.available_quantity < quantity:
        raise ValidationError(f"Stock insuficiente para {product.name}.")
    stock_item.reserved_quantity += quantity
    stock_item.save(update_fields=["reserved_quantity", "updated_at"])
    StockMovement.objects.create(
        distributor=product.distributor,
        warehouse=stock_item.warehouse,
        product=product,
        order=order,
        movement_type=StockMovementType.RESERVED,
        quantity=quantity,
        note="Reserva por pedido",
    )
    return stock_item


@transaction.atomic
def release_reserved_stock(order):
    for item in order.items.select_related("product"):
        stock_item = (
            StockItem.objects.select_for_update()
            .filter(distributor=order.distributor, product=item.product)
            .order_by("warehouse_id")
            .first()
        )
        if not stock_item:
            continue
        quantity = min(stock_item.reserved_quantity, item.quantity)
        stock_item.reserved_quantity -= quantity
        stock_item.save(update_fields=["reserved_quantity", "updated_at"])
        StockMovement.objects.create(
            distributor=order.distributor,
            warehouse=stock_item.warehouse,
            product=item.product,
            order=order,
            movement_type=StockMovementType.RELEASED,
            quantity=quantity,
            note="Pedido cancelado",
        )


@transaction.atomic
def commit_reserved_stock(order):
    for item in order.items.select_related("product"):
        stock_item = (
            StockItem.objects.select_for_update()
            .filter(distributor=order.distributor, product=item.product)
            .order_by("warehouse_id")
            .first()
        )
        if not stock_item:
            continue
        stock_item.quantity -= item.quantity
        stock_item.reserved_quantity = max(Decimal("0"), stock_item.reserved_quantity - item.quantity)
        if stock_item.quantity < 0:
            raise ValidationError(f"Stock negativo para {item.product_name}.")
        stock_item.save(update_fields=["quantity", "reserved_quantity", "updated_at"])
        StockMovement.objects.create(
            distributor=order.distributor,
            warehouse=stock_item.warehouse,
            product=item.product,
            order=order,
            movement_type=StockMovementType.OUT,
            quantity=item.quantity,
            note="Pedido entregado",
        )

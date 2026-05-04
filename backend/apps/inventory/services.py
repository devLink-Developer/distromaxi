from datetime import timedelta
from decimal import Decimal, ROUND_CEILING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

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


def stock_health_summary(distributor, *, days=30):
    try:
        days = max(1, int(days or 30))
    except (TypeError, ValueError):
        days = 30
    sold_by_product = _recent_sales_by_product(distributor, days)
    rows = [
        _stock_health_row(item, sold_by_product.get(item.product_id, Decimal("0")), days)
        for item in StockItem.objects.filter(distributor=distributor)
        .select_related("warehouse", "product", "product__supplier", "product__product_category", "product__product_subcategory")
        .order_by("product__name", "warehouse__name")
    ]
    return {
        "kpis": {
            "total_skus": len(rows),
            "out_of_stock": sum(1 for row in rows if row["urgency"] == "out_of_stock"),
            "low_stock": sum(1 for row in rows if row["urgency"] in {"out_of_stock", "critical", "warning"}),
            "reserved_units": _decimal_string(sum((Decimal(row["reserved_quantity"]) for row in rows), start=Decimal("0"))),
            "suggested_skus": sum(1 for row in rows if Decimal(row["recommended_qty"]) > 0),
            "suggested_units": _decimal_string(sum((Decimal(row["recommended_qty"]) for row in rows), start=Decimal("0"))),
        },
        "rows": rows,
    }


def replenishment_suggestions(distributor, *, days=30):
    summary = stock_health_summary(distributor, days=days)
    urgency_order = {"out_of_stock": 0, "critical": 1, "warning": 2, "low": 3, "ok": 4}
    rows = [row for row in summary["rows"] if Decimal(row["recommended_qty"]) > 0 or row["urgency"] in {"out_of_stock", "critical"}]
    return sorted(rows, key=lambda row: (urgency_order.get(row["urgency"], 9), row["supplier_name"] or "", row["product_name"]))


@transaction.atomic
def cycle_count_stock(stock_item, counted_quantity, *, note=""):
    counted_quantity = Decimal(str(counted_quantity))
    if counted_quantity < 0:
        raise ValidationError("La cantidad contada no puede ser negativa.")
    stock_item = StockItem.objects.select_for_update().select_related("product", "warehouse").get(pk=stock_item.pk)
    previous_quantity = Decimal(stock_item.quantity)
    difference = counted_quantity - previous_quantity
    stock_item.quantity = counted_quantity
    stock_item.save(update_fields=["quantity", "updated_at"])
    StockMovement.objects.create(
        distributor=stock_item.distributor,
        warehouse=stock_item.warehouse,
        product=stock_item.product,
        movement_type=StockMovementType.ADJUSTMENT,
        quantity=difference,
        note=note or "Conteo ciclico",
    )
    return stock_item, difference


def _recent_sales_by_product(distributor, days):
    from apps.orders.models import OrderItem, OrderStatus

    since = timezone.now() - timedelta(days=days)
    rows = (
        OrderItem.objects.filter(
            order__distributor=distributor,
            order__status=OrderStatus.DELIVERED,
            order__updated_at__gte=since,
        )
        .values("product_id")
        .annotate(quantity=Sum("quantity"))
    )
    return {row["product_id"]: row["quantity"] or Decimal("0") for row in rows}


def _stock_health_row(item, sold_quantity, days):
    product = item.product
    supplier = product.supplier
    lead_time_days = int(getattr(supplier, "lead_time_days", 0) or 0)
    daily_sales = (Decimal(sold_quantity) / Decimal(days)).quantize(Decimal("0.001"))
    coverage_days = None if daily_sales <= 0 else Decimal(item.available_quantity / daily_sales).quantize(Decimal("0.1"))
    target_stock = _target_stock(product, daily_sales, lead_time_days)
    recommended_qty = max(Decimal("0"), target_stock - Decimal(item.available_quantity))
    recommended_qty = _round_to_multiple(recommended_qty, Decimal(product.replenishment_multiple or 0))
    urgency = _stock_urgency(item, recommended_qty, coverage_days, lead_time_days)
    return {
        "id": item.id,
        "stock_item_id": item.id,
        "warehouse": item.warehouse_id,
        "warehouse_name": item.warehouse.name,
        "product": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "supplier": supplier.id if supplier else None,
        "supplier_name": supplier.name if supplier else "",
        "category": product.product_category_id,
        "category_name": getattr(product.product_category, "name", "") or product.category,
        "subcategory_name": getattr(product.product_subcategory, "name", "") or product.subcategory,
        "unit": product.unit,
        "quantity": _decimal_string(item.quantity),
        "reserved_quantity": _decimal_string(item.reserved_quantity),
        "available_quantity": _decimal_string(item.available_quantity),
        "stock_minimum": _decimal_string(product.stock_minimum),
        "stock_target": _decimal_string(target_stock),
        "replenishment_multiple": _decimal_string(product.replenishment_multiple),
        "sold_30d": _decimal_string(sold_quantity),
        "daily_sales": _decimal_string(daily_sales),
        "coverage_days": None if coverage_days is None else str(coverage_days),
        "lead_time_days": lead_time_days,
        "recommended_qty": _decimal_string(recommended_qty),
        "urgency": urgency,
        "reason": _stock_reason(item, recommended_qty, coverage_days, lead_time_days, urgency),
        "is_low": item.is_low,
        "updated_at": item.updated_at.isoformat(),
    }


def _target_stock(product, daily_sales, lead_time_days):
    explicit_target = Decimal(product.stock_target or 0)
    if explicit_target > 0:
        return explicit_target.quantize(Decimal("0.001"))
    stock_minimum = Decimal(product.stock_minimum or 0)
    lead_time_demand = daily_sales * Decimal(lead_time_days)
    if stock_minimum > 0:
        return max(stock_minimum * Decimal("2"), stock_minimum + lead_time_demand).quantize(Decimal("0.001"))
    if daily_sales > 0:
        return (daily_sales * Decimal(max(lead_time_days, 7))).quantize(Decimal("0.001"))
    return Decimal("0.000")


def _round_to_multiple(quantity, multiple):
    if quantity <= 0:
        return Decimal("0.000")
    if multiple <= 0:
        return quantity.quantize(Decimal("0.001"))
    multiplier = (quantity / multiple).to_integral_value(rounding=ROUND_CEILING)
    return (multiplier * multiple).quantize(Decimal("0.001"))


def _stock_urgency(item, recommended_qty, coverage_days, lead_time_days):
    if item.available_quantity <= 0:
        return "out_of_stock"
    if item.is_low:
        return "critical"
    if coverage_days is not None and lead_time_days > 0 and coverage_days <= Decimal(lead_time_days + 3):
        return "warning"
    if recommended_qty > 0:
        return "low"
    return "ok"


def _stock_reason(item, recommended_qty, coverage_days, lead_time_days, urgency):
    if urgency == "out_of_stock":
        return "Sin disponible para venta."
    if urgency == "critical":
        return "Disponible por debajo del minimo configurado."
    if urgency == "warning":
        return f"Cobertura menor o igual al plazo de reposicion ({lead_time_days} dias)."
    if recommended_qty > 0:
        return "Conviene reponer para llegar al stock objetivo."
    if coverage_days is None:
        return "Sin ventas recientes para proyectar cobertura."
    return "Stock dentro del objetivo."


def _decimal_string(value):
    return str(Decimal(value or 0).quantize(Decimal("0.001")))


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

import csv
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commerces.models import Commerce
from apps.deliveries.models import Delivery
from apps.distributors.models import Distributor
from apps.distributors.utils import get_user_distributor
from apps.inventory.models import StockItem
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.products.models import Product

ZERO = Decimal("0")


class DashboardMixin:
    def distributor(self, request):
        if request.user.role == "ADMIN" and request.query_params.get("distributor_id"):
            return Distributor.objects.filter(pk=request.query_params["distributor_id"]).first()
        return get_user_distributor(request.user)

    def parse_filters(self, request):
        today = timezone.localdate()
        start = self._parse_date(request.query_params.get("date_from")) or today.replace(day=1)
        end = self._parse_date(request.query_params.get("date_to")) or today
        if end < start:
            start, end = end, start
        granularity = request.query_params.get("granularity", "day")
        if granularity not in {"day", "week", "month"}:
            granularity = "day"
        return {
            "date_from": start,
            "date_to": end,
            "granularity": granularity,
            "zone": request.query_params.get("zone", ""),
        }

    def _parse_date(self, value):
        if not value:
            return None
        try:
            return timezone.datetime.fromisoformat(value).date()
        except ValueError:
            return None

    def orders(self, distributor, filters):
        queryset = Order.objects.filter(
            distributor=distributor,
            created_at__date__gte=filters["date_from"],
            created_at__date__lte=filters["date_to"],
        ).select_related("commerce", "distributor")
        if filters["zone"]:
            queryset = queryset.filter(Q(commerce__city__icontains=filters["zone"]) | Q(commerce__province__icontains=filters["zone"]))
        return queryset

    def order_items(self, orders):
        return OrderItem.objects.filter(order__in=orders).select_related("order", "product", "order__commerce")

    def money(self, value):
        return float(value or ZERO)

    def percent(self, value):
        return round(float(value or ZERO), 2)

    def export_if_requested(self, request, rows, filename, headers):
        fmt = request.query_params.get("format")
        if fmt not in {"csv", "xls"}:
            return None
        if fmt == "xls":
            response = HttpResponse(content_type="application/vnd.ms-excel; charset=utf-8")
            response["Content-Disposition"] = f'attachment; filename="{filename}.xls"'
            writer = csv.writer(response, delimiter="\t")
        else:
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
            writer = csv.writer(response)
        writer.writerow([label for _, label in headers])
        for row in rows:
            writer.writerow([row.get(key, "") for key, _ in headers])
        return response

    def scoped_response(self, request, callback):
        distributor = self.distributor(request)
        if not distributor:
            return Response({"detail": "Distribuidora no disponible."}, status=status.HTTP_400_BAD_REQUEST)
        filters = self.parse_filters(request)
        return callback(distributor, filters)


class DashboardSummaryView(DashboardMixin, APIView):
    def get(self, request):
        return self.scoped_response(request, self.build)

    def build(self, distributor, filters):
        orders = self.orders(distributor, filters)
        valid_orders = orders.exclude(status=OrderStatus.CANCELLED)
        today = timezone.localdate()
        month_start = today.replace(day=1)
        today_orders = Order.objects.filter(distributor=distributor, created_at__date=today).exclude(status=OrderStatus.CANCELLED)
        month_orders = Order.objects.filter(
            distributor=distributor,
            created_at__date__gte=month_start,
            created_at__date__lte=today,
        ).exclude(status=OrderStatus.CANCELLED)
        period_sales = valid_orders.aggregate(value=Coalesce(Sum("total"), ZERO, output_field=DecimalField()))["value"]
        period_count = valid_orders.count()
        active_customers = valid_orders.values("commerce_id").distinct().count()
        low_stock_count = StockItem.objects.filter(distributor=distributor).select_related("product")
        low_stock_count = sum(1 for item in low_stock_count if item.is_low)
        repeat_customers = (
            valid_orders.values("commerce_id")
            .annotate(order_count=Count("id"))
            .filter(order_count__gt=1)
            .count()
        )
        margin_amount = gross_margin(self.order_items(valid_orders))

        delta_days = (filters["date_to"] - filters["date_from"]).days + 1
        previous_end = filters["date_from"] - timedelta(days=1)
        previous_start = previous_end - timedelta(days=delta_days - 1)
        previous_sales = (
            Order.objects.filter(
                distributor=distributor,
                created_at__date__gte=previous_start,
                created_at__date__lte=previous_end,
            )
            .exclude(status=OrderStatus.CANCELLED)
            .aggregate(value=Coalesce(Sum("total"), ZERO, output_field=DecimalField()))["value"]
        )

        return Response(
            {
                "filters": serialize_filters(filters),
                "kpis": {
                    "sales_today": self.money(today_orders.aggregate(value=Coalesce(Sum("total"), ZERO, output_field=DecimalField()))["value"]),
                    "sales_month": self.money(month_orders.aggregate(value=Coalesce(Sum("total"), ZERO, output_field=DecimalField()))["value"]),
                    "sales_period": self.money(period_sales),
                    "sales_previous_period": self.money(previous_sales),
                    "orders": period_count,
                    "avg_ticket": self.money(period_sales / period_count if period_count else ZERO),
                    "gross_margin_percent": self.percent((margin_amount / period_sales) * 100 if period_sales else ZERO),
                    "gross_margin_amount": self.money(margin_amount),
                    "active_customers": active_customers,
                    "repurchase_rate": self.percent((Decimal(repeat_customers) / Decimal(active_customers)) * 100 if active_customers else ZERO),
                    "low_stock_count": low_stock_count,
                },
                "pipeline": status_pipeline(valid_orders),
            }
        )


class DashboardSalesView(DashboardMixin, APIView):
    def get(self, request):
        return self.scoped_response(request, lambda distributor, filters: self.build(request, distributor, filters))

    def build(self, request, distributor, filters):
        orders = self.orders(distributor, filters).exclude(status=OrderStatus.CANCELLED)
        trunc = {"day": TruncDay, "week": TruncWeek, "month": TruncMonth}[filters["granularity"]]
        series = [
            {"period": row["period"].date().isoformat(), "sales": self.money(row["sales"]), "orders": row["orders"]}
            for row in orders.annotate(period=trunc("created_at"))
            .values("period")
            .annotate(sales=Coalesce(Sum("total"), ZERO, output_field=DecimalField()), orders=Count("id"))
            .order_by("period")
        ]
        items = self.order_items(orders)
        by_category = [
            {
                "name": row["product__category"] or "Sin categoría",
                "sales": self.money(row["sales"]),
                "units": self.money(row["units"]),
            }
            for row in items.values("product__category")
            .annotate(sales=Coalesce(Sum("subtotal"), ZERO, output_field=DecimalField()), units=Coalesce(Sum("quantity"), ZERO, output_field=DecimalField()))
            .order_by("-sales")[:8]
        ]
        top_products = product_mix(items, "-sales")[:8]
        bottom_products = product_mix(items, "sales")[:8]
        by_zone = [
            {"name": row["commerce__city"] or row["commerce__province"] or "Sin zona", "sales": self.money(row["sales"])}
            for row in orders.values("commerce__city", "commerce__province")
            .annotate(sales=Coalesce(Sum("total"), ZERO, output_field=DecimalField()))
            .order_by("-sales")[:8]
        ]
        rows = series
        exported = self.export_if_requested(request, rows, "dashboard_sales", [("period", "Periodo"), ("sales", "Ventas"), ("orders", "Pedidos")])
        if exported:
            return exported
        return Response({"series": series, "by_category": by_category, "top_products": top_products, "bottom_products": bottom_products, "by_zone": by_zone})


class DashboardCustomersView(DashboardMixin, APIView):
    def get(self, request):
        return self.scoped_response(request, lambda distributor, filters: self.build(request, distributor, filters))

    def build(self, request, distributor, filters):
        orders = self.orders(distributor, filters).exclude(status=OrderStatus.CANCELLED)
        ranking = [
            {
                "id": row["commerce_id"],
                "name": row["commerce__trade_name"],
                "revenue": self.money(row["revenue"]),
                "orders": row["orders"],
                "frequency": round(float(row["orders"]), 2),
            }
            for row in orders.values("commerce_id", "commerce__trade_name")
            .annotate(revenue=Coalesce(Sum("total"), ZERO, output_field=DecimalField()), orders=Count("id"))
            .order_by("-revenue")[:20]
        ]
        all_customers = Commerce.objects.filter(distributor=distributor, active=True)
        new_customers = all_customers.filter(created_at__date__gte=filters["date_from"], created_at__date__lte=filters["date_to"]).count()
        active_ids = set(orders.values_list("commerce_id", flat=True).distinct())
        previous_ids = set(
            Order.objects.filter(distributor=distributor, created_at__date__lt=filters["date_from"])
            .exclude(status=OrderStatus.CANCELLED)
            .values_list("commerce_id", flat=True)
            .distinct()
        )
        recurrent = len(active_ids & previous_ids)
        inactive = all_customers.exclude(id__in=active_ids).count()
        cohorts = [
            {"name": "Nuevos", "value": new_customers},
            {"name": "Recurrentes", "value": recurrent},
            {"name": "Inactivos", "value": inactive},
        ]
        exported = self.export_if_requested(request, ranking, "dashboard_customers", [("name", "Cliente"), ("revenue", "Ingresos"), ("orders", "Pedidos"), ("frequency", "Frecuencia")])
        if exported:
            return exported
        return Response({"ranking": ranking, "portfolio": cohorts, "retention": {"active": len(active_ids), "recurrent": recurrent, "inactive": inactive}})


class DashboardProductsView(DashboardMixin, APIView):
    def get(self, request):
        return self.scoped_response(request, lambda distributor, filters: self.build(request, distributor, filters))

    def build(self, request, distributor, filters):
        orders = self.orders(distributor, filters).exclude(status=OrderStatus.CANCELLED)
        items = self.order_items(orders)
        products = product_mix(items, "-sales")[:20]
        bottom = product_mix(items, "sales")[:10]
        stock = StockItem.objects.filter(distributor=distributor).select_related("product", "warehouse")
        coverage = [
            {
                "sku": item.product.sku,
                "name": item.product.name,
                "available": float(item.available_quantity),
                "reserved": float(item.reserved_quantity),
                "days_inventory": inventory_days(item, items),
                "low_stock": item.is_low,
            }
            for item in stock.order_by("product__name")[:50]
        ]
        breaks = [row for row in coverage if row["low_stock"] or row["available"] <= 0]
        exported = self.export_if_requested(request, products, "dashboard_products", [("sku", "SKU"), ("name", "Producto"), ("sales", "Ingresos"), ("units", "Unidades"), ("margin", "Margen")])
        if exported:
            return exported
        return Response({"top_skus": products[:10], "bottom_skus": bottom, "rotation": coverage, "stock_breaks": breaks})


class DashboardOperationsView(DashboardMixin, APIView):
    def get(self, request):
        return self.scoped_response(request, lambda distributor, filters: self.build(request, distributor, filters))

    def build(self, request, distributor, filters):
        orders = self.orders(distributor, filters)
        deliveries = Delivery.objects.filter(order__in=orders).select_related("driver", "driver__user", "order")
        delivered = deliveries.filter(status="DELIVERED").count()
        cancelled = orders.filter(status=OrderStatus.CANCELLED).count()
        pipeline = status_pipeline(orders)
        rider_rows = [
            {
                "name": row["driver__user__full_name"],
                "deliveries": row["deliveries"],
                "delivered": row["delivered"],
                "active": row["active"],
            }
            for row in deliveries.values("driver__user__full_name")
            .annotate(
                deliveries=Count("id"),
                delivered=Count("id", filter=Q(status="DELIVERED")),
                active=Count("id", filter=Q(status__in=["ASSIGNED", "PICKED_UP", "ON_THE_WAY"])),
            )
            .order_by("-delivered")
        ]
        metrics = {
            "delivery_count": deliveries.count(),
            "delivered": delivered,
            "delivered_percent": self.percent((Decimal(delivered) / Decimal(deliveries.count())) * 100 if deliveries.count() else ZERO),
            "cancellations": cancelled,
            "active_deliveries": deliveries.filter(status__in=["ASSIGNED", "PICKED_UP", "ON_THE_WAY"]).count(),
        }
        exported = self.export_if_requested(request, rider_rows, "dashboard_operations", [("name", "Chofer"), ("deliveries", "Entregas"), ("delivered", "Entregadas"), ("active", "Activas")])
        if exported:
            return exported
        return Response({"pipeline": pipeline, "metrics": metrics, "riders": rider_rows})


def serialize_filters(filters):
    return {
        **filters,
        "date_from": filters["date_from"].isoformat(),
        "date_to": filters["date_to"].isoformat(),
    }


def gross_margin(items):
    expression = ExpressionWrapper(
        (F("price") - F("product__cost")) * F("quantity"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    return items.aggregate(value=Coalesce(Sum(expression), ZERO, output_field=DecimalField()))["value"] or ZERO


def product_mix(items, ordering):
    margin_expression = ExpressionWrapper(
        (F("price") - F("product__cost")) * F("quantity"),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )
    rows = (
        items.values("product_id", "product__sku", "product_name", "product__category")
        .annotate(
            sales=Coalesce(Sum("subtotal"), ZERO, output_field=DecimalField()),
            units=Coalesce(Sum("quantity"), ZERO, output_field=DecimalField()),
            margin=Coalesce(Sum(margin_expression), ZERO, output_field=DecimalField()),
        )
        .order_by(ordering)
    )
    return [
        {
            "id": row["product_id"],
            "sku": row["product__sku"],
            "name": row["product_name"],
            "category": row["product__category"],
            "sales": float(row["sales"] or ZERO),
            "units": float(row["units"] or ZERO),
            "margin": float(row["margin"] or ZERO),
        }
        for row in rows
    ]


def status_pipeline(orders):
    counts = {status: 0 for status, _ in OrderStatus.choices}
    for row in orders.values("status").annotate(count=Count("id")):
        counts[row["status"]] = row["count"]
    return [{"status": key, "count": value} for key, value in counts.items()]


def inventory_days(stock_item, items):
    sold = (
        items.filter(product=stock_item.product)
        .aggregate(units=Coalesce(Sum("quantity"), ZERO, output_field=DecimalField()))["units"]
        or ZERO
    )
    if sold <= 0:
        return 0
    return round(float(stock_item.available_quantity / sold * Decimal("30")), 1)

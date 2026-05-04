from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import decorators, response, status, viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import StockItem, StockMovement, Warehouse
from .serializers import StockItemSerializer, StockMovementSerializer, WarehouseSerializer
from .services import cycle_count_stock, replenishment_suggestions, stock_health_summary


class WarehouseViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseSerializer

    def get_queryset(self):
        return filter_by_distributor(Warehouse.objects.select_related("distributor"), self.request.user)

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)


class StockItemViewSet(viewsets.ModelViewSet):
    serializer_class = StockItemSerializer

    def get_queryset(self):
        queryset = StockItem.objects.select_related("distributor", "warehouse", "product")
        product = self.request.query_params.get("product")
        if product:
            queryset = queryset.filter(product_id=product)
        return filter_by_distributor(queryset, self.request.user)

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

    @decorators.action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        distributor = get_user_distributor(request.user)
        if distributor is None and not (request.user.role == "ADMIN" or request.user.is_superuser):
            return response.Response({"kpis": _empty_stock_kpis(), "rows": []})
        if distributor is None:
            distributor_id = request.query_params.get("distributor")
            if not distributor_id:
                return response.Response({"kpis": _empty_stock_kpis(), "rows": []})
            distributor = distributor_id
        return response.Response(stock_health_summary(distributor, days=request.query_params.get("days", 30)))

    @decorators.action(detail=False, methods=["get"], url_path="replenishment")
    def replenishment(self, request):
        distributor = get_user_distributor(request.user)
        if distributor is None and not (request.user.role == "ADMIN" or request.user.is_superuser):
            return response.Response([])
        if distributor is None:
            distributor = request.query_params.get("distributor")
            if not distributor:
                return response.Response([])
        return response.Response(replenishment_suggestions(distributor, days=request.query_params.get("days", 30)))

    @decorators.action(detail=True, methods=["post"], url_path="cycle-count")
    def cycle_count(self, request, pk=None):
        stock_item = self.get_object()
        counted_quantity = request.data.get("counted_quantity")
        if counted_quantity in (None, ""):
            return response.Response(
                {"counted_quantity": "La cantidad contada es obligatoria."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated_stock_item, difference = cycle_count_stock(
                stock_item,
                counted_quantity,
                note=request.data.get("note", ""),
            )
        except (DjangoValidationError, ValueError, InvalidOperation) as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(
            {
                "stock_item": StockItemSerializer(updated_stock_item, context=self.get_serializer_context()).data,
                "difference": str(Decimal(difference).quantize(Decimal("0.001"))),
            }
        )


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        queryset = StockMovement.objects.select_related("distributor", "warehouse", "product", "order")
        product = self.request.query_params.get("product")
        warehouse = self.request.query_params.get("warehouse")
        movement_type = self.request.query_params.get("movement_type")
        if product:
            queryset = queryset.filter(product_id=product)
        if warehouse:
            queryset = queryset.filter(warehouse_id=warehouse)
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)
        return filter_by_distributor(queryset, self.request.user)


def _empty_stock_kpis():
    return {
        "total_skus": 0,
        "out_of_stock": 0,
        "low_stock": 0,
        "reserved_units": "0.000",
        "suggested_skus": 0,
        "suggested_units": "0.000",
    }

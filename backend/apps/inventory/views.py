from rest_framework import viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import StockItem, StockMovement, Warehouse
from .serializers import StockItemSerializer, StockMovementSerializer, WarehouseSerializer


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


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer

    def get_queryset(self):
        queryset = StockMovement.objects.select_related("distributor", "warehouse", "product", "order")
        return filter_by_distributor(queryset, self.request.user)

# Create your views here.

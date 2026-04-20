from rest_framework import viewsets

from apps.distributors.utils import filter_by_distributor, get_user_distributor

from .models import Product, ProductCategory, ProductSubCategory, ProductSupplier
from .serializers import ProductCategorySerializer, ProductSerializer, ProductSubCategorySerializer, ProductSupplierSerializer


class DistributorScopedViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        queryset = self.queryset
        user = self.request.user
        if user.role == "ADMIN" or user.is_superuser:
            return queryset
        return filter_by_distributor(queryset, user)

    def perform_create(self, serializer):
        if self.request.user.role == "ADMIN" or self.request.user.is_superuser:
            distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        else:
            distributor = get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

    def perform_update(self, serializer):
        if self.request.user.role == "ADMIN" or self.request.user.is_superuser:
            serializer.save()
        else:
            serializer.save(distributor=serializer.instance.distributor)


class ProductSupplierViewSet(DistributorScopedViewSet):
    serializer_class = ProductSupplierSerializer
    queryset = ProductSupplier.objects.select_related("distributor").all()


class ProductCategoryViewSet(DistributorScopedViewSet):
    serializer_class = ProductCategorySerializer
    queryset = ProductCategory.objects.select_related("distributor").all()


class ProductSubCategoryViewSet(DistributorScopedViewSet):
    serializer_class = ProductSubCategorySerializer
    queryset = ProductSubCategory.objects.select_related("distributor", "category").all()

    def perform_create(self, serializer):
        distributor = serializer.validated_data.get("distributor") if self.request.user.role == "ADMIN" or self.request.user.is_superuser else None
        category = serializer.validated_data.get("category")
        serializer.save(distributor=distributor or category.distributor)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = Product.objects.select_related(
            "distributor",
            "supplier",
            "product_category",
            "product_subcategory",
        ).prefetch_related("stock_items")
        distributor_id = self.request.query_params.get("distributor")
        category = self.request.query_params.get("category")
        subcategory = self.request.query_params.get("subcategory")
        search = self.request.query_params.get("q")
        if distributor_id:
            queryset = queryset.filter(distributor_id=distributor_id)
        elif self.request.user.role in {"DISTRIBUTOR", "DRIVER"}:
            queryset = filter_by_distributor(queryset, self.request.user)
        if category:
            queryset = queryset.filter(category__iexact=category)
        if subcategory:
            queryset = queryset.filter(subcategory__iexact=subcategory)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def perform_create(self, serializer):
        if self.request.user.role == "ADMIN" or self.request.user.is_superuser:
            distributor = serializer.validated_data.get("distributor") or get_user_distributor(self.request.user)
        else:
            distributor = get_user_distributor(self.request.user)
        serializer.save(distributor=distributor)

    def perform_update(self, serializer):
        if self.request.user.role == "ADMIN" or self.request.user.is_superuser:
            serializer.save()
        else:
            serializer.save(distributor=serializer.instance.distributor)

# Create your views here.

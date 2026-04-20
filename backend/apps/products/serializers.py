from rest_framework import serializers

from apps.distributors.models import Distributor
from apps.distributors.utils import get_user_distributor

from .models import Product, ProductCategory, ProductSubCategory, ProductSupplier


class ProductSupplierSerializer(serializers.ModelSerializer):
    distributor = serializers.PrimaryKeyRelatedField(queryset=Distributor.objects.all(), required=False)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = ProductSupplier
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "name",
            "contact_name",
            "phone",
            "email",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"distributor": {"required": False}}
        validators = []


class ProductCategorySerializer(serializers.ModelSerializer):
    distributor = serializers.PrimaryKeyRelatedField(queryset=Distributor.objects.all(), required=False)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)

    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "name",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"distributor": {"required": False}}
        validators = []


class ProductSubCategorySerializer(serializers.ModelSerializer):
    distributor = serializers.PrimaryKeyRelatedField(queryset=Distributor.objects.all(), required=False)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = ProductSubCategory
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "category",
            "category_name",
            "name",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"distributor": {"required": False}}
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        request_user = request.user if request else None
        distributor = attrs.get("distributor") or getattr(instance, "distributor", None) or get_user_distributor(request_user)
        category = attrs.get("category") or getattr(instance, "category", None)
        if category and distributor and category.distributor_id != distributor.id:
            raise serializers.ValidationError({"category": "La categoría debe pertenecer a la misma distribuidora."})
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    distributor = serializers.PrimaryKeyRelatedField(queryset=Distributor.objects.all(), required=False)
    distributor_name = serializers.CharField(source="distributor.business_name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    category_name = serializers.CharField(source="product_category.name", read_only=True)
    subcategory_name = serializers.CharField(source="product_subcategory.name", read_only=True)
    costo = serializers.DecimalField(source="cost", max_digits=12, decimal_places=2, required=False)
    porc_descuento = serializers.DecimalField(source="discount_percent", max_digits=5, decimal_places=2, required=False)
    nombre_descuento = serializers.CharField(source="discount_name", required=False, allow_blank=True)
    caracteristicas = serializers.CharField(source="characteristics", required=False, allow_blank=True)
    stock_on_hand = serializers.SerializerMethodField()
    stock_available = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "distributor",
            "distributor_name",
            "supplier",
            "supplier_name",
            "product_category",
            "category_name",
            "product_subcategory",
            "subcategory_name",
            "sku",
            "barcode",
            "name",
            "description",
            "brand",
            "category",
            "subcategory",
            "unit",
            "package_size",
            "length",
            "width",
            "height",
            "dimension_unit",
            "weight",
            "weight_unit",
            "units_per_package",
            "packages_per_pallet",
            "units_per_pallet",
            "price",
            "cost",
            "costo",
            "discount_percent",
            "porc_descuento",
            "discount_name",
            "nombre_descuento",
            "characteristics",
            "caracteristicas",
            "image_url",
            "stock_minimum",
            "stock_on_hand",
            "stock_available",
            "low_stock",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "stock_on_hand", "stock_available", "low_stock"]
        extra_kwargs = {
            "distributor": {"required": False},
            "category": {"required": False, "allow_blank": True},
        }
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        distributor = self._resolve_distributor(attrs)
        supplier = attrs.get("supplier")
        category = attrs.get("product_category")
        subcategory = attrs.get("product_subcategory")

        if supplier and distributor and supplier.distributor_id != distributor.id:
            raise serializers.ValidationError({"supplier": "El proveedor debe pertenecer a la misma distribuidora."})
        if category and distributor and category.distributor_id != distributor.id:
            raise serializers.ValidationError({"product_category": "La categoría debe pertenecer a la misma distribuidora."})
        if subcategory and distributor and subcategory.distributor_id != distributor.id:
            raise serializers.ValidationError({"product_subcategory": "La subcategoría debe pertenecer a la misma distribuidora."})
        if subcategory:
            attrs["product_category"] = category or subcategory.category
        return attrs

    def create(self, validated_data):
        self._sync_configured_values(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._sync_configured_values(validated_data, instance=instance)
        return super().update(instance, validated_data)

    def _resolve_distributor(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)
        if request and request.user.is_authenticated and request.user.role not in {"ADMIN"} and not request.user.is_superuser:
            return get_user_distributor(request.user)
        if attrs.get("distributor"):
            return attrs["distributor"]
        if instance:
            return instance.distributor
        return get_user_distributor(request.user if request else None)

    def _sync_configured_values(self, data, instance=None):
        distributor = self._resolve_distributor(data)
        category = data.get("product_category")
        subcategory = data.get("product_subcategory")

        if subcategory and not category:
            category = subcategory.category
            data["product_category"] = category
        if category:
            data["category"] = category.name
        elif data.get("category") and distributor:
            category, _ = ProductCategory.objects.get_or_create(distributor=distributor, name=data["category"])
            data["product_category"] = category

        if subcategory:
            data["subcategory"] = subcategory.name
        elif data.get("subcategory") and distributor:
            category = data.get("product_category") or getattr(instance, "product_category", None)
            if category:
                subcategory, _ = ProductSubCategory.objects.get_or_create(
                    distributor=distributor,
                    category=category,
                    name=data["subcategory"],
                )
                data["product_subcategory"] = subcategory

    def get_stock_on_hand(self, obj):
        return str(sum(item.quantity for item in obj.stock_items.all()))

    def get_stock_available(self, obj):
        return str(sum(item.available_quantity for item in obj.stock_items.all()))

    def get_low_stock(self, obj):
        return any(item.is_low for item in obj.stock_items.all())

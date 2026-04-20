from django.contrib import admin

from .models import Product, ProductCategory, ProductSubCategory, ProductSupplier


@admin.register(ProductSupplier)
class ProductSupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "distributor", "contact_name", "active")
    list_filter = ("active", "distributor")
    search_fields = ("name", "contact_name", "email", "phone")


@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "distributor", "active")
    list_filter = ("active", "distributor")
    search_fields = ("name",)


@admin.register(ProductSubCategory)
class ProductSubCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "distributor", "active")
    list_filter = ("active", "category", "distributor")
    search_fields = ("name", "category__name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "distributor", "supplier", "category", "subcategory", "price", "cost", "discount_percent", "active")
    list_filter = ("active", "product_category", "product_subcategory", "supplier", "distributor")
    search_fields = ("sku", "barcode", "name", "brand", "supplier__name", "category", "subcategory", "discount_name", "characteristics")

# Register your models here.

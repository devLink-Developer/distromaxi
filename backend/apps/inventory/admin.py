from django.contrib import admin

from .models import StockItem, StockMovement, Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "distributor", "active")
    search_fields = ("name", "distributor__business_name")


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "quantity", "reserved_quantity", "available_quantity")
    list_filter = ("warehouse__distributor",)
    search_fields = ("product__sku", "product__name")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("movement_type", "product", "quantity", "order", "created_at")
    list_filter = ("movement_type", "distributor")
    search_fields = ("product__sku", "product__name", "note")

# Register your models here.

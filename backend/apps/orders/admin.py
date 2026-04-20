from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product_name", "sku", "price", "subtotal")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "commerce", "distributor", "status", "total", "created_at")
    list_filter = ("status", "distributor")
    search_fields = ("commerce__trade_name", "distributor__business_name")
    inlines = [OrderItemInline]

# Register your models here.

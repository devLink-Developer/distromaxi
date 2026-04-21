from django.contrib import admin

from .models import Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "price", "currency", "is_featured", "is_active")
    list_editable = ("sort_order", "price", "is_featured", "is_active")
    list_filter = ("is_active", "is_featured")
    search_fields = ("name", "description", "mp_subscription_url", "mp_preapproval_plan_id")
    ordering = ("sort_order", "price")
    fields = (
        "name",
        "price",
        "description",
        "mp_subscription_url",
        "mp_preapproval_plan_id",
        "is_active",
        "sort_order",
        "is_featured",
        "currency",
        "max_products",
        "max_drivers",
    )


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("distributor", "plan", "status", "expires_at")
    list_filter = ("status", "plan")
    search_fields = ("distributor__business_name",)

# Register your models here.

from django.contrib import admin

from .models import Distributor


@admin.register(Distributor)
class DistributorAdmin(admin.ModelAdmin):
    list_display = ("business_name", "tax_id", "owner", "subscription_status", "active")
    list_filter = ("subscription_status", "active")
    search_fields = ("business_name", "tax_id", "email", "phone")

# Register your models here.

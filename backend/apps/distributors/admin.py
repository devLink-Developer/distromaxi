from django.contrib import admin

from .models import Distributor, DistributorOnboarding


@admin.register(Distributor)
class DistributorAdmin(admin.ModelAdmin):
    list_display = ("business_name", "tax_id", "owner", "subscription_status", "active")
    list_filter = ("subscription_status", "active")
    search_fields = ("business_name", "tax_id", "email", "phone")


@admin.register(DistributorOnboarding)
class DistributorOnboardingAdmin(admin.ModelAdmin):
    list_display = ("business_name", "tax_id", "email", "status", "plan", "updated_at")
    list_filter = ("status", "plan")
    search_fields = ("business_name", "tax_id", "email", "contact_name")

# Register your models here.

from django.contrib import admin

from .models import Commerce


@admin.register(Commerce)
class CommerceAdmin(admin.ModelAdmin):
    list_display = ("trade_name", "distributor", "tax_id", "phone", "active")
    list_filter = ("active", "distributor")
    search_fields = ("trade_name", "legal_name", "tax_id", "phone")

# Register your models here.

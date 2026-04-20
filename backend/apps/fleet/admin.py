from django.contrib import admin

from .models import DriverProfile, Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("plate", "distributor", "vehicle_type", "status", "active")
    list_filter = ("status", "active", "distributor")
    search_fields = ("plate", "brand", "model")


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "distributor", "license_number", "assigned_vehicle", "available", "active")
    list_filter = ("available", "active", "distributor")
    search_fields = ("user__email", "user__full_name", "license_number")

# Register your models here.

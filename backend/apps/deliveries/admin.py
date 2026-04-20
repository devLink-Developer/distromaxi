from django.contrib import admin

from .models import Delivery, DeliveryLocation


class DeliveryLocationInline(admin.TabularInline):
    model = DeliveryLocation
    extra = 0
    readonly_fields = ("recorded_at",)


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "driver", "vehicle", "status", "last_location_at")
    list_filter = ("status", "driver__distributor")
    inlines = [DeliveryLocationInline]

# Register your models here.

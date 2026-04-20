from django.contrib import admin

from .models import NotificationEvent, PushSubscription


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "active", "updated_at")
    list_filter = ("active",)
    search_fields = ("user__email", "endpoint")


@admin.register(NotificationEvent)
class NotificationEventAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "user", "distributor", "delivery_status", "created_at")
    list_filter = ("kind", "delivery_status")
    search_fields = ("title", "body", "user__email")

# Register your models here.

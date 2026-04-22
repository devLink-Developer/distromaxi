from django.contrib import admin

from .models import RoutePlan, RouteRun, RouteStop


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0
    readonly_fields = ("sequence", "planned_eta", "status")


class RouteRunInline(admin.TabularInline):
    model = RouteRun
    extra = 0
    readonly_fields = ("sequence", "driver", "vehicle", "status")


@admin.register(RoutePlan)
class RoutePlanAdmin(admin.ModelAdmin):
    list_display = ("id", "dispatch_date", "distributor", "status", "total_runs", "total_orders", "provider")
    list_filter = ("status", "provider", "dispatch_date")
    search_fields = ("distributor__business_name",)
    inlines = [RouteRunInline]


@admin.register(RouteRun)
class RouteRunAdmin(admin.ModelAdmin):
    list_display = ("id", "route_plan", "driver", "vehicle", "sequence", "status", "total_stops")
    list_filter = ("status", "route_plan__dispatch_date")
    inlines = [RouteStopInline]

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import PermissionDenied

from apps.deliveries.models import DeliveryStatus
from apps.distributors.utils import get_user_distributor

from .models import RoutePlanStatus, RouteRunStatus, RouteStopStatus


ROUTING_ENABLED_PLANS = {"PRO", "IA"}


def distributor_plan_name(distributor):
    subscription = getattr(distributor, "subscription", None)
    if subscription and subscription.plan_id:
        return str(subscription.plan.name or "").upper()
    return str(distributor.plan_name or "").upper()


def distributor_has_routing(distributor):
    return bool(
        distributor
        and distributor.can_operate
        and distributor_plan_name(distributor) in ROUTING_ENABLED_PLANS
    )


def get_routing_distributor(user):
    distributor = get_user_distributor(user)
    if distributor is None:
        raise PermissionDenied("No encontramos una distribuidora asociada a esta cuenta.")
    if not distributor_has_routing(distributor):
        raise PermissionDenied("El ruteo automatico esta disponible solo para planes PRO e IA activos.")
    return distributor


def routing_provider():
    return getattr(settings, "ROUTING_PROVIDER", "ors")


def service_minutes_per_stop():
    return int(getattr(settings, "ROUTING_SERVICE_MINUTES_PER_STOP", 10))


def active_route_delivery_statuses():
    return {DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY}


def decimal_zero(scale="0.000"):
    return Decimal(scale)


def route_plan_delete_state(route_plan):
    if route_plan.status in {RoutePlanStatus.DISPATCHED, RoutePlanStatus.COMPLETED}:
        return False, "No puedes eliminar una ruta iniciada o finalizada."
    if route_plan.runs.filter(stops__delivery__isnull=False).exists():
        return False, "No puedes eliminar una ruta asignada a un chofer."
    if route_plan.runs.filter(status__in=[RouteRunStatus.DISPATCHED, RouteRunStatus.COMPLETED]).exists():
        return False, "No puedes eliminar una ruta iniciada."
    if route_plan.runs.filter(stops__status__in=[RouteStopStatus.ARRIVED, RouteStopStatus.DELIVERED, RouteStopStatus.SKIPPED]).exists():
        return False, "No puedes eliminar una ruta iniciada."
    return True, ""

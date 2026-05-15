import hashlib
import json
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import PermissionDenied

from apps.deliveries.models import DeliveryStatus
from apps.distributors.utils import get_user_distributor

from .models import RoutePlanStatus, RouteRunStatus, RouteStopStatus


ROUTING_PLAN_KEY = "MAXIGESTION"
MANUAL_ROUTING_PLANS = {ROUTING_PLAN_KEY}
AUTOMATIC_ROUTING_PLANS = {ROUTING_PLAN_KEY}


def distributor_plan_name(distributor):
    subscription = getattr(distributor, "subscription", None)
    if subscription and subscription.plan_id and subscription.status in {"TRIAL", "ACTIVE"}:
        return str(subscription.plan.name or "").upper()
    return str(distributor.plan_name or "").upper()


def _plan_key(distributor):
    return distributor_plan_name(distributor).replace(" ", "_")


def distributor_has_manual_routing(distributor):
    return bool(
        distributor
        and distributor.can_operate
        and _plan_key(distributor) in MANUAL_ROUTING_PLANS
    )


def distributor_has_automatic_routing(distributor):
    return bool(
        distributor
        and distributor.can_operate
        and _plan_key(distributor) in AUTOMATIC_ROUTING_PLANS
    )


def distributor_has_routing(distributor):
    return distributor_has_manual_routing(distributor) or distributor_has_automatic_routing(distributor)


def get_manual_routing_distributor(user):
    distributor = get_user_distributor(user)
    if distributor is None:
        raise PermissionDenied("No encontramos una distribuidora asociada a esta cuenta.")
    if not distributor_has_manual_routing(distributor):
        raise PermissionDenied("El ruteo manual esta disponible para el plan MaxiGestion activo.")
    return distributor


def get_automatic_routing_distributor(user):
    distributor = get_user_distributor(user)
    if distributor is None:
        raise PermissionDenied("No encontramos una distribuidora asociada a esta cuenta.")
    if not distributor_has_automatic_routing(distributor):
        raise PermissionDenied("El ruteo automatico esta disponible para el plan MaxiGestion activo.")
    return distributor


def get_routing_distributor(user):
    return get_manual_routing_distributor(user)


def routing_provider():
    return getattr(settings, "ROUTING_PROVIDER", "ors")


def service_minutes_per_stop():
    return int(getattr(settings, "ROUTING_SERVICE_MINUTES_PER_STOP", 10))


def active_route_delivery_statuses():
    return {DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY}


def decimal_zero(scale="0.000"):
    return Decimal(scale)


def request_payload_hash(payload):
    normalized = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


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

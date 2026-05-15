from apps.routing.models import RoutePlanStatus


ACTIVE_ROUTE_PLAN_STATUSES = {
    RoutePlanStatus.DRAFT,
    RoutePlanStatus.CONFIRMED,
    RoutePlanStatus.DISPATCHED,
    RoutePlanStatus.COMPLETED,
}
ORDER_ROUTE_LOCK_CACHE_ATTR = "_order_route_lock_cache"


def order_route_lock(order):
    if order is None or not getattr(order, "pk", None):
        return None
    if hasattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR):
        return getattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR)
    prefetched_stops = getattr(order, "_prefetched_objects_cache", {}).get("route_stops")
    if prefetched_stops is not None:
        for stop in prefetched_stops:
            route_plan = stop.route_run.route_plan
            if route_plan.status in ACTIVE_ROUTE_PLAN_STATUSES:
                setattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR, route_plan)
                return route_plan
        setattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR, None)
        return None
    stop = (
        order.route_stops.select_related("route_run__route_plan")
        .filter(route_run__route_plan__status__in=ACTIVE_ROUTE_PLAN_STATUSES)
        .order_by("route_run__route_plan__created_at", "id")
        .first()
    )
    if stop is None:
        setattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR, None)
        return None
    route_plan = stop.route_run.route_plan
    setattr(order, ORDER_ROUTE_LOCK_CACHE_ATTR, route_plan)
    return route_plan


def order_is_route_locked(order):
    return order_route_lock(order) is not None


def order_route_lock_label(order):
    route_plan = order_route_lock(order)
    if route_plan is None:
        return ""
    return route_plan.route_number or f"HR #{route_plan.id}"


def order_route_lock_message(order):
    label = order_route_lock_label(order)
    if not label:
        return ""
    return f"El pedido esta dentro de la {label}. Quitalo de la HR para modificarlo."

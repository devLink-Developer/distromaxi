import json

from django.conf import settings

from .models import NotificationEvent, NotificationKind, PushSubscription


def dispatch_push(event):
    if not settings.WEBPUSH_VAPID_PRIVATE_KEY or not settings.WEBPUSH_VAPID_PUBLIC_KEY:
        event.delivery_status = "SKIPPED_NO_VAPID"
        event.save(update_fields=["delivery_status"])
        return

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        event.delivery_status = "SKIPPED_NO_LIBRARY"
        event.save(update_fields=["delivery_status"])
        return

    subscriptions = PushSubscription.objects.filter(active=True)
    if event.user_id:
        subscriptions = subscriptions.filter(user=event.user)
    elif event.distributor_id:
        subscriptions = subscriptions.filter(user__owned_distributors=event.distributor)

    sent = 0
    failed = 0
    payload = json.dumps(
        {
            "title": event.title,
            "body": event.body,
            "kind": event.kind,
            "data": event.payload,
        }
    )
    for subscription in subscriptions.distinct():
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=settings.WEBPUSH_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.WEBPUSH_VAPID_EMAIL},
            )
            sent += 1
        except WebPushException:
            failed += 1
    event.delivery_status = f"SENT_{sent}_FAILED_{failed}"
    event.save(update_fields=["delivery_status"])


def notify_user(user, title, body, kind=NotificationKind.SYSTEM, payload=None):
    event = NotificationEvent.objects.create(
        user=user,
        kind=kind,
        title=title,
        body=body,
        payload=payload or {},
    )
    dispatch_push(event)
    return event


def notify_distributor(distributor, title, body, kind=NotificationKind.SYSTEM, payload=None):
    event = NotificationEvent.objects.create(
        distributor=distributor,
        kind=kind,
        title=title,
        body=body,
        payload=payload or {},
    )
    dispatch_push(event)
    return event


def notify_order_status(order):
    payload = {"order_id": order.id, "status": order.status}
    notify_distributor(
        order.distributor,
        f"Pedido #{order.id}: {order.get_status_display()}",
        f"{order.commerce.trade_name} tiene el pedido en estado {order.get_status_display()}.",
        NotificationKind.ORDER,
        payload,
    )
    if order.commerce.user_id:
        notify_user(
            order.commerce.user,
            f"Tu pedido #{order.id} está {order.get_status_display()}",
            f"La distribuidora {order.distributor.business_name} actualizó tu pedido.",
            NotificationKind.ORDER,
            payload,
        )

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from apps.billing.models import Subscription
from apps.distributors.models import (
    Distributor,
    DistributorOnboarding,
    DistributorOnboardingStatus,
    SubscriptionStatus,
)
from apps.inventory.services import ensure_default_warehouse

PENDING_ONBOARDING_STATUSES = {
    DistributorOnboardingStatus.ACCOUNT_CREATED,
    DistributorOnboardingStatus.PLAN_SELECTED,
    DistributorOnboardingStatus.CHECKOUT_PENDING,
    DistributorOnboardingStatus.REVIEW_REQUIRED,
    DistributorOnboardingStatus.FAILED,
}

AUTHORIZED_MP_STATUSES = {"authorized"}
PENDING_MP_STATUSES = {"pending", "pending_charges", "pending_continue"}
FAILED_MP_STATUSES = {
    "cancelled",
    "cancelled_by_user",
    "cancelled_by_admin",
    "rejected",
    "expired",
}
SUSPENDED_MP_STATUSES = {"paused"}


@dataclass
class DistributorAccess:
    state: str
    onboarding_status: str | None
    onboarding_id: int | None
    distributor_id: int | None
    distributor_name: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "onboarding_status": self.onboarding_status,
            "onboarding_id": self.onboarding_id,
            "distributor_id": self.distributor_id,
            "distributor_name": self.distributor_name,
        }


def distributor_access_for_user(user) -> DistributorAccess:
    distributor = user.owned_distributors.order_by("pk").first() if getattr(user, "is_authenticated", False) else None
    onboarding = _safe_onboarding(user) if getattr(user, "is_authenticated", False) else None
    if distributor:
        return DistributorAccess(
            state="ACTIVE",
            onboarding_status=getattr(onboarding, "status", None),
            onboarding_id=getattr(onboarding, "id", None),
            distributor_id=distributor.id,
            distributor_name=distributor.business_name,
        )
    if onboarding:
        if onboarding.status == DistributorOnboardingStatus.REVIEW_REQUIRED:
            state = "REVIEW_REQUIRED"
        elif onboarding.status == DistributorOnboardingStatus.FAILED:
            state = "FAILED"
        else:
            state = "ONBOARDING"
        return DistributorAccess(
            state=state,
            onboarding_status=onboarding.status,
            onboarding_id=onboarding.id,
            distributor_id=None,
            distributor_name=None,
        )
    return DistributorAccess(
        state="NONE",
        onboarding_status=None,
        onboarding_id=None,
        distributor_id=None,
        distributor_name=None,
    )


def onboarding_snapshot_for_user(user) -> dict[str, Any]:
    distributor = user.owned_distributors.order_by("pk").first()
    onboarding = _safe_onboarding(user)
    access = distributor_access_for_user(user).as_dict()
    plan = onboarding.plan if onboarding else None
    return {
        "access_state": access["state"],
        "status": getattr(onboarding, "status", None),
        "onboarding_id": getattr(onboarding, "id", None),
        "distributor_id": getattr(distributor, "id", None),
        "business_name": getattr(onboarding, "business_name", None) or getattr(distributor, "business_name", ""),
        "tax_id": getattr(onboarding, "tax_id", None) or getattr(distributor, "tax_id", ""),
        "contact_name": getattr(onboarding, "contact_name", None) or getattr(distributor, "contact_name", user.full_name),
        "email": getattr(onboarding, "email", None) or user.email,
        "phone": getattr(onboarding, "phone", None) or getattr(distributor, "phone", user.phone),
        "selected_plan": plan,
        "checkout_url": plan.mp_subscription_url if plan else "",
        "review_reason": getattr(onboarding, "review_reason", ""),
        "failure_reason": getattr(onboarding, "failure_reason", ""),
        "mercado_pago_status": getattr(onboarding, "mercado_pago_status", ""),
        "checkout_started_at": getattr(onboarding, "checkout_started_at", None),
        "activated_at": getattr(onboarding, "activated_at", None),
        "created_at": getattr(onboarding, "created_at", None),
        "updated_at": getattr(onboarding, "updated_at", None),
    }


def map_subscription_status(mp_status: str) -> str:
    normalized = (mp_status or "").strip().lower()
    if normalized in AUTHORIZED_MP_STATUSES:
        return SubscriptionStatus.ACTIVE
    if normalized in PENDING_MP_STATUSES:
        return SubscriptionStatus.PAST_DUE
    if normalized in SUSPENDED_MP_STATUSES or normalized in FAILED_MP_STATUSES:
        return SubscriptionStatus.SUSPENDED
    return SubscriptionStatus.PAST_DUE


def update_existing_subscription(subscription: Subscription, mp_status: str, mp_subscription_id: str, payment_link: str = "") -> Subscription:
    status = map_subscription_status(mp_status)
    subscription.status = status
    subscription.mercado_pago_subscription_id = mp_subscription_id or subscription.mercado_pago_subscription_id
    if payment_link:
        subscription.mercado_pago_link = payment_link
    subscription.save(
        update_fields=[
            "status",
            "mercado_pago_subscription_id",
            "mercado_pago_link",
            "updated_at",
        ]
    )
    distributor = subscription.distributor
    distributor.subscription_status = status
    if payment_link:
        distributor.mercado_pago_link = payment_link
    distributor.active = status in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL}
    distributor.save(update_fields=["subscription_status", "mercado_pago_link", "active", "updated_at"])
    return subscription


def activate_onboarding_from_subscription(onboarding: DistributorOnboarding, plan, subscription_data: dict[str, Any]) -> Distributor:
    mp_status = str(subscription_data.get("status") or "")
    mp_subscription_id = str(subscription_data.get("id") or "")
    payment_link = str(subscription_data.get("init_point") or plan.mp_subscription_url or "")
    distributor, _ = Distributor.objects.update_or_create(
        owner=onboarding.user,
        defaults={
            "business_name": onboarding.business_name,
            "tax_id": onboarding.tax_id,
            "contact_name": onboarding.contact_name,
            "email": onboarding.email,
            "phone": onboarding.phone,
            "address": "",
            "city": "",
            "province": "",
            "currency": plan.currency,
            "plan_name": plan.name,
            "subscription_status": map_subscription_status(mp_status),
            "mercado_pago_link": payment_link,
            "active": True,
        },
    )
    ensure_default_warehouse(distributor)
    starts_at = _coerce_date(subscription_data.get("date_created"))
    expires_at = _coerce_date(
        subscription_data.get("next_payment_date")
        or subscription_data.get("auto_recurring", {}).get("end_date")
    )
    Subscription.objects.update_or_create(
        distributor=distributor,
        defaults={
            "plan": plan,
            "status": map_subscription_status(mp_status),
            "mercado_pago_link": payment_link,
            "mercado_pago_subscription_id": mp_subscription_id or None,
            "starts_at": starts_at,
            "expires_at": expires_at,
            "notes": "Activada automaticamente por webhook de Mercado Pago.",
        },
    )
    onboarding.plan = plan
    onboarding.status = DistributorOnboardingStatus.ACTIVE
    onboarding.mercado_pago_subscription_id = mp_subscription_id
    onboarding.mercado_pago_status = mp_status
    onboarding.review_reason = ""
    onboarding.failure_reason = ""
    onboarding.activated_at = timezone.now()
    onboarding.last_notification_at = timezone.now()
    onboarding.save(
        update_fields=[
            "plan",
            "status",
            "mercado_pago_subscription_id",
            "mercado_pago_status",
            "review_reason",
            "failure_reason",
            "activated_at",
            "last_notification_at",
            "updated_at",
        ]
    )
    return distributor


def mark_onboarding_pending(onboarding: DistributorOnboarding, mp_status: str = "") -> DistributorOnboarding:
    onboarding.status = DistributorOnboardingStatus.CHECKOUT_PENDING
    onboarding.mercado_pago_status = mp_status
    onboarding.failure_reason = ""
    onboarding.last_notification_at = timezone.now()
    onboarding.save(update_fields=["status", "mercado_pago_status", "failure_reason", "last_notification_at", "updated_at"])
    return onboarding


def mark_onboarding_review(onboarding: DistributorOnboarding, reason: str, mp_status: str = "", mp_subscription_id: str = "") -> DistributorOnboarding:
    onboarding.status = DistributorOnboardingStatus.REVIEW_REQUIRED
    onboarding.review_reason = reason
    onboarding.mercado_pago_status = mp_status
    onboarding.mercado_pago_subscription_id = mp_subscription_id
    onboarding.last_notification_at = timezone.now()
    onboarding.save(
        update_fields=[
            "status",
            "review_reason",
            "mercado_pago_status",
            "mercado_pago_subscription_id",
            "last_notification_at",
            "updated_at",
        ]
    )
    return onboarding


def mark_onboarding_failed(onboarding: DistributorOnboarding, reason: str, mp_status: str = "", mp_subscription_id: str = "") -> DistributorOnboarding:
    onboarding.status = DistributorOnboardingStatus.FAILED
    onboarding.failure_reason = reason
    onboarding.mercado_pago_status = mp_status
    onboarding.mercado_pago_subscription_id = mp_subscription_id
    onboarding.last_notification_at = timezone.now()
    onboarding.save(
        update_fields=[
            "status",
            "failure_reason",
            "mercado_pago_status",
            "mercado_pago_subscription_id",
            "last_notification_at",
            "updated_at",
        ]
    )
    return onboarding


def _coerce_date(value: Any):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    parsed_dt = parse_datetime(str(value))
    if parsed_dt:
        return parsed_dt.date()
    return parse_date(str(value))


def _safe_onboarding(user):
    if not user or not getattr(user, "is_authenticated", False):
        return None
    if not hasattr(user, "distributor_onboarding"):
        return None
    try:
        return user.distributor_onboarding
    except DistributorOnboarding.DoesNotExist:
        return None

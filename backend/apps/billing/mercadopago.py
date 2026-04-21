from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from rest_framework.exceptions import ValidationError


class MercadoPagoApiError(RuntimeError):
    pass


def mercadopago_enabled() -> bool:
    return bool(getattr(settings, "MERCADO_PAGO_ACCESS_TOKEN", ""))


def fetch_subscription_details(subscription_id: str) -> dict:
    if not subscription_id:
        raise MercadoPagoApiError("Mercado Pago no envio el identificador de la suscripcion.")
    if not mercadopago_enabled():
        raise MercadoPagoApiError("Falta configurar MERCADO_PAGO_ACCESS_TOKEN para validar la suscripcion.")
    request = Request(
        f"https://api.mercadopago.com/preapproval/{subscription_id}",
        headers={
            "Authorization": f"Bearer {settings.MERCADO_PAGO_ACCESS_TOKEN}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = exc.read().decode("utf-8", errors="ignore")
        raise MercadoPagoApiError(message or f"Mercado Pago devolvio HTTP {exc.code}.") from exc
    except URLError as exc:
        raise MercadoPagoApiError("No se pudo consultar Mercado Pago para confirmar la suscripcion.") from exc


def search_subscription_by_email_and_plan(*, payer_email: str, preapproval_plan_id: str) -> dict | None:
    if not payer_email or not preapproval_plan_id:
        return None
    if not mercadopago_enabled():
        raise MercadoPagoApiError("Falta configurar MERCADO_PAGO_ACCESS_TOKEN para validar la suscripcion.")
    query = urlencode({"payer_email": payer_email, "preapproval_plan_id": preapproval_plan_id})
    request = Request(
        f"https://api.mercadopago.com/preapproval/search?{query}",
        headers={
            "Authorization": f"Bearer {settings.MERCADO_PAGO_ACCESS_TOKEN}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
            results = payload.get("results") or []
            return results[0] if results else None
    except HTTPError as exc:
        message = exc.read().decode("utf-8", errors="ignore")
        raise MercadoPagoApiError(message or f"Mercado Pago devolvio HTTP {exc.code}.") from exc
    except URLError as exc:
        raise MercadoPagoApiError("No se pudo buscar la suscripcion en Mercado Pago.") from exc


def webhook_subscription_id(payload: dict, query_params) -> str:
    data = payload.get("data") or {}
    for candidate in [
        data.get("id"),
        payload.get("id"),
        query_params.get("data.id"),
        query_params.get("id"),
    ]:
        if candidate:
            return str(candidate)
    raise ValidationError({"detail": "Mercado Pago no envio el identificador de la suscripcion."})

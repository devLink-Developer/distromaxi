import json
from urllib import error, request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _api_key():
    return getattr(settings, "ORS_API_KEY", "") or getattr(settings, "OPENROUTESERVICE_API_KEY", "")


def _base_url():
    return str(getattr(settings, "ORS_BASE_URL", "https://api.openrouteservice.org")).rstrip("/")


def build_matrix(origin, destinations):
    api_key = _api_key()
    if not api_key:
        raise ImproperlyConfigured("Missing OPENROUTESERVICE_API_KEY.")

    coordinates = [[float(origin[1]), float(origin[0])]]
    for latitude, longitude in destinations:
        coordinates.append([float(longitude), float(latitude)])

    payload = json.dumps(
        {
            "locations": coordinates,
            "metrics": ["distance", "duration"],
            "units": "km",
        }
    ).encode("utf-8")
    req = request.Request(
        f"{_base_url()}/v2/matrix/driving-car",
        data=payload,
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenRouteService matrix error: {detail or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("No se pudo consultar OpenRouteService.") from exc

    durations = [[round(float(value or 0) / 60, 2) for value in row] for row in body.get("durations", [])]
    distances = [[round(float(value or 0), 3) for value in row] for row in body.get("distances", [])]
    return {
        "durations_min": durations,
        "distances_km": distances,
    }


def build_directions(points):
    api_key = _api_key()
    if not api_key:
        raise ImproperlyConfigured("Missing OPENROUTESERVICE_API_KEY.")
    if len(points) < 2:
        raise RuntimeError("Se necesitan al menos dos puntos para calcular direcciones.")

    coordinates = [[float(longitude), float(latitude)] for latitude, longitude in points]
    payload = json.dumps({"coordinates": coordinates}).encode("utf-8")
    req = request.Request(
        f"{_base_url()}/v2/directions/driving-car/geojson",
        data=payload,
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenRouteService directions error: {detail or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("No se pudo consultar OpenRouteService.") from exc

    features = body.get("features") or []
    if not features:
        raise RuntimeError("OpenRouteService no devolvio geometria para la ruta.")
    feature = features[0]
    summary = (feature.get("properties") or {}).get("summary") or {}
    geometry = feature.get("geometry") or {"type": "LineString", "coordinates": coordinates}
    return {
        "distance_km": round(float(summary.get("distance") or 0) / 1000, 3),
        "duration_min": round(float(summary.get("duration") or 0) / 60, 2),
        "geometry": geometry,
    }

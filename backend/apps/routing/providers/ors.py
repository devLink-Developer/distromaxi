import json
from urllib import error, request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def build_matrix(origin, destinations):
    api_key = settings.OPENROUTESERVICE_API_KEY
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
        "https://api.openrouteservice.org/v2/matrix/driving-car",
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

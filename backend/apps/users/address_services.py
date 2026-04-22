import json
import re
import unicodedata
from collections import Counter
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

POSTAL_CODE_URL = "https://api.zippopotam.us/AR/{postal_code}"
GEOREF_ADDRESS_URL = "https://apis.datos.gob.ar/georef/api/direcciones"
ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
ORS_REVERSE_GEOCODE_URL = "https://api.openrouteservice.org/geocode/reverse"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"


class AddressServiceError(Exception):
    pass


def lookup_postal_code(postal_code):
    normalized = normalize_postal_code(postal_code)
    payload = _get_json(POSTAL_CODE_URL.format(postal_code=normalized))
    places = payload.get("places") or []
    if not places:
        raise AddressServiceError("No encontramos datos para ese codigo postal.")

    place_rows = []
    for place in places:
        locality = _clean_label(place.get("place name"))
        province = _clean_label(place.get("state"))
        if locality and province:
            place_rows.append((locality, province))

    if not place_rows:
        raise AddressServiceError("No encontramos localidades validas para ese codigo postal.")

    province = Counter(row[1] for row in place_rows).most_common(1)[0][0]
    localities = []
    seen = set()
    for locality, row_province in place_rows:
        if row_province != province or locality in seen:
            continue
        localities.append(locality)
        seen.add(locality)

    if not localities:
        raise AddressServiceError("No encontramos localidades validas para ese codigo postal.")

    return {
        "postal_code": normalized,
        "city": localities[0],
        "province": province,
        "localities": localities,
    }


def geocode_address(*, street, number, locality, province):
    street = _normalize_street(street)
    number = _clean_label(number)
    locality = _clean_label(locality)
    province = _clean_label(province)
    if not street or not number or not locality or not province:
        raise AddressServiceError("Completa calle, altura, localidad y provincia para geolocalizar la direccion.")

    providers = []
    if settings.OPENROUTESERVICE_API_KEY:
        providers.append(_ors_geocode_address)
    providers.extend([_georef_geocode_address, _nominatim_geocode_address])

    for provider in providers:
        try:
            return provider(street=street, number=number, locality=locality, province=province)
        except AddressServiceError:
            continue

    raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")


def reverse_geocode(*, latitude, longitude):
    if not settings.OPENROUTESERVICE_API_KEY:
        raise AddressServiceError("El reverse geocoding requiere OPENROUTESERVICE_API_KEY configurada.")

    return _ors_reverse_geocode(latitude=latitude, longitude=longitude)


def _georef_geocode_address(*, street, number, locality, province):
    query = urlencode(
        {
            "direccion": f"{street} {number}",
            "localidad": locality,
            "provincia": province,
            "max": 1,
        }
    )
    payload = _get_json(f"{GEOREF_ADDRESS_URL}?{query}")
    directions = payload.get("direcciones") or []
    if not directions:
        raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")

    direction = directions[0]
    location = direction.get("ubicacion") or {}
    latitude = location.get("lat")
    longitude = location.get("lon")
    if latitude is None or longitude is None:
        raise AddressServiceError("El servicio devolvio la direccion, pero sin coordenadas utilizables.")

    normalized_locality = _clean_label((direction.get("localidad_censal") or {}).get("nombre")) or locality
    normalized_province = _clean_label((direction.get("provincia") or {}).get("nombre")) or province
    normalized_address = _clean_label(direction.get("nomenclatura")) or f"{street} {number}, {locality}, {province}"

    return {
        "address": normalized_address,
        "street": street,
        "number": number,
        "city": normalized_locality,
        "province": normalized_province,
        "latitude": latitude,
        "longitude": longitude,
    }


def normalize_postal_code(value):
    digits = re.sub(r"\D+", "", str(value or ""))
    if len(digits) not in {4, 5}:
        raise AddressServiceError("Ingresa un codigo postal argentino valido de 4 o 5 digitos.")
    return digits


def _ors_geocode_address(*, street, number, locality, province):
    query = urlencode(
        {
            "text": f"{street} {number}, {locality}, {province}, Argentina",
            "boundary.country": "AR",
            "size": 1,
        }
    )
    payload = _get_json(
        f"{ORS_GEOCODE_URL}?{query}",
        headers={
            "Authorization": settings.OPENROUTESERVICE_API_KEY,
        },
    )
    features = payload.get("features") or []
    if not features:
        raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")
    normalized = _normalize_ors_feature(features[0], fallback_street=street, fallback_number=number, fallback_city=locality, fallback_province=province)
    if not _ors_result_is_precise(normalized, street=street, number=number, locality=locality):
        raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")
    return normalized


def _nominatim_geocode_address(*, street, number, locality, province):
    query = urlencode(
        {
            "q": f"{street} {number}, {locality}, {province}, Argentina",
            "format": "jsonv2",
            "limit": 3,
            "countrycodes": "ar",
        }
    )
    payload = _get_json(
        f"{NOMINATIM_SEARCH_URL}?{query}",
        headers={
            "Accept-Language": "es",
        },
    )
    if not isinstance(payload, list) or not payload:
        raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")

    requested_street = _normalize_for_match(street)
    requested_locality = _normalize_for_match(locality)

    for candidate in payload:
        display_name = _normalize_for_match(candidate.get("display_name"))
        name = _normalize_for_match(candidate.get("name"))
        if requested_street not in display_name and requested_street not in name:
            continue
        if requested_locality not in display_name:
            continue
        latitude = candidate.get("lat")
        longitude = candidate.get("lon")
        if latitude is None or longitude is None:
            continue
        return {
            "address": f"{street} {number}, {locality}, {province}",
            "street": street,
            "number": number,
            "city": locality,
            "province": province,
            "latitude": float(latitude),
            "longitude": float(longitude),
        }

    raise AddressServiceError("No pudimos geolocalizar esa direccion. Revisa calle, altura y localidad.")


def _ors_reverse_geocode(*, latitude, longitude):
    query = urlencode(
        {
            "point.lat": f"{float(latitude):.7f}",
            "point.lon": f"{float(longitude):.7f}",
            "boundary.country": "AR",
            "size": 1,
        }
    )
    payload = _get_json(
        f"{ORS_REVERSE_GEOCODE_URL}?{query}",
        headers={
            "Authorization": settings.OPENROUTESERVICE_API_KEY,
        },
    )
    features = payload.get("features") or []
    if not features:
        raise AddressServiceError("No pudimos traducir ese punto del mapa a calle y altura.")

    normalized = _normalize_ors_feature(features[0])
    return {
        "address": normalized["address"],
        "street": normalized["street"],
        "number": normalized["number"],
        "latitude": normalized["latitude"],
        "longitude": normalized["longitude"],
    }


def _normalize_ors_feature(feature, *, fallback_street="", fallback_number="", fallback_city="", fallback_province=""):
    properties = feature.get("properties") or {}
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if len(coordinates) < 2:
        raise AddressServiceError("El servicio de geolocalizacion devolvio un punto invalido.")

    street = _clean_label(properties.get("street")) or _clean_label(properties.get("name")) or fallback_street
    number = _clean_label(properties.get("housenumber")) or fallback_number
    city = (
        _clean_label(properties.get("locality"))
        or _clean_label(properties.get("localadmin"))
        or _clean_label(properties.get("county"))
        or fallback_city
    )
    province = _clean_label(properties.get("region")) or _clean_label(properties.get("macroregion")) or fallback_province
    address = _clean_label(properties.get("label")) or ", ".join(filter(None, [f"{street} {number}".strip(), city, province]))

    return {
        "address": address,
        "street": street,
        "number": number,
        "city": city,
        "province": province,
        "latitude": float(coordinates[1]),
        "longitude": float(coordinates[0]),
    }


def _clean_label(value):
    return " ".join(str(value or "").strip().split())


def _normalize_street(value):
    street = _clean_label(value)
    return re.sub(r"^(\d+)([A-Za-z].*)$", r"\1 \2", street)


def _normalize_for_match(value):
    cleaned = unicodedata.normalize("NFKD", str(value or ""))
    ascii_only = "".join(char for char in cleaned if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", ascii_only.lower()).strip()


def _ors_result_is_precise(result, *, street, number, locality):
    requested_street = _normalize_for_match(street)
    requested_number = _normalize_for_match(number)
    requested_locality = _normalize_for_match(locality)
    result_street = _normalize_for_match(result.get("street"))
    result_number = _normalize_for_match(result.get("number"))
    result_city = _normalize_for_match(result.get("city"))
    result_address = _normalize_for_match(result.get("address"))

    has_street = requested_street and (requested_street in result_street or requested_street in result_address)
    has_number = requested_number and (requested_number == result_number or f" {requested_number} " in f" {result_address} ")
    has_locality = requested_locality and (requested_locality in result_city or requested_locality in result_address)
    return bool(has_street and has_number and has_locality)


def _get_json(url, headers=None):
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "DistroMaxi/1.0",
            **(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            raise AddressServiceError("No encontramos datos para la direccion o codigo postal indicado.") from exc
        raise AddressServiceError("No pudimos consultar el servicio de direcciones.") from exc
    except (TimeoutError, URLError, json.JSONDecodeError) as exc:
        raise AddressServiceError("No pudimos consultar el servicio de direcciones.") from exc

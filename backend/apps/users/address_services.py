import json
import re
from collections import Counter
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


POSTAL_CODE_URL = "https://api.zippopotam.us/AR/{postal_code}"
GEOREF_ADDRESS_URL = "https://apis.datos.gob.ar/georef/api/direcciones"


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
    street = _clean_label(street)
    number = _clean_label(number)
    locality = _clean_label(locality)
    province = _clean_label(province)
    if not street or not number or not locality or not province:
        raise AddressServiceError("Completa calle, altura, localidad y provincia para geolocalizar la direccion.")

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


def _clean_label(value):
    return " ".join(str(value or "").strip().split())


def _get_json(url):
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "DistroMaxi/1.0",
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

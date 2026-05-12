from decimal import Decimal, InvalidOperation

from .models import ServiceAreaMode


ARGENTINA_BOUNDS = {
    "min_lat": Decimal("-56.0"),
    "max_lat": Decimal("-21.0"),
    "min_lng": Decimal("-74.0"),
    "max_lng": Decimal("-53.0"),
}


def get_user_distributor(user):
    if not user or not user.is_authenticated:
        return None
    if user.role == "DISTRIBUTOR":
        return user.owned_distributors.first()
    if user.role == "DRIVER" and hasattr(user, "driver_profile"):
        return user.driver_profile.distributor
    if user.role == "COMMERCE" and hasattr(user, "commerce_profile"):
        return user.commerce_profile.distributor
    return None


def filter_by_distributor(queryset, user, field_name="distributor"):
    if user.role == "ADMIN" or user.is_superuser:
        return queryset
    distributor = get_user_distributor(user)
    if distributor is None:
        return queryset.none()
    return queryset.filter(**{field_name: distributor})


def normalize_service_area(mode, country="", polygon=None):
    normalized_mode = (mode or ServiceAreaMode.NONE).upper()
    if normalized_mode not in ServiceAreaMode.values:
        raise ValueError("Selecciona un modo de alcance valido.")

    if normalized_mode == ServiceAreaMode.NONE:
        return {
            "service_area_mode": ServiceAreaMode.NONE,
            "service_area_country": "",
            "service_area_polygon": None,
        }

    if normalized_mode == ServiceAreaMode.COUNTRY:
        normalized_country = (country or "AR").upper()
        if normalized_country != "AR":
            raise ValueError("Por ahora solo se admite Argentina como pais de alcance.")
        return {
            "service_area_mode": ServiceAreaMode.COUNTRY,
            "service_area_country": "AR",
            "service_area_polygon": None,
        }

    return {
        "service_area_mode": ServiceAreaMode.POLYGON,
        "service_area_country": "",
        "service_area_polygon": normalize_geojson_polygon(polygon),
    }


def normalize_geojson_polygon(polygon):
    if not isinstance(polygon, dict):
        raise ValueError("El poligono debe enviarse en formato GeoJSON.")
    if polygon.get("type") != "Polygon":
        raise ValueError("El alcance debe ser un GeoJSON Polygon.")
    coordinates = polygon.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) != 1:
        raise ValueError("El poligono debe tener un unico anillo exterior.")

    ring = coordinates[0]
    if not isinstance(ring, list):
        raise ValueError("El anillo del poligono es invalido.")

    normalized_ring = [_normalize_lng_lat_pair(pair) for pair in ring]
    if len(normalized_ring) >= 2 and normalized_ring[0] != normalized_ring[-1]:
        normalized_ring.append(normalized_ring[0])

    unique_points = {tuple(pair) for pair in normalized_ring[:-1]}
    if len(unique_points) < 3:
        raise ValueError("El poligono debe tener al menos 3 puntos.")

    return {"type": "Polygon", "coordinates": [normalized_ring]}


def distributor_contains_point(distributor, latitude, longitude):
    point = normalize_point(latitude, longitude)
    if point is None:
        return False

    mode = distributor.service_area_mode
    if mode == ServiceAreaMode.COUNTRY:
        return (distributor.service_area_country or "").upper() == "AR" and point_in_argentina_bounds(*point)
    if mode == ServiceAreaMode.POLYGON:
        return point_in_geojson_polygon(*point, distributor.service_area_polygon)
    return False


def distributor_ids_covering_point(queryset, latitude, longitude):
    return [
        distributor.id
        for distributor in queryset
        if distributor_contains_point(distributor, latitude, longitude)
    ]


def user_service_point(user):
    commerce = getattr(user, "commerce_profile", None)
    if commerce is None:
        return None
    return normalize_point(commerce.latitude, commerce.longitude)


def point_in_argentina_bounds(latitude, longitude):
    return (
        ARGENTINA_BOUNDS["min_lat"] <= latitude <= ARGENTINA_BOUNDS["max_lat"]
        and ARGENTINA_BOUNDS["min_lng"] <= longitude <= ARGENTINA_BOUNDS["max_lng"]
    )


def point_in_geojson_polygon(latitude, longitude, polygon):
    if not isinstance(polygon, dict) or polygon.get("type") != "Polygon":
        return False
    coordinates = polygon.get("coordinates")
    if not isinstance(coordinates, list) or not coordinates:
        return False
    ring = coordinates[0]
    if not isinstance(ring, list) or len(ring) < 4:
        return False

    x = float(longitude)
    y = float(latitude)
    points = []
    for pair in ring:
        if not isinstance(pair, list | tuple) or len(pair) < 2:
            continue
        try:
            points.append((float(pair[0]), float(pair[1])))
        except (TypeError, ValueError):
            return False
    if len(points) < 4:
        return False

    inside = False
    previous_x, previous_y = points[-1]
    for current_x, current_y in points:
        if _point_on_segment(x, y, previous_x, previous_y, current_x, current_y):
            return True
        crosses = (current_y > y) != (previous_y > y)
        if crosses:
            intersection_x = (previous_x - current_x) * (y - current_y) / (previous_y - current_y) + current_x
            if x <= intersection_x:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def normalize_point(latitude, longitude):
    try:
        normalized_latitude = Decimal(str(latitude))
        normalized_longitude = Decimal(str(longitude))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not (Decimal("-90") <= normalized_latitude <= Decimal("90")):
        return None
    if not (Decimal("-180") <= normalized_longitude <= Decimal("180")):
        return None
    return normalized_latitude, normalized_longitude


def _normalize_lng_lat_pair(pair):
    if not isinstance(pair, list | tuple) or len(pair) < 2:
        raise ValueError("Cada punto del poligono debe tener longitud y latitud.")
    point = normalize_point(pair[1], pair[0])
    if point is None:
        raise ValueError("El poligono tiene coordenadas invalidas.")
    latitude, longitude = point
    return [float(longitude), float(latitude)]


def _point_on_segment(px, py, ax, ay, bx, by):
    cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
    if abs(cross) > 1e-10:
        return False
    return min(ax, bx) - 1e-10 <= px <= max(ax, bx) + 1e-10 and min(ay, by) - 1e-10 <= py <= max(ay, by) + 1e-10

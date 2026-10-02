import asyncio
import logging
import math
import time
from typing import Iterable

import httpx

from ..config import settings

logger = logging.getLogger(__name__)
_CACHE: dict[str, tuple[float, dict | list]] = {}
_NOMINATIM_LOCK = asyncio.Lock()
_LAST_NOMINATIM_REQUEST = 0.0


CONNECTOR_TAGS = {
    "socket:type2": "Type 2",
    "socket:type2_combo": "CCS2",
    "socket:chademo": "CHAdeMO",
    "socket:type1": "Type 1",
    "socket:type1_combo": "CCS1",
    "socket:tesla_supercharger": "Tesla Supercharger",
    "socket:tesla_destination": "Tesla Destination",
    "socket:gb_t": "GB/T",
}


class ExternalServiceError(RuntimeError):
    pass


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(value))


def station_from_element(element: dict) -> dict | None:
    tags = element.get("tags") or {}
    lat = element.get("lat") or (element.get("center") or {}).get("lat")
    lon = element.get("lon") or (element.get("center") or {}).get("lon")
    if lat is None or lon is None:
        return None
    connectors = [label for key, label in CONNECTOR_TAGS.items() if tags.get(key) not in (None, "no", "0")]
    address = ", ".join(
        filter(None, [tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:city"), tags.get("addr:postcode")])
    )
    osm_type = element.get("type", "node")
    osm_id = element.get("id")
    return {
        "osm_key": f"{osm_type}/{osm_id}",
        "name": tags.get("name") or tags.get("operator") or "EV charging station",
        "latitude": float(lat),
        "longitude": float(lon),
        "operator": tags.get("operator") or tags.get("brand"),
        "address": address or tags.get("addr:full"),
        "access": tags.get("access"),
        "opening_hours": tags.get("opening_hours"),
        "capacity": int(tags["capacity"]) if str(tags.get("capacity", "")).isdigit() else None,
        "connectors": connectors,
        "charger_type": "DC" if any(value in connectors for value in ("CCS2", "CCS1", "CHAdeMO", "Tesla Supercharger", "GB/T")) else ("AC" if connectors else None),
        "power_kw": _osm_power(tags),
        "status": None,
        "city": tags.get("addr:city"),
        "state": tags.get("addr:state"),
        "country": tags.get("addr:country") or "India",
        "source": "OpenStreetMap",
        "source_id": f"{osm_type}/{osm_id}",
        "confidence": "Medium" if connectors and (tags.get("operator") or tags.get("brand")) else "Low",
        "provenance": {"coordinates": "OpenStreetMap", "connectors": "OpenStreetMap", "operator": "OpenStreetMap"},
        "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "raw_tags": tags,
    }


def _osm_power(tags: dict) -> float | None:
    for key in ("socket:type2_combo:output", "socket:chademo:output", "charging_station:output", "max_power"):
        value = str(tags.get(key, "")).lower().replace("kw", "").strip()
        try:
            return float(value)
        except ValueError:
            continue
    return None


async def _get_json(url: str, *, params: dict | None = None) -> dict | list:
    cache_key = f"GET:{url}:{sorted((params or {}).items())}"
    cached = _CACHE.get(cache_key)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    headers = {"User-Agent": settings.user_agent, "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
            _CACHE[cache_key] = (time.monotonic() + settings.cache_ttl_minutes * 60, payload)
            return payload
    except (httpx.HTTPError, ValueError) as exc:
        raise ExternalServiceError(f"Live map service unavailable: {exc}") from exc


async def _overpass_json(query: str) -> dict:
    endpoints = [
        settings.overpass_url,
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ]
    last_error: Exception | None = None
    for endpoint in dict.fromkeys(endpoints):
        try:
            payload = await _get_json(endpoint, params={"data": query})
            return payload if isinstance(payload, dict) else {"elements": []}
        except ExternalServiceError as exc:
            last_error = exc
            logger.warning("Overpass endpoint failed (%s): %s", endpoint, exc)
    raise ExternalServiceError(f"All Overpass endpoints were unavailable: {last_error}")


async def geocode(place: str) -> dict:
    global _LAST_NOMINATIM_REQUEST
    async with _NOMINATIM_LOCK:
        wait_for = 1.05 - (time.monotonic() - _LAST_NOMINATIM_REQUEST)
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        payload = await _get_json(f"{settings.nominatim_url}/search", params={"q": place, "format": "jsonv2", "limit": 1, "addressdetails": 1})
        _LAST_NOMINATIM_REQUEST = time.monotonic()
    if not payload:
        raise ExternalServiceError(f"Could not find location: {place}")
    item = payload[0]
    return {"name": item.get("display_name", place), "latitude": float(item["lat"]), "longitude": float(item["lon"])}


async def reverse_geocode(lat: float, lon: float) -> str | None:
    try:
        item = await _get_json(
            f"{settings.nominatim_url}/reverse",
            params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 16},
        )
        return item.get("display_name") if isinstance(item, dict) else None
    except ExternalServiceError:
        return None


async def fetch_route(origin: dict, destination: dict) -> dict:
    if settings.ors_api_key:
        headers = {"Authorization": settings.ors_api_key, "Content-Type": "application/json", "User-Agent": settings.user_agent}
        body = {"coordinates": [[origin["longitude"], origin["latitude"]], [destination["longitude"], destination["latitude"]]]}
        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
                response = await client.post(settings.ors_url, headers=headers, json=body)
                response.raise_for_status()
                feature = response.json()["features"][0]
                summary = feature["properties"]["summary"]
                return {"distance_km": round(summary["distance"] / 1000, 1), "duration_minutes": round(summary["duration"] / 60), "geometry": feature["geometry"], "provider": "openrouteservice"}
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            logger.warning("openrouteservice failed; falling back to OSRM: %s", exc)
    coordinates = f"{origin['longitude']},{origin['latitude']};{destination['longitude']},{destination['latitude']}"
    payload = await _get_json(
        f"{settings.osrm_url}/route/v1/driving/{coordinates}",
        params={"overview": "full", "geometries": "geojson", "steps": "false"},
    )
    routes = payload.get("routes", []) if isinstance(payload, dict) else []
    if not routes:
        raise ExternalServiceError("No drivable route was returned for these locations")
    route = routes[0]
    return {
        "distance_km": round(route["distance"] / 1000, 1),
        "duration_minutes": round(route["duration"] / 60),
        "geometry": route["geometry"],
        "provider": "OSRM",
    }


async def fetch_stations_bbox(bbox: tuple[float, float, float, float]) -> list[dict]:
    south, west, north, east = bbox
    query = f"""
    [out:json][timeout:30];
    (
      node[\"amenity\"=\"charging_station\"]({south},{west},{north},{east});
      way[\"amenity\"=\"charging_station\"]({south},{west},{north},{east});
      relation[\"amenity\"=\"charging_station\"]({south},{west},{north},{east});
    );
    out center tags;
    """
    payload = await _overpass_json(query)
    return [station for item in payload.get("elements", []) if (station := station_from_element(item))]


async def fetch_stations_near(lat: float, lon: float, radius_km: float) -> list[dict]:
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / max(20.0, 111.0 * math.cos(math.radians(lat)))
    stations = await fetch_stations_bbox((lat - lat_delta, lon - lon_delta, lat + lat_delta, lon + lon_delta))
    return [item for item in stations if haversine_km((lat, lon), (item["latitude"], item["longitude"])) <= radius_km]


async def fetch_stations_corridor(coordinates: list[list[float]], radius_km: float = 22) -> list[dict]:
    """Query a sampled route corridor instead of a potentially country-sized bbox."""
    if not coordinates:
        return []
    sample_count = min(20, len(coordinates))
    indices = sorted({round(index * (len(coordinates) - 1) / max(1, sample_count - 1)) for index in range(sample_count)})
    clauses = []
    radius_m = round(radius_km * 1000)
    for index in indices:
        lon, lat = coordinates[index]
        clauses.extend(
            [
                f'node["amenity"="charging_station"](around:{radius_m},{lat},{lon});',
                f'way["amenity"="charging_station"](around:{radius_m},{lat},{lon});',
                f'relation["amenity"="charging_station"](around:{radius_m},{lat},{lon});',
            ]
        )
    query = "[out:json][timeout:45];(" + "".join(clauses) + ");out center tags;"
    payload = await _overpass_json(query)
    unique: dict[str, dict] = {}
    for element in payload.get("elements", []):
        station = station_from_element(element)
        if station:
            unique[station["osm_key"]] = station
    return list(unique.values())


def station_from_ocm(item: dict) -> dict | None:
    address = item.get("AddressInfo") or {}
    lat, lon = address.get("Latitude"), address.get("Longitude")
    if lat is None or lon is None:
        return None
    connections = item.get("Connections") or []
    connectors = []
    power_values = []
    for connection in connections:
        title = ((connection.get("ConnectionType") or {}).get("Title") or "").strip()
        normalized = title.replace("Combo", "CCS").replace("Type 2 CCS", "CCS2")
        if normalized and normalized not in connectors:
            connectors.append(normalized)
        if isinstance(connection.get("PowerKW"), (int, float)):
            power_values.append(float(connection["PowerKW"]))
    operator = (item.get("OperatorInfo") or {}).get("Title")
    status = (item.get("StatusType") or {}).get("Title")
    ocm_id = item.get("ID")
    return {
        "osm_key": f"ocm/{ocm_id}",
        "name": address.get("Title") or operator or "EV charging station",
        "latitude": float(lat),
        "longitude": float(lon),
        "operator": operator,
        "address": ", ".join(filter(None, [address.get("AddressLine1"), address.get("Town"), address.get("StateOrProvince"), address.get("Postcode")])),
        "access": ((item.get("UsageType") or {}).get("Title")),
        "opening_hours": None,
        "capacity": item.get("NumberOfPoints"),
        "connectors": connectors,
        "charger_type": "DC" if any(value >= 25 for value in power_values) else ("AC" if power_values else None),
        "power_kw": max(power_values) if power_values else None,
        "status": status,
        "city": address.get("Town"),
        "state": address.get("StateOrProvince"),
        "country": ((address.get("Country") or {}).get("Title")),
        "source": "Open Charge Map",
        "source_id": str(ocm_id),
        "confidence": "Medium" if connectors and operator else "Low",
        "provenance": {"coordinates": "Open Charge Map", "connectors": "Open Charge Map", "operator": "Open Charge Map", "power_kw": "Open Charge Map"},
        "source_url": item.get("WebsiteURL") or f"https://openchargemap.io/site/poi/details/{ocm_id}",
        "raw_tags": {"ocm_uuid": item.get("UUID"), "data_provider": (item.get("DataProvider") or {}).get("Title")},
    }


async def fetch_open_charge_map_bbox(bbox: tuple[float, float, float, float]) -> list[dict]:
    if not settings.open_charge_map_api_key:
        return []
    south, west, north, east = bbox
    params = {
        "output": "json",
        "key": settings.open_charge_map_api_key,
        "boundingbox": f"({south},{west}),({north},{east})",
        "maxresults": 500,
        "compact": "true",
        "verbose": "false",
        "countrycode": "IN",
    }
    payload = await _get_json(settings.open_charge_map_url, params=params)
    return [station for item in payload if (station := station_from_ocm(item))]


async def fetch_multi_source_stations(coordinates: list[list[float]]) -> tuple[list[dict], list[str]]:
    providers = ["OpenStreetMap"]
    tasks = [fetch_stations_corridor(coordinates)]
    bbox = route_bbox(coordinates, padding_degrees=0.2)
    if settings.open_charge_map_api_key and (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < 20:
        tasks.append(fetch_open_charge_map_bbox(bbox))
        providers.append("Open Charge Map")
    results = await asyncio.gather(*tasks, return_exceptions=True)
    records: list[dict] = []
    successful = []
    for provider, result in zip(providers, results):
        if isinstance(result, Exception):
            logger.warning("%s station source failed: %s", provider, result)
        else:
            records.extend(result)
            successful.append(provider)
    if not successful:
        raise ExternalServiceError("All charging station sources were unavailable")
    return records, successful


def route_bbox(coordinates: Iterable[list[float]], padding_degrees: float = 0.18) -> tuple[float, float, float, float]:
    points = list(coordinates)
    lons = [point[0] for point in points]
    lats = [point[1] for point in points]
    return min(lats) - padding_degrees, min(lons) - padding_degrees, max(lats) + padding_degrees, max(lons) + padding_degrees


def distance_to_route_km(station: dict, route_coordinates: list[list[float]]) -> float:
    point = (station["latitude"], station["longitude"])
    if not route_coordinates:
        return math.inf
    stride = max(1, len(route_coordinates) // 160)
    sampled = route_coordinates[::stride]
    if sampled[-1] != route_coordinates[-1]:
        sampled.append(route_coordinates[-1])
    return min(haversine_km(point, (lat, lon)) for lon, lat in sampled)

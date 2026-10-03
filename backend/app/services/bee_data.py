"""Spatial access to BEE EV Yatra's published nationwide station snapshot."""

import json
from functools import lru_cache
from pathlib import Path

from .bee_parser import normalize_bee_row
from .geo import _sample_route_anchors, haversine_km

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "bee_stations.json"


@lru_cache(maxsize=1)
def load_bee_stations() -> list[dict]:
    if not DATA_PATH.exists():
        return []
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def stations_near_routes(stations: list[dict], routes: list[list[list[float]]], radius_km: float = 24) -> list[dict]:
    """Cheap nationwide prefilter; the planner later applies its exact corridor rule."""
    anchors = [point for route in routes for point in _sample_route_anchors(route, spacing_km=20)]
    if not anchors:
        return []
    minimum_lat = min(point[1] for point in anchors) - 0.28
    maximum_lat = max(point[1] for point in anchors) + 0.28
    minimum_lon = min(point[0] for point in anchors) - 0.28
    maximum_lon = max(point[0] for point in anchors) + 0.28
    return [station for station in stations
            if minimum_lat <= station["latitude"] <= maximum_lat
            and minimum_lon <= station["longitude"] <= maximum_lon
            and any(haversine_km((station["latitude"], station["longitude"]), (point[1], point[0])) <= radius_km for point in anchors)]

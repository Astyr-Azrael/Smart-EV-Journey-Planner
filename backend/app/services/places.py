"""India-only place suggestions; Photon is optional, BEE cities work offline."""

import logging
from collections import Counter

from .bee_data import load_bee_stations
from .geo import ExternalServiceError, _get_json

logger = logging.getLogger(__name__)
ALIASES = {"bangalore": "bengaluru", "bombay": "mumbai", "madras": "chennai", "calcutta": "kolkata"}


def _local_suggestions(query: str) -> list[dict]:
    term = ALIASES.get(query.casefold(), query.casefold())
    counts: Counter[tuple[str, str]] = Counter()
    locations: dict[tuple[str, str], tuple[float, float]] = {}
    for station in load_bee_stations():
        city = str(station.get("city") or "").strip()
        state = str(station.get("state") or "").strip()
        if len(city) < 2 or term not in city.casefold():
            continue
        key = (city, state)
        counts[key] += 1
        locations.setdefault(key, (station["latitude"], station["longitude"]))
    ranked = sorted(counts, key=lambda key: (not key[0].casefold().startswith(term), -counts[key], key[0]))
    return [{"label": ", ".join(filter(None, key)), "latitude": locations[key][0], "longitude": locations[key][1]} for key in ranked[:6]]


async def suggest_places(query: str) -> list[dict]:
    query = query.strip()
    if len(query) < 2:
        return []
    try:
        payload = await _get_json(
            "https://photon.komoot.io/api/",
            params={"q": query, "countrycode": "IN", "limit": 8, "lang": "en"},
            timeout_seconds=4,
        )
        suggestions = []
        seen = set()
        for feature in payload.get("features", []) if isinstance(payload, dict) else []:
            props = feature.get("properties") or {}
            coordinates = (feature.get("geometry") or {}).get("coordinates") or []
            if props.get("countrycode", "").upper() != "IN" or not props.get("name") or len(coordinates) < 2:
                continue
            label = ", ".join(dict.fromkeys(filter(None, [props["name"], props.get("city"), props.get("state")])))
            if label.casefold() in seen:
                continue
            seen.add(label.casefold())
            suggestions.append({"label": label, "latitude": float(coordinates[1]), "longitude": float(coordinates[0])})
            if len(suggestions) == 6:
                break
        if suggestions:
            return suggestions
    except (ExternalServiceError, KeyError, TypeError, ValueError) as exc:
        logger.warning("Photon suggestions unavailable; using local Indian city index: %s", exc)
    return _local_suggestions(query)

from .geo import distance_to_route_km


def connector_compatibility(station: dict, connector: str) -> bool | None:
    connectors = station.get("connectors") or []
    if not connectors:
        return None
    wanted = connector.strip().lower()
    return wanted in {item.strip().lower() for item in connectors}


def annotate_route(route: dict, stations: list[dict], connector: str, corridor_km: float = 5.0) -> tuple[dict, list[dict]]:
    relevant = []
    for station in stations:
        deviation = distance_to_route_km(station, route["geometry"]["coordinates"])
        if deviation > corridor_km:
            continue
        relevant.append({
            **station,
            "detour_km": round(deviation, 1),
            "compatible": connector_compatibility(station, connector),
        })
    compatible = sum(item["compatible"] is True for item in relevant)
    unknown = sum(item["compatible"] is None for item in relevant)
    return {
        **route,
        "station_count": len(relevant),
        "compatible_station_count": compatible,
        "unknown_compatibility_count": unknown,
    }, relevant


def choose_charging_friendly_route(routes: list[dict], stations: list[dict], connector: str) -> dict:
    if not routes:
        raise ValueError("At least one route is required")
    annotated = [annotate_route(route, stations, connector) for route in routes]
    default_route, default_stations = annotated[0]
    reasonable = [
        item for item in annotated
        if item[0]["distance_km"] <= default_route["distance_km"] * 1.20
        and item[0]["duration_minutes"] <= default_route["duration_minutes"] + 15
    ]
    selected_route, selected_stations = max(
        reasonable or [annotated[0]],
        key=lambda item: (
            item[0]["compatible_station_count"],
            item[0]["station_count"],
            -item[0]["duration_minutes"],
        ),
    )
    improved = selected_route is not default_route and (
        selected_route["compatible_station_count"] > default_route["compatible_station_count"]
        or selected_route["station_count"] > default_route["station_count"]
    )
    if not improved:
        selected_route, selected_stations = default_route, default_stations
    return {
        "default": default_route,
        "charging_friendly": selected_route,
        "charging_stations": selected_stations,
        "alternative_found": improved,
        "message": None if improved else "No better charging-focused alternative was found. The default route remains highlighted.",
    }

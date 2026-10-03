from .geo import haversine_km


def _progress_km(origin: tuple[float, float], station: dict, destination: tuple[float, float], total_km: float) -> float:
    direct_total = max(haversine_km(origin, destination), 0.1)
    direct_progress = haversine_km(origin, (station["latitude"], station["longitude"]))
    return min(total_km, total_km * direct_progress / direct_total)


def build_charge_plan(
    *,
    stations: list[dict],
    origin: tuple[float, float],
    destination: tuple[float, float],
    total_km: float,
    usable_range_km: float,
    start_soc: float,
    arrival_soc: float,
    battery_kwh: float,
    consumption_kwh_100km: float,
) -> dict:
    start_range = usable_range_km * start_soc / 100
    reserve_range = usable_range_km * arrival_soc / 100
    leg_limit = max(30.0, usable_range_km - reserve_range)
    remaining_reach = max(20.0, start_range - reserve_range)
    sorted_stations = sorted(
        ({**station, "progress_km": _progress_km(origin, station, destination, total_km)} for station in stations if station.get("compatible") is True),
        key=lambda item: item["progress_km"],
    )
    stops: list[dict] = []
    current = 0.0
    while total_km - current > remaining_reach:
        lower = current + max(12, remaining_reach * 0.48)
        upper = current + remaining_reach
        candidates = [station for station in sorted_stations if lower <= station["progress_km"] <= upper]
        if not candidates:
            return {
                "feasible": False,
                "reason": "No mapped charger was found inside the safe driving window. Increase range, raise start charge, or inspect stations near the route.",
                "stops": stops,
            }
        selected = max(candidates, key=lambda item: (item["progress_km"], item.get("power_kw") or 0, -item.get("detour_km", 0)))
        leg_km = selected["progress_km"] - current
        arrival = max(5, round(100 * (remaining_reach + reserve_range - leg_km) / usable_range_km))
        target_soc = min(90, max(70, round(100 * min(leg_limit + reserve_range, usable_range_km) / usable_range_km)))
        energy = max(4.0, battery_kwh * (target_soc - arrival) / 100)
        charge_minutes = round(energy / 60 * 60 + 8)
        reasons = [
            "reachable before the configured reserve",
            f"only {selected.get('detour_km', 0)} km from the route",
        ]
        if selected.get("connectors"):
            reasons.append(f"supports {', '.join(selected['connectors'][:2])}")
        if selected.get("power_kw"):
            reasons.append(f"reports up to {selected['power_kw']:g} kW")
        stops.append({**selected, "category": "Recommended", "recommendation_reasons": reasons, "arrival_soc": arrival, "target_soc": target_soc, "charge_minutes": charge_minutes, "energy_kwh": round(energy, 1)})
        current = selected["progress_km"]
        remaining_reach = leg_limit
        sorted_stations = [station for station in sorted_stations if station["progress_km"] > current + 8]
        if len(stops) > 10:
            break
    drive_energy = round(total_km * consumption_kwh_100km / 100, 1)
    return {
        "feasible": True,
        "reason": None,
        "stops": stops,
        "drive_energy_kwh": drive_energy,
        "charging_minutes": sum(stop["charge_minutes"] for stop in stops),
        "estimated_cost_inr": round(drive_energy * 15.5),
    }

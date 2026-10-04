from app.services.crawler import parse_page
from app.services.geo import build_route_profile, haversine_km, station_from_element, station_route_position
from app.services.planner import build_charge_plan
from app.services.data_cleaner import clean_and_merge, normalize_connector, normalize_power
from app.services.route_intelligence import annotate_route, choose_charging_friendly_route, select_display_stations
from app.schemas import PlanRequest
from pydantic import ValidationError


def test_haversine_known_distance():
    distance = haversine_km((28.6139, 77.2090), (28.7041, 77.1025))
    assert 13 < distance < 16


def test_station_parser_uses_real_osm_shape():
    item = station_from_element({"type": "node", "id": 42, "lat": 28.6, "lon": 77.2, "tags": {"amenity": "charging_station", "name": "Charge Hub", "socket:type2_combo": "2"}})
    assert item["name"] == "Charge Hub"
    assert item["connectors"] == ["CCS2"]
    assert item["source_url"].endswith("/node/42")


def test_html_page_extraction():
    result = parse_page("<html><head><title>EV map</title></head><body><h1>Charging stations</h1><a href='/network'>Network</a><script type='application/ld+json'>{\"@type\":\"Place\"}</script></body></html>", "https://example.com/ev")
    assert result["title"] == "EV map"
    assert result["links"] == ["https://example.com/network"]
    assert "charging" in result["ev_terms_found"]


def test_planner_selects_progressive_stop():
    stations = [
        {"name": "A", "latitude": 0.0, "longitude": 1.8, "detour_km": 1, "compatible": True},
        {"name": "B", "latitude": 0.0, "longitude": 3.6, "detour_km": 1, "compatible": True},
    ]
    plan = build_charge_plan(
        stations=stations,
        origin=(0.0, 0.0),
        destination=(0.0, 5.0),
        total_km=560,
        usable_range_km=300,
        start_soc=90,
        arrival_soc=15,
        battery_kwh=60,
        consumption_kwh_100km=17,
        max_charge_kw=80,
    )
    assert plan["feasible"] is True
    assert len(plan["stops"]) == 2
    assert "reachable" in plan["stops"][0]["recommendation_reasons"][0]
    assert plan["stops"][0]["effective_charge_kw"] == 80
    assert plan["stops"][0]["charge_minutes"] > 8


def test_route_progress_uses_road_geometry_not_radial_distance():
    coordinates = [[0.0, 0.0], [0.0, 1.0], [1.0, 1.0]]
    profile = build_route_profile(coordinates, max_points=10)
    deviation, progress = station_route_position(
        {"latitude": 0.75, "longitude": 0.01},
        profile,
        route_distance_km=222.4,
    )
    assert deviation < 2
    assert 80 < progress < 90


def test_annotated_station_keeps_cumulative_route_progress():
    route = {"distance_km": 222.4, "duration_minutes": 180, "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [0.0, 1.0], [1.0, 1.0]]}}
    stations = [{"osm_key": "test/1", "latitude": 0.75, "longitude": 0.01, "connectors": ["CCS2"]}]
    _, relevant = annotate_route(route, stations, "CCS2")
    assert len(relevant) == 1
    assert 80 < relevant[0]["progress_km"] < 90


def test_planner_respects_ninety_percent_departure_after_charge():
    stations = [
        {"name": "First", "latitude": 0.0, "longitude": 1.0, "progress_km": 200, "detour_km": 1, "compatible": True},
        {"name": "Second", "latitude": 0.0, "longitude": 2.0, "progress_km": 420, "detour_km": 1, "compatible": True},
    ]
    plan = build_charge_plan(
        stations=stations,
        origin=(0.0, 0.0),
        destination=(0.0, 5.0),
        total_km=500,
        usable_range_km=300,
        start_soc=90,
        arrival_soc=15,
        battery_kwh=60,
        consumption_kwh_100km=17,
        max_charge_kw=80,
    )
    assert plan["feasible"] is True
    assert [stop["progress_km"] for stop in plan["stops"]] == [200, 420]
    assert plan["stops"][1]["leg_distance_km"] == 220
    assert plan["stops"][1]["arrival_soc"] == 17


def test_incomplete_plan_keeps_estimates_and_explains_assumptions():
    plan = build_charge_plan(
        stations=[],
        origin=(0.0, 0.0),
        destination=(0.0, 5.0),
        total_km=500,
        usable_range_km=300,
        start_soc=90,
        arrival_soc=15,
        battery_kwh=60,
        consumption_kwh_100km=17,
        max_charge_kw=80,
    )
    assert plan["feasible"] is False
    assert plan["charging_minutes"] == 0
    assert plan["drive_energy_kwh"] == 85
    assert "estimate" in plan["calculation_note"].lower()


def test_cleaner_normalizes_and_merges_nearby_sources():
    base = {"name": "Tata EZ Charge", "operator": "Tata Power", "latitude": 19.076, "longitude": 72.8777, "connectors": ["CCS Combo 2"], "power_kw": "60 kW", "charger_type": "DC", "source_url": "https://example.com/a", "provenance": {}, "raw_tags": {}}
    records = [
        {**base, "osm_key": "node/1", "source": "OpenStreetMap", "source_id": "node/1"},
        {**base, "osm_key": "ocm/2", "source": "Open Charge Map", "source_id": "2", "latitude": 19.0762, "longitude": 72.8778},
    ]
    cleaned = clean_and_merge(records)
    assert len(cleaned) == 1
    assert cleaned[0]["source"] == "Open Charge Map + OpenStreetMap"
    assert cleaned[0]["power_kw"] == 60.0


def test_normalizers():
    assert normalize_connector("CCS Combo 2") == "CCS2"
    assert normalize_power("120KW") == 120.0


def test_reserve_must_be_less_than_battery():
    try:
        PlanRequest(origin="Mumbai", destination="Pune", start_soc=15, arrival_soc=15)
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected reserve validation error")


def test_place_coordinates_must_be_provided_as_pairs():
    try:
        PlanRequest(origin="Delhi", destination="Jaipur", origin_latitude=28.61)
    except ValidationError:
        pass
    else:
        raise AssertionError("Expected coordinate pair validation error")


def test_charging_friendly_route_prefers_reasonable_compatible_alternative():
    routes = [
        {"distance_km": 100, "duration_minutes": 60, "geometry": {"type": "LineString", "coordinates": [[0, 0.2], [0.5, 0.2], [1, 0.2]]}},
        {"distance_km": 110, "duration_minutes": 70, "geometry": {"type": "LineString", "coordinates": [[0, 0.05], [0.5, 0.05], [1, 0.05]]}},
    ]
    stations = [{"osm_key": "node/7", "latitude": 0.05, "longitude": 0.5, "connectors": ["CCS2"]}]
    result = choose_charging_friendly_route(routes, stations, "CCS2")
    assert result["alternative_found"] is True
    assert result["charging_friendly"]["distance_km"] == 110
    assert result["charging_friendly"]["compatible_station_count"] == 1


def test_route_does_not_count_scooter_only_points_as_car_stations():
    route = {"distance_km": 100, "duration_minutes": 60, "geometry": {"type": "LineString", "coordinates": [[73.0, 18.8], [73.05, 18.8], [73.1, 18.8]]}}
    stations = [
        {"osm_key": "bee/1", "latitude": 18.8, "longitude": 73.05, "connectors": ["LEV"]},
        {"osm_key": "bee/2", "latitude": 18.8, "longitude": 73.06, "connectors": ["CCS2"]},
    ]
    result = choose_charging_friendly_route([route], stations, "CCS2")
    assert result["charging_friendly"]["station_count"] == 1
    assert [station["osm_key"] for station in result["charging_stations"]] == ["bee/2"]


def test_unspecified_ccs_is_unknown_compatibility():
    route = {"distance_km": 100, "duration_minutes": 60, "geometry": {"type": "LineString", "coordinates": [[73.0, 18.8]]}}
    station = {"osm_key": "bee/3", "latitude": 18.8, "longitude": 73.0, "connectors": ["CCS (unspecified)"]}
    result = choose_charging_friendly_route([route], [station], "CCS2")
    assert result["charging_stations"][0]["compatible"] is None
    assert result["charging_friendly"]["unknown_compatibility_count"] == 1


def test_map_sample_keeps_compatible_stations_and_spans_route():
    stations = [{"osm_key": f"bee/{i}", "latitude": 18.8, "longitude": 73 + i * 0.01, "compatible": i in (1, 20, 39)} for i in range(40)]
    displayed = select_display_stations(stations, (18.8, 73), limit=10)
    assert len(displayed) == 10
    assert {"bee/1", "bee/20", "bee/39"}.issubset({station["osm_key"] for station in displayed})
    assert displayed[0]["longitude"] < 73.1
    assert displayed[-1]["longitude"] > 73.3


def test_map_sample_always_includes_planned_stop():
    stations = [{"osm_key": f"bee/{i}", "latitude": 18.8, "longitude": 73 + i * 0.01, "compatible": True} for i in range(40)]
    displayed = select_display_stations(stations, (18.8, 73), limit=10, stops=[stations[17]])
    assert "bee/17" in {station["osm_key"] for station in displayed}

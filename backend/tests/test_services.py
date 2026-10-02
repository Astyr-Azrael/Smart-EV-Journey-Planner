from app.services.crawler import parse_page
from app.services.geo import haversine_km, station_from_element
from app.services.planner import build_charge_plan
from app.services.data_cleaner import clean_and_merge, normalize_connector, normalize_power
from app.services.route_intelligence import choose_charging_friendly_route
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
        {"name": "A", "latitude": 0.0, "longitude": 1.8, "detour_km": 1},
        {"name": "B", "latitude": 0.0, "longitude": 3.6, "detour_km": 1},
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
    )
    assert plan["feasible"] is True
    assert len(plan["stops"]) == 2
    assert "reachable" in plan["stops"][0]["recommendation_reasons"][0]


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


def test_charging_friendly_route_prefers_reasonable_compatible_alternative():
    routes = [
        {"distance_km": 100, "duration_minutes": 60, "geometry": {"type": "LineString", "coordinates": [[0, 0], [0.5, 0], [1, 0]]}},
        {"distance_km": 110, "duration_minutes": 70, "geometry": {"type": "LineString", "coordinates": [[0, 0.05], [0.5, 0.05], [1, 0.05]]}},
    ]
    stations = [{"osm_key": "node/7", "latitude": 0.05, "longitude": 0.5, "connectors": ["CCS2"]}]
    result = choose_charging_friendly_route(routes, stations, "CCS2")
    assert result["alternative_found"] is True
    assert result["charging_friendly"]["distance_km"] == 110
    assert result["charging_friendly"]["compatible_station_count"] == 1

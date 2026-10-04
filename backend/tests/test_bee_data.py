from app.services.bee_data import normalize_bee_row, stations_near_routes
from app.services.planner import build_charge_plan


def test_bee_row_maps_car_connector_and_indian_coordinates():
    row = ["IOCL", "Govt.", "Maharashtra", "Raigad", "Khopoli", "Fuel stop", "18.787356", "73.345787", "CCS-II", "60", "60", "1"]
    record = normalize_bee_row(row, 674)
    assert record["connectors"] == ["CCS2"]
    assert record["power_kw"] == 60.0
    assert record["latitude"] == 18.787356
    assert record["source"] == "BEE EV Yatra"


def test_bee_row_rejects_bad_coordinate_and_preserves_lev_type():
    bad = ["IOCL", "Govt.", "Maharashtra", "Pune", "Pune", "Bad", "19.621193", "19.621193", "Type-II AC", "7.4", "7.4", "1"]
    assert normalize_bee_row(bad, 684) is None
    lev = ["Ather", "Private", "Maharashtra", "Pune", "Pune", "Scooter point", "18.7", "73.8", "LEV DC Charge Point", "3.3", "3.3", "1"]
    assert normalize_bee_row(lev, 674)["connectors"] == ["LEV"]


def test_unqualified_ccs_is_not_mislabeled_ccs1():
    row = ["Operator", "Private", "Maharashtra", "Pune", "Pune", "Fast charge", "18.7", "73.8", "CCS", "60", "60", "1"]
    assert normalize_bee_row(row, 674)["connectors"] == ["CCS (unspecified)"]


def test_combo_charger_keeps_each_listed_connector():
    row = ["Operator", "Private", "Maharashtra", "Pune", "Pune", "Combo site", "18.7", "73.8", "Combo (CCS-II + CHAdeMO + Type II)", "60", "60", "1"]
    assert normalize_bee_row(row, 674)["connectors"] == ["CCS2", "CHAdeMO", "Type 2"]


def test_state_spelling_and_case_are_normalized():
    row = ["Operator", "Private", "UTTRAKHAND", "Dehradun", "Dehradun", "Charge point", "30.3", "78.0", "CCS-II", "60", "60", "1"]
    assert normalize_bee_row(row, 900)["state"] == "Uttarakhand"


def test_spatial_search_works_for_routes_anywhere_in_india():
    stations = [
        {"latitude": 18.78, "longitude": 73.35, "name": "Khopoli"},
        {"latitude": 12.97, "longitude": 77.59, "name": "Bengaluru"},
    ]
    route = [[77.58, 12.96], [77.60, 12.98]]
    assert [s["name"] for s in stations_near_routes(stations, [route])] == ["Bengaluru"]


def test_planner_does_not_select_known_incompatible_charger():
    stations = [
        {"name": "Scooter only", "latitude": 0.0, "longitude": 1.8, "detour_km": 1, "compatible": False},
        {"name": "Car charger", "latitude": 0.0, "longitude": 1.9, "detour_km": 1, "compatible": True},
    ]
    plan = build_charge_plan(stations=stations, origin=(0, 0), destination=(0, 4), total_km=428, usable_range_km=300, start_soc=90, arrival_soc=15, battery_kwh=60, consumption_kwh_100km=17)
    assert plan["feasible"] is True
    assert plan["stops"][0]["name"] == "Car charger"

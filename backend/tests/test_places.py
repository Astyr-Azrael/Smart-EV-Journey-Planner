import asyncio

from app.services import places


def test_photon_suggestions_are_limited_to_india_and_deduplicated(monkeypatch):
    async def fake_get(*args, **kwargs):
        return {"features": [
            {"properties": {"name": "Bengaluru", "state": "Karnataka", "countrycode": "IN"}, "geometry": {"coordinates": [77.59, 12.97]}},
            {"properties": {"name": "Bengaluru", "state": "Karnataka", "countrycode": "IN"}, "geometry": {"coordinates": [77.59, 12.97]}},
            {"properties": {"name": "Bangalore", "countrycode": "US"}, "geometry": {"coordinates": [-80, 30]}},
        ]}

    monkeypatch.setattr(places, "_get_json", fake_get)
    result = asyncio.run(places.suggest_places("Bangalore"))
    assert result[0] == {"label": "Bengaluru, Karnataka", "latitude": 12.97, "longitude": 77.59}
    assert all(item["longitude"] > 68 for item in result)
    assert len({item["label"] for item in result}) == len(result)


def test_suggestions_use_local_station_cities_when_photon_fails(monkeypatch):
    async def unavailable(*args, **kwargs):
        raise places.ExternalServiceError("offline")

    monkeypatch.setattr(places, "_get_json", unavailable)
    monkeypatch.setattr(places, "load_bee_stations", lambda: [
        {"city": "Bengaluru", "state": "Karnataka", "latitude": 12.97, "longitude": 77.59},
        {"city": "Bengaluru", "state": "Karnataka", "latitude": 12.98, "longitude": 77.60},
    ])
    assert asyncio.run(places.suggest_places("Bangalore"))[0]["label"] == "Bengaluru, Karnataka"

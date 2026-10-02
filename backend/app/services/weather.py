import logging

from .geo import ExternalServiceError, _get_json
from ..config import settings

logger = logging.getLogger(__name__)

WEATHER_LABELS = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    61: "Rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Rain showers",
    95: "Thunderstorm",
}


async def fetch_weather(lat: float, lon: float) -> dict | None:
    try:
        payload = await _get_json(
            settings.open_meteo_url,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,precipitation,rain,weather_code,wind_speed_10m",
                "hourly": "precipitation_probability,visibility",
                "forecast_days": 1,
                "timezone": "auto",
            },
        )
        current = payload.get("current") or {}
        hourly = payload.get("hourly") or {}
        visibility = (hourly.get("visibility") or [None])[0]
        precipitation_probability = max((hourly.get("precipitation_probability") or [0])[:6])
        wind = current.get("wind_speed_10m")
        code = current.get("weather_code")
        caution = "Normal"
        if precipitation_probability >= 60 or (current.get("rain") or 0) > 2:
            caution = "Rain caution"
        elif visibility is not None and visibility < 3000:
            caution = "Low visibility"
        elif wind is not None and wind > 35:
            caution = "High wind"
        return {
            "temperature_c": current.get("temperature_2m"),
            "precipitation_probability": precipitation_probability,
            "wind_speed_kmh": wind,
            "visibility_m": visibility,
            "condition": WEATHER_LABELS.get(code, f"Weather code {code}" if code is not None else "Unknown"),
            "advisory": caution,
            "source": "Open-Meteo",
        }
    except ExternalServiceError as exc:
        logger.warning("Weather unavailable: %s", exc)
        return None

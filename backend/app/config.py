from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Smart EV Journey Planner"
    database_url: str = f"sqlite:///{(ROOT / 'ev_planner.db').as_posix()}"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    osrm_url: str = "https://router.project-osrm.org"
    ors_url: str = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    open_charge_map_url: str = "https://api.openchargemap.io/v3/poi"
    open_charge_map_api_key: str | None = None
    ors_api_key: str | None = None
    demo_mode: bool = False
    cache_ttl_minutes: int = 60
    user_agent: str = "SmartEVJourneyPlanner/1.0 (educational project)"
    request_timeout_seconds: float = 35.0
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

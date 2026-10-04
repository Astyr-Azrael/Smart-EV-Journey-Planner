from pydantic import BaseModel, Field, model_validator


class PlanRequest(BaseModel):
    origin: str = Field(min_length=2, max_length=200)
    destination: str = Field(min_length=2, max_length=200)
    origin_latitude: float | None = Field(default=None, ge=6, le=38)
    origin_longitude: float | None = Field(default=None, ge=68, le=98)
    destination_latitude: float | None = Field(default=None, ge=6, le=38)
    destination_longitude: float | None = Field(default=None, ge=68, le=98)
    ev_id: str = Field(default="tata-nexon-ev-45", min_length=3, max_length=100)
    vehicle: str = Field(default="Custom EV", max_length=120)
    usable_range_km: float = Field(default=350, ge=60, le=1000)
    start_soc: float = Field(default=85, ge=10, le=100)
    arrival_soc: float = Field(default=15, ge=5, le=60)
    consumption_kwh_100km: float = Field(default=17, ge=6, le=60)
    battery_kwh: float = Field(default=60, ge=10, le=250)
    connector: str | None = Field(default=None, max_length=80)
    preferred_charger_type: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def reserve_must_be_below_charge(self):
        if self.arrival_soc >= self.start_soc:
            raise ValueError("Arrival reserve must be lower than the starting charge")
        if (self.origin_latitude is None) != (self.origin_longitude is None):
            raise ValueError("Origin latitude and longitude must be provided together")
        if (self.destination_latitude is None) != (self.destination_longitude is None):
            raise ValueError("Destination latitude and longitude must be provided together")
        return self


class CrawlRequest(BaseModel):
    place: str = Field(min_length=2, max_length=200)
    radius_km: float = Field(default=25, ge=1, le=100)


class InspectRequest(BaseModel):
    url: str = Field(min_length=10, max_length=1000)


class MultiPageInspectRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=5)


class DynamicInspectRequest(BaseModel):
    url: str = Field(min_length=10, max_length=1000)
    wait_css: str = Field(min_length=1, max_length=200)
    item_css: str = Field(min_length=1, max_length=200)
    max_items: int = Field(default=20, ge=1, le=100)

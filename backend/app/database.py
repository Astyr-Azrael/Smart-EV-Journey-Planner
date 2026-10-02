import json
from datetime import date, datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import ROOT, settings


class Base(DeclarativeBase):
    pass


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    osm_key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(240), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    operator: Mapped[str | None] = mapped_column(String(180), nullable=True)
    address: Mapped[str | None] = mapped_column(String(400), nullable=True)
    access: Mapped[str | None] = mapped_column(String(80), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(String(180), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    connectors: Mapped[list] = mapped_column(JSON, default=list)
    charger_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    power_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="OpenStreetMap")
    source_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    source_url: Mapped[str] = mapped_column(String(500))
    raw_tags: Mapped[dict] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Journey(Base):
    __tablename__ = "journeys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin: Mapped[str] = mapped_column(String(240))
    destination: Mapped[str] = mapped_column(String(240))
    distance_km: Mapped[float] = mapped_column(Float)
    duration_minutes: Mapped[float] = mapped_column(Float)
    vehicle: Mapped[str] = mapped_column(String(160))
    plan: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40))
    records_found: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ApiCache(Base):
    __tablename__ = "api_cache"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class EVSpec(Base):
    __tablename__ = "ev_specs"

    ev_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    manufacturer: Mapped[str] = mapped_column(String(80), index=True)
    model: Mapped[str] = mapped_column(String(120))
    variant: Mapped[str] = mapped_column(String(120))
    battery_kwh: Mapped[float] = mapped_column(Float)
    certified_range_km: Mapped[float] = mapped_column(Float)
    ac_connector: Mapped[str] = mapped_column(String(80))
    dc_connector: Mapped[str] = mapped_column(String(80))
    max_ac_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_dc_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str] = mapped_column(String(500))
    last_updated: Mapped[str] = mapped_column(String(20), default=lambda: date.today().isoformat())


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
    if settings.database_url.startswith("sqlite"):
        additions = {
            "charger_type": "VARCHAR(80)", "power_kw": "FLOAT", "status": "VARCHAR(80)",
            "city": "VARCHAR(120)", "state": "VARCHAR(120)", "country": "VARCHAR(80)",
            "source": "VARCHAR(100) NOT NULL DEFAULT 'OpenStreetMap'", "source_id": "VARCHAR(120)",
            "provenance": "JSON NOT NULL DEFAULT '{}'",
        }
        with engine.begin() as connection:
            existing = {row[1] for row in connection.execute(text("PRAGMA table_info(stations)"))}
            for column, definition in additions.items():
                if column not in existing:
                    connection.execute(text(f"ALTER TABLE stations ADD COLUMN {column} {definition}"))
    seed_path = ROOT / "backend" / "data" / "ev_specs.json"
    if not seed_path.exists():
        return
    records = json.loads(seed_path.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        for record in records:
            existing = db.get(EVSpec, record["ev_id"])
            if existing:
                for key, value in record.items():
                    setattr(existing, key, value)
            else:
                db.add(EVSpec(**record))
        db.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

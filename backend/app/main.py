import asyncio
import logging
import re
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from .config import ROOT, settings
from .database import CrawlRun, EVSpec, Journey, Station, get_db, init_db
from .schemas import CrawlRequest, DynamicInspectRequest, InspectRequest, MultiPageInspectRequest, PlanRequest
from .scrapers.selenium_scraper import scrape_dynamic_page
from .services.crawler import CrawlSafetyError, inspect_public_page
from .services.data_cleaner import clean_and_merge, export_csv
from .services.geo import ExternalServiceError, fetch_multi_source_stations, fetch_routes, fetch_stations_near, geocode, haversine_km
from .services.planner import build_charge_plan
from .services.route_intelligence import choose_charging_friendly_route, select_display_stations
from .services.bee_data import load_bee_stations, stations_near_routes
from .services.places import suggest_places

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", handlers=[logging.FileHandler(LOG_DIR / "app.log", encoding="utf-8"), logging.StreamHandler()])
logger = logging.getLogger(__name__)
EXPORT_PATH = ROOT / "data" / "exports" / "stations.csv"
STATION_FIELDS = {column.name for column in Station.__table__.columns if column.name not in {"id", "fetched_at"}}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info("Smart EV Journey Planner API started")
    yield


app = FastAPI(title=settings.app_name, version="1.1.0", description="Multi-source EV route intelligence using live APIs, ethical scraping, cleaning and explainable recommendations.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


def station_dict(station: Station) -> dict:
    return {
        "id": station.id, "osm_key": station.osm_key, "name": station.name,
        "latitude": station.latitude, "longitude": station.longitude,
        "operator": station.operator, "address": station.address, "access": station.access,
        "opening_hours": station.opening_hours, "capacity": station.capacity,
        "connectors": station.connectors or [], "charger_type": station.charger_type,
        "power_kw": station.power_kw, "status": station.status, "city": station.city,
        "state": station.state, "country": station.country, "source": station.source,
        "source_id": station.source_id,
        "provenance": station.provenance or {}, "source_url": station.source_url,
        "raw_tags": station.raw_tags or {},
        "fetched_at": station.fetched_at.isoformat(),
    }


def ev_dict(ev: EVSpec) -> dict:
    return {column.name: getattr(ev, column.name) for column in EVSpec.__table__.columns}


def upsert_stations(db: Session, records: list[dict]) -> int:
    for record in records:
        persistable = {key: value for key, value in record.items() if key in STATION_FIELDS}
        existing = db.scalar(select(Station).where(Station.osm_key == persistable["osm_key"]))
        if existing:
            for key, value in persistable.items():
                setattr(existing, key, value)
            existing.fetched_at = datetime.now(timezone.utc)
        else:
            db.add(Station(**persistable))
    db.commit()
    export_csv(records, EXPORT_PATH)
    return len(records)


def tariff_details(tags: dict) -> tuple[str | None, float | None]:
    raw_value = tags.get("charge") or tags.get("fee")
    if raw_value in (None, ""):
        return None, None
    value = str(raw_value).strip()
    normalized = value.lower()
    if normalized in {"no", "free"}:
        return "Free", 0.0
    if normalized in {"yes", "paid"}:
        return "Paid — rate unavailable", None
    match = re.search(r"(?:₹|inr|rs\.?)\s*(\d+(?:\.\d+)?)", normalized, re.IGNORECASE)
    return value, float(match.group(1)) if match else None


@app.get("/")
def root():
    return {"service": settings.app_name, "docs": "/docs", "data_mode": "demo" if settings.demo_mode else "live"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": settings.app_name, "version": "1.1.0"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    station_count = db.scalar(select(func.count(Station.id))) or 0
    journey_count = db.scalar(select(func.count(Journey.id))) or 0
    last_crawl = db.scalar(select(CrawlRun).order_by(desc(CrawlRun.created_at)).limit(1))
    recent = db.scalars(select(Journey).order_by(desc(Journey.created_at)).limit(5)).all()
    return {
        "stations_indexed": station_count, "journeys_planned": journey_count,
        "data_providers": 5, "last_crawl": last_crawl.created_at.isoformat() if last_crawl else None,
        "recent_journeys": [{"id": item.id, "origin": item.origin, "destination": item.destination, "distance_km": item.distance_km, "created_at": item.created_at.isoformat()} for item in recent],
    }


@app.get("/api/evs")
def list_evs(db: Session = Depends(get_db)):
    rows = db.scalars(select(EVSpec).order_by(EVSpec.manufacturer, EVSpec.model, EVSpec.variant)).all()
    return [ev_dict(item) for item in rows]


@app.get("/api/places/suggest")
async def place_suggestions(q: str = Query(min_length=2, max_length=100)):
    return await suggest_places(q)


async def optional_live_stations(geometries: list[list[list[float]]], timeout_seconds: float = 7) -> tuple[list[dict], list[str]]:
    """Keep slow public Overpass servers from blocking an otherwise valid BEE-backed plan."""
    if settings.demo_mode:
        return [], []
    try:
        return await asyncio.wait_for(fetch_multi_source_stations(geometries), timeout=timeout_seconds)
    except TimeoutError:
        logger.warning("Live station enrichment exceeded %.1f seconds; continuing with BEE data", timeout_seconds)
        return [], []


@app.post("/api/crawl/stations")
async def crawl_stations(payload: CrawlRequest, db: Session = Depends(get_db)):
    try:
        place = await geocode(payload.place)
        records = clean_and_merge(await fetch_stations_near(place["latitude"], place["longitude"], payload.radius_km))
        saved = upsert_stations(db, records)
        db.add(CrawlRun(source="OpenStreetMap Overpass API", status="completed", records_found=saved, details={"place": place, "radius_km": payload.radius_km}))
        db.commit()
        logger.info("Station crawl completed: %s records around %s", saved, payload.place)
        return {"place": place, "radius_km": payload.radius_km, "records_found": saved, "stations": records}
    except ExternalServiceError as exc:
        cached = [station_dict(item) for item in db.scalars(select(Station)).all()]
        cached = [item for item in cached if haversine_km((place["latitude"], place["longitude"]), (item["latitude"], item["longitude"])) <= payload.radius_km] if 'place' in locals() else []
        db.add(CrawlRun(source="OpenStreetMap Overpass API", status="fallback" if cached else "failed", records_found=len(cached), details={"error": str(exc), "fallback": "SQLite cache" if cached else None}))
        db.commit()
        if cached:
            logger.warning("Live station crawl failed; returning %s cached records", len(cached))
            return {"place": place, "radius_km": payload.radius_km, "records_found": len(cached), "stations": cached, "fallback": "SQLite cache", "warning": str(exc)}
        logger.error("Station crawl failed with no cache: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/stations")
def list_stations(search: str | None = None, limit: int = Query(default=150, ge=1, le=500), db: Session = Depends(get_db)):
    query = select(Station).order_by(desc(Station.fetched_at)).limit(limit)
    if search:
        query = select(Station).where(Station.name.ilike(f"%{search}%")).order_by(desc(Station.fetched_at)).limit(limit)
    return [station_dict(item) for item in db.scalars(query).all()]


@app.get("/api/stations/export.csv")
def download_station_export(db: Session = Depends(get_db)):
    records = [station_dict(item) for item in db.scalars(select(Station).order_by(Station.id)).all()]
    export_csv(records, EXPORT_PATH)
    return FileResponse(EXPORT_PATH, media_type="text/csv", filename="smart_ev_stations.csv")


@app.get("/api/crawls")
def list_crawls(db: Session = Depends(get_db)):
    rows = db.scalars(select(CrawlRun).order_by(desc(CrawlRun.created_at)).limit(20)).all()
    return [{"id": row.id, "source": row.source, "status": row.status, "records_found": row.records_found, "details": row.details, "created_at": row.created_at.isoformat()} for row in rows]


@app.post("/api/journeys/plan")
async def plan_journey(payload: PlanRequest, db: Session = Depends(get_db)):
    ev = db.get(EVSpec, payload.ev_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Selected EV specification was not found")
    try:
        origin = await geocode(payload.origin)
        destination = await geocode(payload.destination)
        route_options = await fetch_routes(origin, destination)
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    geometries = [route["geometry"]["coordinates"] for route in route_options]
    bee_records = stations_near_routes(load_bee_stations(), geometries)
    source_names = ["BEE EV Yatra"] if bee_records else []
    raw_records = list(bee_records)
    try:
        live_records, live_sources = await optional_live_stations(geometries)
        raw_records.extend(live_records)
        source_names.extend(live_sources)
    except ExternalServiceError as exc:
        cached = [station_dict(item) for item in db.scalars(select(Station)).all()]
        cached_near_route = stations_near_routes(cached, geometries)
        raw_records.extend(cached_near_route)
        if cached_near_route:
            source_names.append("SQLite cache")
        logger.warning("Live station sources failed; using BEE data and %s cached route records: %s", len(cached_near_route), exc)
    records = clean_and_merge(raw_records)
    route_choice = choose_charging_friendly_route(route_options, records, ev.dc_connector)
    route = route_choice["charging_friendly"]
    route_stations = route_choice["charging_stations"]
    for station in route_stations:
        raw_tags = station.get("raw_tags") or {}
        tariff, tariff_per_kwh = tariff_details(raw_tags)
        station["opening_status"] = "Open 24/7" if station.get("opening_hours") == "24/7" else (station.get("status") or "Opening status unavailable")
        station["tariff"] = tariff
        station["estimated_cost_inr"] = round(ev.battery_kwh * 0.4 * tariff_per_kwh) if tariff_per_kwh is not None else None
        station["rating"] = None
        station["rating_count"] = None
        station["amenities"] = [label for key, label in (("parking", "Parking"), ("toilets", "Washroom"), ("cafe", "Cafe"), ("restaurant", "Restaurant")) if raw_tags.get(key) in ("yes", "customers")]
        effective_power = min(value for value in (station.get("power_kw"), ev.max_dc_kw) if value) if station.get("power_kw") and ev.max_dc_kw else None
        station["estimated_charge_minutes"] = round((ev.battery_kwh * 0.4 / effective_power) * 60) if effective_power else None
    if route_stations:
        upsert_stations(db, route_stations)
    usable_range = max(80, ev.certified_range_km * 0.80)
    consumption = round(ev.battery_kwh / max(ev.certified_range_km, 1) * 100 * 1.15, 1)
    plan = build_charge_plan(stations=route_stations, origin=(origin["latitude"], origin["longitude"]), destination=(destination["latitude"], destination["longitude"]), total_km=route["distance_km"], usable_range_km=usable_range, start_soc=payload.start_soc, arrival_soc=payload.arrival_soc, battery_kwh=ev.battery_kwh, consumption_kwh_100km=consumption)
    result = {
        "origin": origin, "destination": destination, "route": route, "routes": route_choice,
        "ev": ev_dict(ev),
        "stations_considered": len(route_stations), "nearby_stations": select_display_stations(route_stations, (origin["latitude"], origin["longitude"]), stops=plan["stops"]),
        "plan": plan, "station_sources": source_names,
        "data_freshness": datetime.now(timezone.utc).isoformat(),
        "attribution": "Routing © OSRM; charging data © Bureau of Energy Efficiency (EV Yatra), OpenStreetMap contributors and optional Open Charge Map; geocoding by Nominatim. BEE snapshot dated 26 October 2025; verify availability before travel.",
    }
    vehicle_label = f"{ev.manufacturer} {ev.model} {ev.variant}"
    journey = Journey(origin=origin["name"], destination=destination["name"], distance_km=route["distance_km"], duration_minutes=route["duration_minutes"], vehicle=vehicle_label, plan=result)
    db.add(journey)
    db.commit()
    result["journey_id"] = journey.id
    logger.info("Journey planned: %s to %s, %s stations", payload.origin, payload.destination, len(route_stations))
    return result


@app.get("/api/journeys")
def journeys(db: Session = Depends(get_db)):
    rows = db.scalars(select(Journey).order_by(desc(Journey.created_at)).limit(50)).all()
    return [{"id": row.id, "origin": row.origin, "destination": row.destination, "distance_km": row.distance_km, "duration_minutes": row.duration_minutes, "vehicle": row.vehicle, "created_at": row.created_at.isoformat()} for row in rows]


@app.get("/api/journeys/{journey_id}")
def journey_detail(journey_id: int, db: Session = Depends(get_db)):
    row = db.get(Journey, journey_id)
    if not row:
        raise HTTPException(status_code=404, detail="Journey not found")
    plan = dict(row.plan or {})
    # Keep journeys created by the earlier build usable after the richer route
    # comparison and EV-spec fields were introduced.
    if "routes" not in plan and plan.get("route"):
        route = plan["route"]
        stations = plan.get("nearby_stations") or []
        legacy_route = {
            **route,
            "name": "Saved route",
            "station_count": len(stations),
            "compatible_station_count": len(stations),
            "unknown_compatibility_count": 0,
            "stations": stations,
        }
        plan["routes"] = {
            "default": legacy_route,
            "charging_friendly": legacy_route,
            "alternative_found": False,
            "message": "This saved journey predates route alternatives.",
            "charging_stations": stations,
        }
    if "ev" not in plan:
        fallback_ev = db.scalar(select(EVSpec).order_by(EVSpec.manufacturer, EVSpec.model))
        if fallback_ev:
            plan["ev"] = {**ev_dict(fallback_ev), "manufacturer": row.vehicle, "model": "", "variant": ""}
    plan.setdefault("attribution", "Routing © OSRM; map/charging data © OpenStreetMap contributors; optional data © Open Charge Map; geocoding by Nominatim.")
    return {**plan, "journey_id": row.id}


@app.post("/api/crawler/inspect")
async def inspect_page(payload: InspectRequest, db: Session = Depends(get_db)):
    try:
        result = await inspect_public_page(payload.url)
        db.add(CrawlRun(source=result["url"], status="completed", records_found=len(result["links"]), details={"title": result["title"], "ev_terms": result["ev_terms_found"], "xpath": result["selector_demo"]["xpath_engine_available"]}))
        db.commit()
        return result
    except (CrawlSafetyError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/crawler/multipage")
async def inspect_multiple_pages(payload: MultiPageInspectRequest, db: Session = Depends(get_db)):
    results, errors = [], []
    for index, url in enumerate(payload.urls):
        if index:
            await asyncio.sleep(1.05)
        try:
            results.append(await inspect_public_page(url))
        except (CrawlSafetyError, httpx.HTTPError) as exc:
            errors.append({"url": url, "error": str(exc)})
    db.add(CrawlRun(source="multi-page static crawl", status="completed" if results else "failed", records_found=len(results), details={"requested": len(payload.urls), "errors": errors}))
    db.commit()
    return {"pages_requested": len(payload.urls), "pages_completed": len(results), "results": results, "errors": errors}


@app.post("/api/crawler/dynamic")
async def inspect_dynamic_page(payload: DynamicInspectRequest, db: Session = Depends(get_db)):
    try:
        await inspect_public_page(payload.url)
        result = await run_in_threadpool(scrape_dynamic_page, payload.url, payload.wait_css, payload.item_css, payload.max_items)
        db.add(CrawlRun(source=payload.url, status="completed", records_found=result["item_count"], details={"engine": result["engine"], "selector": payload.item_css}))
        db.commit()
        return result
    except (CrawlSafetyError, httpx.HTTPError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)):
    records = [station_dict(item) for item in db.scalars(select(Station)).all()]
    total = len(records)
    operators = Counter(item.get("operator") or "Unknown" for item in records)
    connectors = Counter(connector for item in records for connector in (item.get("connectors") or ["Unknown"]))
    charger_types = Counter(item.get("charger_type") or "Unknown" for item in records)
    sources_counter = Counter(item.get("source") or "Unknown" for item in records)

    def pct(field: str) -> float:
        return round(100 * sum(1 for item in records if item.get(field) not in (None, "", [])) / total, 1) if total else 0

    return {"total": total, "operators": operators.most_common(8), "connectors": connectors.most_common(10), "charger_types": charger_types.most_common(), "sources": sources_counter.most_common(), "completeness": {"coordinates": 100 if total else 0, "operator": pct("operator"), "connectors": pct("connectors"), "power_kw": pct("power_kw")}}


@app.get("/api/sources")
def sources():
    return {
        "sources": [
            {"name": "BEE EV Yatra", "role": "Nationwide charger-location and connector snapshot (26 October 2025)", "url": "https://beeindia.gov.in/WriteReadData/RTF1984/EV_PCS_Data_29277.pdf", "method": "Cleaned official PDF export"},
            {"name": "OpenStreetMap Overpass", "role": "Live charger crawl", "url": settings.overpass_url, "method": "REST + Overpass QL"},
            {"name": "Open Charge Map", "role": "Optional second charger source", "url": settings.open_charge_map_url, "method": "Authenticated REST API"},
            {"name": "Nominatim", "role": "Address geocoding", "url": settings.nominatim_url, "method": "REST API"},
            {"name": "OSRM", "role": "Road route geometry", "url": settings.osrm_url, "method": "REST API"},
            {"name": "Official EV specifications", "role": "Vehicle range, battery and connector data", "url": "https://prod-ev.tatamotors.com/nexon/ev/specifications.html", "method": "Curated backend reference database"},
        ],
        "scraping": [
            {"name": "Static inspector", "method": "BeautifulSoup + CSS selectors + lxml XPath", "policy": "User-selected public HTML after robots.txt and network safety checks"},
            {"name": "Dynamic inspector", "method": "Selenium + Chrome explicit waits", "policy": "Optional manual demonstration; runs only after the same safety and robots checks"},
        ],
        "policy": "The nationwide BEE EV Yatra snapshot is bundled and merged with live OpenStreetMap and optional Open Charge Map records. Source and connector provenance are retained; availability must be verified with the operator.",
    }

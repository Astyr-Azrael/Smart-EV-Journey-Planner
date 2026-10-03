# Smart EV Journey Planner

A full-stack Web Scraping and API course project for planning Indian EV journeys with live charging-station discovery, EV-aware route comparison and transparent source links.

The application includes a cleaned, nationwide snapshot of the Bureau of Energy Efficiency's EV Yatra charging-station list (26 October 2025). It also crawls OpenStreetMap station records through Overpass and optionally merges Open Charge Map data when an API key is configured. Every station retains its source link.

## User experience

The opening screen contains two full-height light-theme panels:

- **Go farther. Charge smarter.** opens the journey-planning experience.
- **The network, uncovered.** opens nearby-station discovery.

There is no sidebar on the opening screen. Journey mode exposes only Overview, Plan a journey, Journey history and Data sources. Network mode exposes only Overview and Nearest charging station. The crawler remains a backend data-ingestion capability rather than a user-facing navigation item.

The visual system uses the supplied light yellow `#F8FFE5` and emerald `#06D6A0` palette, with light variants, editorial typography and glass surfaces. There is no dark theme.

## Main features

- Select a manufacturer and Indian EV variant; battery, certified range, AC/DC connector and charging-power data load from the backend EV specification database.
- Geocode natural-language places with Nominatim.
- Request real road alternatives from OSRM.
- Find official BEE EV Yatra stations anywhere in India, enriched with live Overpass and optional Open Charge Map records.
- Apply a strict 5 km station-to-route filter.
- Highlight the charging-friendly route and keep the normal route visible as a faint comparison.
- Use the default route when no meaningfully better charging alternative exists.
- Show mapped stations and useful cards for opening status, tariff, rating, connector, power, compatibility, estimated top-up time/cost and amenities when the source provides them.
- Preserve saved journeys; journey rows and arrows reopen the complete result.
- Continue using the official nationwide snapshot and persisted station cache if a live station provider is temporarily unavailable.

Unknown values are shown as unavailable. The app does not invent ratings, tariffs, live occupancy or connector information and does not use AI/confidence/safety scores.

## Architecture

```text
React 19 + TypeScript + Vite
            │ REST / JSON
            ▼
FastAPI application ───────────── SQLite
  │         │          │           ├─ ev_specs
  │         │          │           ├─ stations
  │         │          │           ├─ journeys
  │         │          │           └─ crawl_runs
  ▼         ▼          ▼
Nominatim   OSRM       Overpass API
geocoding   routes     live charger crawl
                         │
                         └─ Open Charge Map (optional key)

BEE EV Yatra national snapshot ──► route station search

Backend-only scraping modules
  ├─ BeautifulSoup + CSS selectors
  ├─ lxml XPath
  ├─ optional Selenium explicit waits
  └─ robots.txt and private-network safety checks
```

## Repository layout

```text
Smart-EV-Journey-Planner/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── schemas.py
│   │   ├── scrapers/
│   │   └── services/
│   │       ├── geo.py
│   │       ├── route_intelligence.py
│   │       ├── planner.py
│   │       ├── data_cleaner.py
│   │       └── crawler.py
│   ├── data/ev_specs.json
│   ├── data/bee_stations.json
│   ├── scripts/extract_bee_stations.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/components/
│   ├── src/pages/
│   └── package.json
├── API_SOURCES.md
├── DATA_DICTIONARY.md
├── SCRAPING_SOURCES.md
├── TEST_CASES.md
└── run-dev.ps1
```

## Run locally

Prerequisites: Node.js 20+, Python 3.11+ and internet access for the public data providers.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API documentation: <http://localhost:8000/docs>

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. After dependencies are installed, Windows users can also run `./run-dev.ps1` from the repository root.

## Core API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service readiness |
| GET | `/api/evs` | Stored EV specification dropdown data |
| POST | `/api/journeys/plan` | Geocode, compare routes, crawl the corridor and plan charging |
| GET | `/api/journeys` | Saved journey list |
| GET | `/api/journeys/{id}` | Reopen a complete saved result |
| POST | `/api/crawl/stations` | Live nearest-station search used by network mode |
| GET | `/api/stations` | Cached normalized stations |
| GET | `/api/stations/export.csv` | Pandas-generated station export |
| GET | `/api/sources` | Provider and responsible-scraping metadata |

Course-demonstration scraping endpoints remain documented in FastAPI but are not exposed in the frontend sidebar.

## Live data behavior

- Overpass public instances can throttle or fail. Route crawling is split into small bounded parallel requests; successful records are cached and persisted.
- Nominatim requests are serialized to respect its public-instance policy.
- Open Charge Map enrichment is enabled only when `OPEN_CHARGE_MAP_API_KEY` is configured.
- The BEE snapshot is local and nationwide. To refresh it, download the latest station-level PDF from BEE, install `pdfplumber`, and run `python scripts/extract_bee_stations.py <pdf-path>` from `backend/`.
- The official snapshot contains location and connector data, not live occupancy. Check a station with its operator before relying on it during a trip.
- Public OSRM is suitable for low-volume demonstrations, not production traffic.
- Real-world charger metadata may omit connector, tariff, rating or opening data. Missing fields remain explicitly unavailable.

## Tests and production build

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm run build
```

## Attribution

Official charging-station snapshot © Bureau of Energy Efficiency (EV Yatra). Map and live charging data © OpenStreetMap contributors. Routing via OSRM. Geocoding via Nominatim. Optional station data © Open Charge Map. Official vehicle specification source links are stored with each EV record.

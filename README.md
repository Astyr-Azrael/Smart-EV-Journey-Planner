# VoltPath — Smart EV Journey Planner

VoltPath is a full-stack EV journey planner built for a Web Scraping and API course. It combines live charger discovery, road routing, geocoding, range-aware stop selection, responsible webpage inspection, and clear data provenance in a polished multi-page interface.

The application contains **no hard-coded sample chargers**. Station records are crawled from OpenStreetMap through Overpass at request time, normalized, timestamped, saved in SQLite, and linked back to their original map record.

## What it does

- Plans road journeys with vehicle range, battery, state-of-charge, reserve and connector preferences.
- Retrieves real road geometry from openrouteservice when configured, with OSRM fallback.
- Geocodes natural-language places with Nominatim.
- Crawls real charging stations from OpenStreetMap along the route corridor and optionally merges Open Charge Map records.
- Cleans and deduplicates cross-source records with Pandas, then exports normalized CSV data.
- Selects safe, progressive charging stops and estimates energy, time, and charging cost.
- Crawls stations around any city in a selectable radius.
- Inspects a public webpage while respecting `robots.txt`, blocking private-network URLs, and extracting metadata, headings, links and JSON-LD.
- Demonstrates BeautifulSoup, CSS selectors, lxml XPath, throttled multi-page extraction and optional Selenium explicit waits.
- Adds Open-Meteo route weather, confidence/provenance labels, provider fallbacks and infrastructure analytics.
- Stores crawl history, normalized stations and planned journeys in SQLite.
- Preserves source URLs, timestamps and attribution in the UI.

## Interface

The React UI uses the supplied light-yellow (`#F8FFE5`) and emerald (`#06D6A0`) reference palette with technology-focused glass surfaces, large editorial typography and responsive layouts. It is intentionally split across seven sidebar pages:

1. Overview
2. Plan a journey
3. Charging network
4. Web crawler
5. Analytics
6. Journey history
7. Data sources

## Architecture

```text
Browser (React 19 + Vite + TypeScript)
             │ REST / JSON
             ▼
FastAPI application ─────────────── SQLite
  │         │          │              ├─ stations
  │         │          │              ├─ journeys
  │         │          │              └─ crawl_runs
  │         │          │
  ▼         ▼          ▼
Nominatim   OSRM       Overpass API
geocoding   routing    live charger crawl
             │              │
             └ openrouteservice / Open Charge Map when keys are configured

Open-Meteo ─ route-midpoint weather

Public webpage inspector
  ├─ DNS/IP safety validation + robots.txt
  ├─ robots.txt policy
  ├─ HTML + metadata parsing
  ├─ JSON-LD + link extraction
  └─ CSS selectors / XPath / optional Selenium
```

### Repository layout

```text
Smart-EV-Journey-Planner/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI routes
│   │   ├── database.py          # SQLAlchemy models/session
│   │   ├── schemas.py           # Request validation
│   │   └── services/
│   │       ├── geo.py           # APIs + OSM record normalization
│   │       ├── planner.py       # Range-aware stop selection
│   │       └── crawler.py       # Safe HTML crawler/parser
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/components/          # Layout, map and shared UI
│   ├── src/pages/               # Six routed pages
│   └── package.json
├── .env.example
└── run-dev.ps1
```

## Run locally

Prerequisites: Node.js 20+, Python 3.11+ and an internet connection for live data providers.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API documentation: <http://localhost:8000/docs>

### 2. Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. After dependencies are installed once, Windows users can run `./run-dev.ps1` from the project root.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service readiness |
| GET | `/api/dashboard` | KPI and recent journey summary |
| POST | `/api/journeys/plan` | Geocode, route, crawl and plan |
| GET | `/api/journeys` | Saved journey list |
| GET | `/api/journeys/{id}` | Full saved result |
| POST | `/api/crawl/stations` | Live station crawl near a place |
| GET | `/api/stations` | Cached normalized station records |
| GET | `/api/stations/export.csv` | Pandas-generated normalized CSV |
| GET | `/api/crawls` | Crawl audit history |
| POST | `/api/crawler/inspect` | Inspect one public HTML page |
| POST | `/api/crawler/multipage` | Throttled extraction for up to five pages |
| POST | `/api/crawler/dynamic` | Permitted Selenium explicit-wait demonstration |
| GET | `/api/analytics` | Operator, connector, source and completeness aggregates |
| GET | `/api/sources` | Provider and policy metadata |

## Live data and responsible scraping

- **OpenStreetMap Overpass:** charger metadata is community-maintained and may be incomplete. Verify source records before travel.
- **Nominatim:** public instances have usage policies and rate limits. For production, use a hosted provider or your own instance and set a descriptive contact-bearing `USER_AGENT`.
- **OSRM:** the public demo service is suitable for learning and low-volume demos, not production load.
- **Open Charge Map/openrouteservice:** optional API keys enable the second charging dataset and authenticated route POST; without them, documented fallbacks remain operational.
- **Open-Meteo:** weather is contextual and never presented as an EV energy prediction.
- **Web inspector:** only HTTP(S) is accepted; DNS is resolved server-side; private, loopback, link-local, multicast and reserved targets are rejected; `robots.txt` is checked; HTML is capped at 3 MB.

The planner never silently swaps in fabricated data when a provider fails. The API returns a clear error so the UI can report the real system state.

## Tests and production build

```powershell
cd backend
python -m pytest -q

cd ..\frontend
npm run build
```

Course-facing documentation is maintained in [API_SOURCES.md](API_SOURCES.md), [SCRAPING_SOURCES.md](SCRAPING_SOURCES.md), [DATA_DICTIONARY.md](DATA_DICTIONARY.md), and [TEST_CASES.md](TEST_CASES.md).

## Limitations

- Charger availability, pricing and live occupancy are not present in standard OSM records.
- Cost is an explicit estimate using a simple ₹15.5/kWh classroom assumption; it is not provider pricing.
- Stop selection uses reported vehicle range and does not yet model elevation, traffic, temperature or wind.
- Public endpoints may throttle or be temporarily unavailable. Production deployments should use contracted/self-hosted data services and caching.

## Attribution

Map and charging data © OpenStreetMap contributors. Routing via the OSRM project. Geocoding via Nominatim. OpenStreetMap source links and attribution remain visible throughout the application.

# API Sources

| Source | Role | Authentication | Request style | Fallback |
|---|---|---|---|---|
| BEE EV Yatra | Nationwide station locations and connectors; snapshot dated 26 October 2025 | None for published PDF | Cleaned, bundled PDF export | Live OSM/OCM and SQLite cache |
| Photon | India-only place suggestions as the user types | None | Debounced GET with `countrycode=IN`; four-second timeout | Bundled BEE station city names |
| Nominatim | Place geocoding | None; descriptive User-Agent required | GET with `q`, `format`, `limit` | Clear error; cached identical queries |
| OSRM | Road route and alternatives | None | GET coordinate path + query parameters | Clear route error |
| OpenStreetMap Overpass | Optional charger enrichment with a seven-second total budget | None | Small parallel POST queries with Overpass QL | Nationwide BEE snapshot; optional SQLite cache |
| Open Charge Map | Optional second structured charger source | `OPEN_CHARGE_MAP_API_KEY` | GET bounding box | OSM-only operation |
| Official manufacturer pages | EV battery/range/connector specifications | None | Curated backend reference records | Only verified variants are offered |

All requests have finite timeouts. Nominatim is used only for submitted place searches, never autocomplete, and calls are serialized to approximately one request per second. GET responses are cached in memory for the configured TTL. API keys belong in `.env`, which is ignored by Git.

The app never invents station records after a provider failure. It uses the official snapshot, another named provider or the timestamped SQLite cache; if none is available, the road route still renders with a clear station-data message.

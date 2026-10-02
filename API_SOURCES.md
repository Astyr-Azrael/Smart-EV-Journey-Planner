# API Sources

| Source | Role | Authentication | Request style | Fallback |
|---|---|---|---|---|
| Nominatim | Place geocoding | None; descriptive User-Agent required | GET with `q`, `format`, `limit` | Clear error; cached identical queries |
| OSRM | Road route and alternatives | None | GET coordinate path + query parameters | Clear route error |
| OpenStreetMap Overpass | Core charger discovery | None | Small parallel POST queries with Overpass QL | Another public instance, then the SQLite cache |
| Open Charge Map | Optional second structured charger source | `OPEN_CHARGE_MAP_API_KEY` | GET bounding box | OSM-only operation |
| Official manufacturer pages | EV battery/range/connector specifications | None | Curated backend reference records | Only verified variants are offered |

All requests have finite timeouts. Nominatim calls are serialized to approximately one request per second and GET responses are cached in memory for the configured TTL. API keys belong in `.env`, which is ignored by Git.

The app never invents station records after a provider failure. It uses another named provider or the timestamped SQLite cache; if none is available, the road route still renders with a clear station-data message.

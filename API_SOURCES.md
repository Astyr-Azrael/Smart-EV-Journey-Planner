# API Sources

| Source | Role | Authentication | Request style | Fallback |
|---|---|---|---|---|
| Nominatim | Place geocoding | None; descriptive User-Agent required | GET with `q`, `format`, `limit` | Clear error; cached identical queries |
| openrouteservice | Primary routing when configured | `ORS_API_KEY` header | POST JSON coordinates | Public OSRM route service |
| OSRM | Default/fallback road route | None | GET coordinate path + query parameters | Clear error |
| OpenStreetMap Overpass | Core charger discovery | None | GET with Overpass QL | Open Charge Map when configured/cached data remains browsable |
| Open Charge Map | Optional second structured charger source | `OPEN_CHARGE_MAP_API_KEY` | GET bounding box | OSM-only operation |
| Open-Meteo | Route-midpoint weather | None | GET coordinates + weather fields | Journey proceeds without weather |

All requests have finite timeouts. Nominatim calls are serialized to approximately one request per second and GET responses are cached in memory for the configured TTL. API keys belong in `.env`, which is ignored by Git.

The app never invents station or weather records after a provider failure. It either uses another named provider or reports the missing capability.

# Test Cases

## Automated tests

Run `backend/.venv/Scripts/python -m pytest -q`.

| Area | Covered case |
|---|---|
| Distance | Known Haversine distance is within tolerance |
| OSM parser | Node shape, connector and source URL extraction |
| Static scraper | Title, links, EV terms and JSON-LD parsing |
| Route recommendation | Multiple reachable progressive stops |
| Explainability | Selected stop contains human-readable reasons |
| Pandas cleaning | Two nearby source records merge into High confidence |
| Normalization | Connector aliases and textual kW values |
| Validation | Reserve equal to starting battery is rejected |

## Manual functional matrix

| Scenario | Expected outcome |
|---|---|
| Mumbai → Pune, 300 km range, 40% battery, 15% reserve | Charging requirement is evaluated using 75 km usable range; compatible corridor stations shown |
| Short trip at high charge | No stop required; map and weather still shown |
| Invalid destination | Clear geocoding error; no fabricated route |
| Reserve ≥ current charge | HTTP 422 validation response |
| No compatible connector | No feasible stop explanation |
| Station provider timeout/429 | Other provider used when available, otherwise clear 502 |
| Weather unavailable | Journey succeeds with weather omitted |
| robots.txt disallows crawl | Crawl blocked before content extraction |
| Private-network URL | Request rejected by SSRF protection |
| Selenium selector missing | Explicit-wait error is logged and returned cleanly |

Before submission, repeat tests with one short and one intercity Indian route and record the retrieval date because public web data changes.

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
| Pandas cleaning | Two nearby source records merge without duplicating the station |
| Normalization | Connector aliases and textual kW values |
| Validation | Reserve equal to starting battery is rejected |

## Manual functional matrix

| Scenario | Expected outcome |
|---|---|
| Mumbai → Pune, Tata Nexon.ev 45 | Default route renders and live corridor stations are shown |
| Mumbai → Bengaluru, Mahindra BE 6 | Long route completes with mapped corridor stations rather than timing out |
| Short trip at high charge | No stop required; both route styles and map remain visible |
| Invalid destination | Clear geocoding error; no fabricated route |
| Reserve ≥ current charge | HTTP 422 validation response |
| No compatible connector | No feasible stop explanation |
| Station provider timeout/429 | Another endpoint/cache is used; default road route remains available |
| No useful route alternative | Default route becomes the highlighted fallback with a clear message |
| Saved journey arrow | Opens `/journeys/{id}` and renders the saved result |
| robots.txt disallows crawl | Crawl blocked before content extraction |
| Private-network URL | Request rejected by SSRF protection |
| Selenium selector missing | Explicit-wait error is logged and returned cleanly |

Before submission, repeat tests with one short and one intercity Indian route and record the retrieval date because public web data changes.

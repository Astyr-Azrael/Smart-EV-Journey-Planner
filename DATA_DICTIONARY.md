# Data Dictionary

## `stations`

| Field | Type | Meaning |
|---|---|---|
| `osm_key` | text, unique | Internal cross-source key such as `node/123` or `ocm/456` |
| `name` | text | Source-provided station/location name |
| `operator` | nullable text | Operator or brand |
| `latitude`, `longitude` | float | Validated WGS84 coordinates |
| `address`, `city`, `state`, `country` | nullable text | Normalized location fields |
| `connectors` | JSON list | Normalized connector names |
| `charger_type` | nullable text | AC/DC classification when derivable |
| `power_kw` | nullable float | Maximum reported connection power |
| `access`, `opening_hours`, `status` | nullable text | Source-provided operational metadata |
| `capacity` | nullable integer | Reported number of bays/points |
| `source`, `source_id`, `source_url` | text | Record provenance |
| `provenance` | JSON | Field-to-provider mapping |
| `raw_tags` | JSON | Selected original metadata for audit/debugging |
| `fetched_at` | timestamp | Retrieval/storage time |

## `journeys`

Stores normalized origin/destination labels, distance, duration, vehicle label and the complete JSON result containing default/charging-friendly route geometry, considered stations and charging stops.

## `ev_specs`

Stores manufacturer, model, variant, battery, certified range, AC/DC connector, maximum charging power, official source URL and update date used by the frontend dropdown.

## `crawl_runs`

Stores source, completion status, record count, structured details/errors and timestamp for station, static, multi-page and Selenium crawls.

## Cleaning rules

- invalid/missing coordinates are rejected;
- connector aliases such as `CCS Combo 2` are normalized to `CCS2`;
- text power such as `60 kW` becomes numeric `60.0`;
- exact source IDs are deduplicated;
- records within 100 m with compatible name/operator signals are merged;
- absent values remain null/unknown and are never fabricated.

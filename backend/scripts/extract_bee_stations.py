"""Convert BEE's published Excel-to-PDF export to an app-ready national JSON file.

Usage: python scripts/extract_bee_stations.py /path/to/EV_PCS_Data_29277.pdf
Requires pdfplumber for this one-off extraction; the app does not require it.
"""

import json
import sys
from collections import Counter
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.bee_parser import normalize_bee_row  # noqa: E402

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "bee_stations.json"


def extract(source: Path, destination: Path = DATA_PATH) -> dict:
    stations: dict[tuple, dict] = {}
    stats = Counter()
    with pdfplumber.open(source) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if not tables:
                stats["pages_without_table"] += 1
                continue
            for table in tables:
                for row in table:
                    stats["rows"] += 1
                    station = normalize_bee_row(row, page_number)
                    if station is None:
                        stats["rejected"] += 1
                        continue
                    key = (round(station["latitude"], 5), round(station["longitude"], 5), (station["operator"] or "").casefold())
                    existing = stations.get(key)
                    if existing:
                        stats["combined_rows"] += 1
                        existing["connectors"] = sorted(set(existing["connectors"] + station["connectors"]))
                        existing["power_kw"] = max(existing["power_kw"] or 0, station["power_kw"] or 0) or None
                        existing["capacity"] = max(existing["capacity"] or 1, station["capacity"] or 1)
                    else:
                        station_id = len(stations) + 1
                        station["osm_key"] = f"bee/{station_id}"
                        station["source_id"] = str(station_id)
                        stations[key] = station
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(list(stations.values()), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    stats["unique_stations"] = len(stations)
    return dict(stats)


if __name__ == "__main__":
    print(extract(Path(sys.argv[1])))

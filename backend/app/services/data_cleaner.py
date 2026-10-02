import logging
import re
from pathlib import Path

import pandas as pd

from .geo import haversine_km

logger = logging.getLogger(__name__)

CONNECTOR_ALIASES = {
    "ccs": "CCS2",
    "ccs combo 2": "CCS2",
    "combo ccs": "CCS2",
    "type 2 ccs": "CCS2",
    "iec 62196-2": "Type 2",
    "type 2 ac": "Type 2",
    "chademo": "CHAdeMO",
    "gb/t": "GB/T",
    "gbt": "GB/T",
}


def normalize_connector(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value.strip()).lower()
    return CONNECTOR_ALIASES.get(cleaned, value.strip())


def normalize_power(value) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"(\d+(?:\.\d+)?)", str(value).replace(",", "."))
    return float(match.group(1)) if match else None


def clean_and_merge(records: list[dict]) -> list[dict]:
    if not records:
        return []
    frame = pd.DataFrame(records)
    frame["latitude"] = pd.to_numeric(frame["latitude"], errors="coerce")
    frame["longitude"] = pd.to_numeric(frame["longitude"], errors="coerce")
    frame = frame.dropna(subset=["latitude", "longitude"])
    frame = frame[frame["latitude"].between(-90, 90) & frame["longitude"].between(-180, 180)]
    frame["name"] = frame["name"].fillna("EV charging station").astype(str).str.strip()
    frame["operator"] = frame["operator"].where(frame["operator"].notna(), None)
    frame["power_kw"] = frame["power_kw"].map(normalize_power)
    frame["connectors"] = frame["connectors"].map(lambda values: sorted(set(normalize_connector(str(value)) for value in (values or []))))
    frame = frame.drop_duplicates(subset=["source", "source_id"], keep="last")
    rows = frame.to_dict(orient="records")
    merged: list[dict] = []
    for row in rows:
        row = {key: _none_if_na(value) for key, value in row.items()}
        match = next((candidate for candidate in merged if _is_duplicate(candidate, row)), None)
        if not match:
            merged.append(row)
            continue
        sources = sorted(set(str(match.get("source", "")).split(" + ") + str(row.get("source", "")).split(" + ")))
        for key, value in row.items():
            if match.get(key) in (None, "", [], {}):
                match[key] = value
        match["connectors"] = sorted(set((match.get("connectors") or []) + (row.get("connectors") or [])))
        match["source"] = " + ".join(filter(None, sources))
        match["confidence"] = "High"
        match["provenance"] = {**(match.get("provenance") or {}), **(row.get("provenance") or {})}
    logger.info("Cleaned %s source records into %s unique stations", len(records), len(merged))
    return merged


def _none_if_na(value):
    if isinstance(value, (list, dict, tuple)):
        return value
    return None if pd.isna(value) else value


def _is_duplicate(a: dict, b: dict) -> bool:
    distance = haversine_km((a["latitude"], a["longitude"]), (b["latitude"], b["longitude"]))
    if distance >= 0.1:
        return False
    operator_a = re.sub(r"[^a-z0-9]", "", str(a.get("operator") or a.get("name") or "").lower())
    operator_b = re.sub(r"[^a-z0-9]", "", str(b.get("operator") or b.get("name") or "").lower())
    return not operator_a or not operator_b or operator_a in operator_b or operator_b in operator_a


def export_csv(records: list[dict], destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    columns = ["name", "operator", "latitude", "longitude", "connectors", "power_kw", "charger_type", "source", "source_url", "confidence"]
    frame = pd.DataFrame(records)
    for column in columns:
        if column not in frame:
            frame[column] = None
    frame[columns].to_csv(destination, index=False)
    return destination

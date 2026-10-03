"""Parse rows from BEE EV Yatra's national PDF export."""

import re

SOURCE_URL = "https://beeindia.gov.in/WriteReadData/RTF1984/EV_PCS_Data_29277.pdf"


def normalize_state(value: str) -> str:
    label = re.sub(r"\s+", " ", value or "").strip().title()
    return {
        "Uttrakhand": "Uttarakhand",
        "Andaman & Nicobar": "Andaman and Nicobar Islands",
        "Jammu & Kashmir": "Jammu and Kashmir",
        "Ut Of D&Nh And D&D": "Dadra and Nagar Haveli and Daman and Diu",
    }.get(label, label)


def _number(value: str) -> float | None:
    match = re.search(r"\d+(?:\.\d+)?", str(value or "").replace(",", "."))
    return float(match.group()) if match else None


def _connectors(value: str) -> list[str]:
    label = re.sub(r"\s+", " ", str(value or "")).strip().lower()
    connectors: list[str] = []
    if "ccs" in label:
        if re.search(r"ccs\s*[- ]?\s*(ii|2)\b", label):
            connectors.append("CCS2")
        elif re.search(r"ccs\s*[- ]?\s*(i|1)\b", label):
            connectors.append("CCS1")
        else:
            connectors.append("CCS (unspecified)")
    if "chademo" in label:
        connectors.append("CHAdeMO")
    if "gb/t" in label or "gbt" in label:
        connectors.append("GB/T")
    if "bharat" in label:
        connectors.append("Bharat DC-001" if "dc" in label else "Bharat AC-001")
    if "lev" in label or "light electric" in label:
        connectors.append("LEV")
    if "type" in label and ("ii" in label or "2" in label):
        connectors.append("Type 2")
    elif "type" in label and ("i" in label or "1" in label):
        connectors.append("Type 1")
    return connectors


def normalize_bee_row(row: list[str], page: int) -> dict | None:
    if len(row) != 12 or (row[2] or "").strip().lower() in ("state", ""):
        return None
    lat, lon = _number(row[6]), _number(row[7])
    if lat is None or lon is None or not (6 <= lat <= 38 and 68 <= lon <= 98):
        return None
    operator = re.sub(r"\s+", " ", row[0] or "").strip() or None
    address = re.sub(r"\s+", " ", row[5] or "").strip()
    connectors = _connectors(row[8])
    power = _number(row[10]) or _number(row[9])
    raw_type = re.sub(r"\s+", " ", row[8] or "").strip()
    return {
        "osm_key": "", "name": address[:180] or operator or "EV charging station",
        "latitude": lat, "longitude": lon, "operator": operator,
        "address": address or None, "access": None, "opening_hours": None,
        "capacity": int(_number(row[11]) or 1), "connectors": connectors,
        "charger_type": "DC" if "dc" in raw_type.lower() or any(connector in connectors for connector in ("CCS2", "CCS1", "CHAdeMO", "Bharat DC-001")) else "AC",
        "power_kw": power, "status": None, "city": (row[4] or "").strip() or None,
        "state": normalize_state(row[2]), "country": "India",
        "source": "BEE EV Yatra", "source_id": "", "source_url": f"{SOURCE_URL}#page={page}",
        "provenance": {"coordinates": "BEE EV Yatra", "connectors": "BEE EV Yatra", "operator": "BEE EV Yatra"},
        "raw_tags": {"bee_charger_type": raw_type, "bee_report_page": page},
    }

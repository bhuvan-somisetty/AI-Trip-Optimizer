"""Official Indian Railways fares for a train between two stations, from published government data.

Indian Railways fares aren't dynamic for ordinary Mail/Express trains: they come from the fare table
the Railway Board publishes. Two free official sources give the real fare:

- data/rail_fares.json: the basic fare tables of Mail/Express services from Railway Board
  Commercial Circular No. 24 of 2025 (in force from 26 Dec 2025), by distance slab and class, read
  from the circular's scanned tables and checked against them row by row, plus the circular's
  other charges (minimum distance, reservation fee, superfast charge) and 5% GST on AC classes and
  First Class.
- data/rail_distances.json: each train's stations and their distance from its source station, from
  the Ministry of Railways timetable published on data.gov.in (Train_details, Dec 2017, NDSAP).

Google Maps transit gives a train's number and its stations' codes (app/ground.py), so the
distance is looked up for that very train, and the fare per class is the table's basic fare for
the chargeable distance plus the reservation fee, the superfast charge on superfast trains (the
12/20/22 series and trains named SF), GST where it applies, rounded up to a multiple of 5 rupees
as fares are.

Nothing is guessed: trains with their own tariff, catering or dynamic pricing (Rajdhani, Shatabdi,
Duronto, Vande Bharat, Humsafar, Garib Rath, Jan Shatabdi, specials...) and trains or stations
missing from the timetable get no fare, and the reason says so.
"""
import json
import math
import re
from pathlib import Path

DATA = Path(__file__).parent / "data"
FARES = json.loads((DATA / "rail_fares.json").read_text(encoding="utf-8"))
DISTANCES: dict[str, list[list]] = json.loads((DATA / "rail_distances.json").read_text(encoding="utf-8"))

SOURCE = "Indian Railways fare table (Railway Board CC 24/2025) and timetable distances (data.gov.in)"
# The classes shown, cheapest first. 2A and 1A use the peak-season table, which the circular says
# applies to popular trains in all seasons; other trains charge the lean-season fare off-peak.
CLASSES = ("2S", "SL", "CC", "3E", "3A", "FC", "2A", "1A")
CLASS_NAMES = {"2S": "Second sitting", "SL": "Sleeper", "CC": "AC Chair Car", "3E": "AC 3 Economy",
               "3A": "AC 3-Tier", "FC": "First Class", "2A": "AC 2-Tier", "1A": "AC First Class"}
OWN_TARIFF = re.compile(
    r"rajdhani|shatabdi|duronto|vande\s*bharat|tejas|gatimaan|humsafar|garib\s*rath|antyodaya|amrit\s*bharat|"
    r"mahamana|yuva|uday|namo\s*bharat|suvidha|special|vistadome|anubhuti|janshatabdi", re.I)
SUPERFAST_SERIES = ("12", "20", "22")


def train_number(service: str | None) -> str | None:
    """"12414 Galta Dham Pooja SF Express" -> "12414"."""
    found = re.match(r"\s*(\d{5})\b", service or "")
    return found.group(1) if found else None


def distance_km(number: str, frm: str, to: str) -> int | None:
    """Kilometres between two of a train's stations, in its direction of travel."""
    stops = DISTANCES.get(number)
    if not stops:
        return None
    at = {}
    for code, km in stops:
        at.setdefault(code, km)
    if frm not in at or to not in at or at[to] <= at[frm]:
        return None
    return at[to] - at[frm]


def _row(table: list[list], km: int) -> list:
    for row in table:
        if row[0] <= km <= row[1]:
            return row
    return table[-1]


def basic_fare(cls: str, km: int) -> int:
    """The circular's basic fare for a class over a chargeable distance (beyond 5,000 km, the
    5,000 km fare plus a fixed amount per 50 km slab)."""
    extra = math.ceil((km - 5000) / 50) * FARES["beyond_5000_per_50_km"][cls] if km > 5000 else 0
    km = min(km, 5000)
    if cls in FARES["non_ac_columns"]:
        return _row(FARES["non_ac"], km)[2 + FARES["non_ac_columns"].index(cls)] + extra
    column = {"2A": "2A_peak", "1A": "1A_peak"}.get(cls, cls)
    return _row(FARES["ac"], km)[2 + FARES["ac_columns"].index(column)] + extra


def class_fare(cls: str, km: int, superfast: bool) -> int:
    charges = FARES["charges"][cls]
    total = basic_fare(cls, max(km, charges["min_km"])) + charges["reservation"]
    if superfast:
        total += charges["superfast"]
    if cls in FARES["gst_classes"]:
        total *= 1 + FARES["gst_rate"]
    return int(math.ceil(total / 5) * 5)


def official_fares(service: str | None, frm: str | None, to: str | None) -> dict:
    """{"fares": {class: rupees}, "distance_km", "superfast", "label", "source"} for an ordinary
    Mail/Express train, or {"fares": None, "reason"} when there is no official fare to give."""
    number = train_number(service)
    if number is None:
        return {"fares": None, "reason": "No train number to look up"}
    if number.startswith("0") or OWN_TARIFF.search(service or ""):
        return {"fares": None, "reason": "This train has its own tariff (catering or dynamic fare): check it on IRCTC"}
    km = distance_km(number, (frm or "").upper(), (to or "").upper())
    if km is None:
        return {"fares": None, "reason": "This train or station isn't in the official timetable data: check the fare on IRCTC"}
    superfast = number[:2] in SUPERFAST_SERIES or bool(re.search(r"\bSF\b|superfast", service or "", re.I))
    return {
        "fares": {cls: class_fare(cls, km, superfast) for cls in CLASSES},
        "distance_km": km,
        "superfast": superfast,
        "label": f"Official fare for {km} km{' (superfast)' if superfast else ''}",
        "source": SOURCE,
    }

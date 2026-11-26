"""Cheaper journeys through another city: a time-aware, multi-criteria Dijkstra over real departures.

Sometimes going through another city is cheaper than going direct, e.g. Bhubaneswar -> Hyderabad
-> Bengaluru during a festival. This module checks that with real fares instead of assuming it:

1. A few via-cities are picked from the airport list: bigger airports that are only a small
   detour from the straight line (total distance at most MAX_DETOUR times the direct one). The
   six busiest Indian airports may be a bigger detour and come first: they have the most flights
   and often the lowest fares (Bengaluru -> Delhi -> Jaipur can beat Bengaluru -> Jaipur at Diwali).
2. Every leg (origin -> via, via -> destination, origin -> destination) is searched for real:
   flights on Google Flights, trains / buses / ferries on Google Maps transit (both via SerpApi).
3. Each departure becomes an edge of a time-dependent graph: cities are nodes, an edge leaves at
   its departure time and arrives at its arrival time. A connection is only allowed when the next
   departure leaves after the previous arrival plus a minimum transfer time (two hours between
   two flights on separate tickets, and so on), so the timetable is respected.
4. A multi-criteria Dijkstra (Martins' label-setting algorithm) finds every journey that is not
   beaten on all of fare, arrival time, departure time and number of changes at once. Labels are
   taken from the queue in order of arrival time; arrival never decreases along a journey, so a
   label that is not dominated when it is taken out stays on the efficient set.

From those journeys the cheapest direct, cheapest connecting, fastest and best-value ones are named,
each with the reason in plain words. A fare is only added up from real fares: a leg without one (most
trains and buses) makes the whole journey's fare unknown, so such a journey can be the fastest but is
never called the cheapest. Each leg search costs one SerpApi search; results are cached like the
other searches.
"""
import heapq
import itertools
import logging
import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, datetime

from app.ground import DEPART_HOURS, search_ground
from app.routing import haversine_m
from app.travel_data import AIRPORTS, PLACES, TravelDataError, search_flights

logger = logging.getLogger(__name__)

MODES = ("flight", "train", "bus", "ferry")
DEFAULT_VIAS = 2
MAX_VIAS = 4
MAX_CHOSEN_VIAS = 3  # cities a traveller names themselves (3 changes is the most allowed)
MAX_DETOUR = 1.35  # a via-city may add at most 35% to the straight-line distance
MAX_MEGA_HUB_DETOUR = 1.6  # ... or 60% when it is one of MEGA_HUBS
MIN_LEG_KM = 150  # each leg of a via journey must be a real intercity hop
GROUND_MAX_KM = 2500  # no train or bus is searched over a longer straight-line distance
MAX_WAIT_MINUTES = 18 * 60  # longest wait in a via-city that is still offered
MAX_TRANSFERS = 3  # changes in total, counting a flight's own stops
MAX_OPTIONS = 25
MAX_TRAVELLERS = 9
DEFAULT_VALUE_OF_TIME = 300  # rupees an hour of travel is worth, for "best value"
# Major connecting hubs (busiest airports in India and the big international transfer points).
# OurAirports marks 43 Indian airports "large", so size alone can't tell a hub from a small city;
# this short hand-made list nudges the via-cities toward airports with many flights to compare.
HUBS = {
    "DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "AMD", "COK", "PNQ", "GOI", "GOX", "LKO", "GAU",
    "DXB", "DOH", "AUH", "SIN", "KUL", "BKK", "HKG", "IST", "LHR", "CDG", "FRA", "AMS", "MUC",
    "JFK", "ORD", "ATL", "LAX", "NRT", "HND", "ICN", "PEK", "PVG", "SYD", "CMB", "KTM",
}
HUB_BONUS = 0.15  # a hub may be this much more of a detour and still come first
# The busiest Indian airports: the most flights to every city, so the cheapest connections.
MEGA_HUBS = {"DEL", "BOM", "BLR", "HYD", "MAA", "CCU"}
MEGA_HUB_BONUS = 0.35
# Leg searches for a via journey: the first leg from early morning, a middle leg (between two
# via-cities) from mid-morning, the last leg from midday.
FIRST_LEG_HOURS = (5,)
MIDDLE_LEG_HOURS = (9,)
SECOND_LEG_HOURS = (12,)


def transfer_minutes(arriving: str, leaving: str) -> int:
    """Minimum time to change between two separately booked legs in the same city."""
    if arriving == "flight" and leaving == "flight":
        return 120  # collect bags, check in again
    if "flight" in (arriving, leaving):
        return 150  # get between the airport and the station, and through security
    return 45


@dataclass(frozen=True)
class Edge:
    """One real departure: a flight, train, bus or ferry from one city to another."""

    frm: str
    to: str
    mode: str
    departure: datetime
    arrival: datetime
    fare: float | None
    currency: str | None
    stops: int
    leg: dict


@dataclass(frozen=True)
class Label:
    """A partial journey that has reached `city`."""

    city: str
    arrival: datetime | None  # None at the origin, before any departure
    departure: datetime | None
    fare: float | None  # None when any leg has no published fare
    currency: str | None
    transfers: int
    edges: tuple[Edge, ...]

    def criteria(self) -> tuple:
        fare = self.fare if self.fare is not None else math.inf
        departs = -self.departure.timestamp() if self.departure else 0
        arrives = self.arrival.timestamp() if self.arrival else 0
        return (fare, arrives, departs, self.transfers)


def dominates(a: Label, b: Label) -> bool:
    """a is at least as good as b on every criterion and better on one."""
    ca, cb = a.criteria(), b.criteria()
    return all(x <= y for x, y in zip(ca, cb)) and ca != cb


def pareto_search(edges: list[Edge], origin: str, destination: str) -> list[Label]:
    """Martins' multi-criteria label-setting Dijkstra over time-dependent edges.

    Returns every journey reaching `destination` (nothing is pruned there, so the cheapest direct
    option survives next to a cheaper connecting one). In other cities, labels beaten on fare,
    arrival, departure and changes all at once are dropped."""
    out: dict[str, list[Edge]] = {}
    for e in edges:
        out.setdefault(e.frm, []).append(e)
    tie = itertools.count()
    start = Label(origin, None, None, 0.0, None, 0, ())
    queue = [(datetime.min, 0.0, 0, next(tie), start)]
    settled: dict[str, list[Label]] = {}
    arrived: list[Label] = []
    while queue:
        *_, label = heapq.heappop(queue)
        if label.city == destination:
            arrived.append(label)
            continue
        if any(dominates(other, label) or other.criteria() == label.criteria() for other in settled.get(label.city, [])):
            continue
        settled.setdefault(label.city, []).append(label)
        visited = {e.frm for e in label.edges} | {label.city}
        for e in out.get(label.city, []):
            if e.to in visited:
                continue  # never back through a city already passed
            transfers = label.transfers + e.stops + (1 if label.edges else 0)
            if transfers > MAX_TRANSFERS:
                continue
            if label.edges:
                wait = (e.departure - label.arrival).total_seconds() / 60
                if wait < transfer_minutes(label.edges[-1].mode, e.mode) or wait > MAX_WAIT_MINUTES:
                    continue  # the connection can't be made, or means a very long wait
            fare, currency = None, None
            if label.fare is not None and e.fare is not None and label.currency in (None, e.currency):
                fare, currency = label.fare + e.fare, e.currency
            nxt = Label(e.to, e.arrival, label.departure or e.departure, fare, currency, transfers, label.edges + (e,))
            heapq.heappush(queue, (e.arrival, fare if fare is not None else math.inf, transfers, next(tie), nxt))
    return arrived


def final_criteria(label: Label) -> tuple:
    """What a traveller compares between finished journeys: fare, total time, changes."""
    fare = label.fare if label.fare is not None else math.inf
    return (fare, (label.arrival - label.departure).total_seconds(), label.transfers)


def efficient(labels: list[Label]) -> list[Label]:
    """Journeys no other journey beats on fare, total time and changes all at once."""
    keys = [final_criteria(a) for a in labels]
    return [
        a for a, ka in zip(labels, keys)
        if not any(all(x <= y for x, y in zip(kb, ka)) and kb != ka for kb in keys)
    ]


def via_cities(origin: str, destination: str, limit: int) -> list[str]:
    """Bigger airports a small detour away from the straight line, best first.

    Ranked by detour (total distance over the direct one), with hubs counted as shorter:
    Bhubaneswar -> Bengaluru tries Chennai and Hyderabad before smaller cities, Bengaluru ->
    Jaipur tries Hyderabad, Mumbai and Delhi."""
    if limit <= 0:
        return []
    a, b = PLACES[origin], PLACES[destination]
    straight = haversine_m(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
    found = []
    for code, v in AIRPORTS.items():
        if code in (origin, destination) or v["size"] < 2 or v["city"] in (a["city"], b["city"]):
            continue
        first = haversine_m(a["latitude"], a["longitude"], v["latitude"], v["longitude"])
        second = haversine_m(v["latitude"], v["longitude"], b["latitude"], b["longitude"])
        limit_detour = MAX_MEGA_HUB_DETOUR if code in MEGA_HUBS else MAX_DETOUR
        if min(first, second) < MIN_LEG_KM * 1000 or (first + second) > limit_detour * straight:
            continue
        if second >= straight:
            continue  # it must bring the traveller nearer: Chennai is no stop on Bengaluru -> Jaipur
        bonus = MEGA_HUB_BONUS if code in MEGA_HUBS else HUB_BONUS if code in HUBS else 0
        found.append(((first + second) / straight - bonus, code))
    picked, cities = [], set()
    for _, code in sorted(found):
        if AIRPORTS[code]["city"] not in cities:
            cities.add(AIRPORTS[code]["city"])
            picked.append(code)
        if len(picked) == limit:
            break
    return picked


def _place(code: str) -> dict:
    return {"code": code, "name": PLACES[code]["city"]}


def has_airport(code: str) -> bool:
    """An airport, or an Indian town with an airport of its own (a few km away at most)."""
    place = PLACES.get(code)
    return code in AIRPORTS or bool(place and "flight" in place["serves"])


def access_vias(origin: str, destination: str) -> list[str]:
    """The nearest airport of an end that has none of its own (Mydukuru: Kadapa, CDP), so a flight
    there and a bus or train for the last stretch is searched like any other connection."""
    out = []
    for code in (origin, destination):
        place = PLACES.get(code)
        airport = place and place.get("airport_code")
        if place and not has_airport(code) and airport and airport not in (origin, destination) and airport not in out:
            out.append(airport)
    return out


def flight_edge(f: dict, frm: str, to: str) -> Edge | None:
    try:
        departure = datetime.fromisoformat(f["departure_time"])
        arrival = datetime.fromisoformat(f["arrival_time"])
    except (KeyError, TypeError, ValueError):
        return None  # without both times the connection can't be checked
    leg = {
        "mode": "flight",
        "service": " ".join(x for x in (f.get("airline"), f.get("flight_number")) if x),
        "operator": f.get("airline"),
        "from": _place(frm),
        "to": _place(to),
        "departure_time": f["departure_time"],
        "arrival_time": f["arrival_time"],
        "duration_minutes": f.get("duration_minutes"),
        "stops": f.get("stops") or 0,
        "layovers": f.get("layovers") or [],
        "fare": f.get("price"),
        "currency": f.get("currency") or "INR",
        "fare_label": "Live fare" if f.get("price_status") == "live" else "Cached fare",
        "link": f.get("link"),
        "link_label": "View on Google Flights" if f.get("link") else None,
        "source": f.get("source"),
        "data_label": "Live" if f.get("price_status") == "live" else "Cached",
    }
    return Edge(frm, to, "flight", departure, arrival, f.get("price"), leg["currency"], leg["stops"], leg)


def ground_edge(g: dict, frm: str, to: str) -> Edge | None:
    try:
        departure = datetime.fromisoformat(g["departure_time"])
        arrival = datetime.fromisoformat(g["arrival_time"])
    except (KeyError, TypeError, ValueError):
        return None
    leg = {
        "mode": g["kind"],
        "service": g.get("service"),
        "operator": g.get("operator"),
        "from": {**_place(frm), "station": g["from"].get("name"), "station_code": g["from"].get("code")},
        "to": {**_place(to), "station": g["to"].get("name"), "station_code": g["to"].get("code")},
        "departure_time": g["departure_time"],
        "arrival_time": g["arrival_time"],
        "duration_minutes": g.get("duration_minutes"),
        "stops": g.get("changes") or 0,
        "layovers": [],
        "fare": g.get("fare"),
        "currency": g.get("currency"),
        "fare_label": g.get("fare_label"),
        # Indian trains: the official fare per class (app/rail_fares.py), or why there is none.
        "class_fares": g.get("class_fares"),
        "class_fares_label": g.get("class_fares_label"),
        "class_fares_note": g.get("class_fares_note"),
        "link": g.get("link"),
        "link_label": g.get("link_label"),
        "source": g.get("source"),
        "data_label": g.get("data_label"),
    }
    return Edge(frm, to, g["kind"], departure, arrival, g.get("fare"), g.get("currency"), leg["stops"], leg)


def _distance_km(a: str, b: str) -> float:
    x, y = PLACES[a], PLACES[b]
    return haversine_m(x["latitude"], x["longitude"], y["latitude"], y["longitude"]) / 1000


def search_leg(frm: str, to: str, day: date, modes: set[str], hours: tuple[int, ...]) -> tuple[list[Edge], list[dict]]:
    """All departures for one leg, and what was searched (one SerpApi search per source and hour)."""
    edges, searched = [], []
    if "flight" in modes and has_airport(frm) and has_airport(to):  # a town with no airport is reached by road
        try:
            flights = search_flights(frm, to, day)
            edges += [e for e in (flight_edge(f, frm, to) for f in flights) if e]
            searched.append({"from": frm, "to": to, "mode": "flight", "found": len(flights), "error": None})
        except TravelDataError as e:
            searched.append({"from": frm, "to": to, "mode": "flight", "found": 0, "error": str(e)})
    if modes & {"train", "bus", "ferry"} and _distance_km(frm, to) <= GROUND_MAX_KM:
        try:
            ground = [g for g in search_ground(frm, to, day, hours) if g["kind"] in modes]
            edges += [e for e in (ground_edge(g, frm, to) for g in ground) if e]
            searched.append({"from": frm, "to": to, "mode": "train/bus", "found": len(ground), "error": None})
        except TravelDataError as e:
            searched.append({"from": frm, "to": to, "mode": "train/bus", "found": 0, "error": str(e)})
    return edges, searched


def _hm(minutes: float) -> str:
    minutes = round(minutes)
    return f"{minutes // 60}h {minutes % 60:02d}m"


def _money(amount: float, currency: str | None) -> str:
    return f"{'₹' if currency in (None, 'INR') else currency + ' '}{amount:,.0f}"


def journey(label: Label, number: int, travellers: int = 1) -> dict:
    """One journey as the API returns it. Fares are found per person and multiplied by the
    number of travellers (leg fares stay per person)."""
    legs = [e.leg for e in label.edges]
    minutes = (label.arrival - label.departure).total_seconds() / 60
    waits = [
        {"city": _place(a.to), "minutes": round((b.departure - a.arrival).total_seconds() / 60)}
        for a, b in zip(label.edges, label.edges[1:])
    ]
    direct = len(legs) == 1 and label.transfers == 0
    return {
        "id": f"J-{number}",
        "kind": "direct" if direct else "connecting",
        "separate_tickets": len(legs) > 1,
        "via": [_place(e.to) for e in label.edges[:-1]],
        "modes": [e.mode for e in label.edges],
        "departure_time": label.departure.isoformat(),
        "arrival_time": label.arrival.isoformat(),
        "duration_minutes": round(minutes),
        "transfers": label.transfers,
        "transfer_waits": waits,
        "travellers": travellers,
        "fare_per_person": label.fare,
        "fare": label.fare * travellers if label.fare is not None else None,
        "currency": label.currency if label.fare is not None else None,
        "fare_label": ("Sum of real fares" if travellers == 1 else f"Sum of real fares for {travellers} travellers")
        if label.fare is not None else "Not available: a leg has no published fare",
        "legs": legs,
    }


def _describe(j: dict) -> str:
    if j["kind"] == "direct":
        return j["legs"][0]["service"] or j["legs"][0]["mode"]
    if j["via"]:
        return " -> ".join([j["legs"][0]["from"]["name"]] + [v["name"] for v in j["via"]] + [j["legs"][-1]["to"]["name"]])
    return f"{j['legs'][0]['service']} ({j['transfers']} stop{'s' if j['transfers'] > 1 else ''})"


def recommend(journeys: list[dict], value_of_time: float) -> dict:
    """The four picks, each with the reason in plain words (None when nothing qualifies)."""
    priced = [j for j in journeys if j["fare"] is not None]
    direct = [j for j in priced if j["kind"] == "direct"]
    connecting = [j for j in priced if j["kind"] == "connecting"]
    by_fare = lambda j: (j["fare"], j["duration_minutes"])
    picks: dict[str, dict | None] = {}

    best_direct = min(direct, key=by_fare, default=None)
    picks["cheapest_direct"] = best_direct and {
        "journey": best_direct["id"],
        "reason": f"Lowest fare without changing: {_money(best_direct['fare'], best_direct['currency'])} "
                  f"({_describe(best_direct)}), {_hm(best_direct['duration_minutes'])}.",
    }

    best_conn = min(connecting, key=by_fare, default=None)
    if best_conn:
        reason = f"Lowest fare with a change: {_money(best_conn['fare'], best_conn['currency'])} ({_describe(best_conn)}), {_hm(best_conn['duration_minutes'])}."
        if best_direct and best_direct["currency"] == best_conn["currency"]:
            saving = best_direct["fare"] - best_conn["fare"]
            extra = best_conn["duration_minutes"] - best_direct["duration_minutes"]
            if saving > 0:
                reason += f" {_money(saving, best_conn['currency'])} cheaper than the cheapest direct option"
                reason += f", {_hm(extra)} longer." if extra > 0 else ", and not slower."
            else:
                reason += f" It does not save money on this day: {_money(-saving, best_conn['currency'])} more than going direct."
        if best_conn["separate_tickets"]:
            waits = ", ".join(f"{_hm(w['minutes'])} in {w['city']['name']}" for w in best_conn["transfer_waits"])
            reason += f" Separate tickets, with {waits} to change."
        picks["cheapest_connecting"] = {"journey": best_conn["id"], "reason": reason}
    else:
        picks["cheapest_connecting"] = None

    fastest = min(journeys, key=lambda j: (j["duration_minutes"], j["fare"] if j["fare"] is not None else math.inf), default=None)
    if fastest:
        fare = _money(fastest["fare"], fastest["currency"]) if fastest["fare"] is not None else "fare not available"
        picks["fastest"] = {
            "journey": fastest["id"],
            "reason": f"Shortest time from departure to arrival among the departures found: {_hm(fastest['duration_minutes'])} ({_describe(fastest)}, {fare}).",
        }
    else:
        picks["fastest"] = None

    score = lambda j: j["fare"] + value_of_time * j["duration_minutes"] / 60
    best = min((j for j in priced if j["currency"] in (None, "INR")), key=score, default=None)
    picks["best_value"] = best and {
        "journey": best["id"],
        "reason": f"Best balance of fare and time, counting each hour of travel as {_money(value_of_time, 'INR')}: "
                  f"{_money(best['fare'], best['currency'])} for {_hm(best['duration_minutes'])} ({_describe(best)}).",
    }
    return picks


def chosen_via_cities(codes: list[str] | None, origin: str, destination: str) -> list[str] | None:
    """Via-cities the traveller named, in their order (e.g. Goa then Bhubaneswar), or None.
    Unknown codes, repeats and the trip's own two cities are refused rather than skipped."""
    chosen = [c.strip().upper() for c in codes or [] if c and c.strip()]
    if not chosen:
        return None
    if len(chosen) > MAX_CHOSEN_VIAS:
        raise TravelDataError(f"Name at most {MAX_CHOSEN_VIAS} cities to go through")
    unknown = [c for c in chosen if c not in AIRPORTS]
    if unknown:
        raise TravelDataError(f"Unknown airport code: {', '.join(unknown)}")
    if len(set(chosen)) < len(chosen) or {origin, destination} & set(chosen):
        raise TravelDataError("Name each city to go through once, and not the origin or destination")
    return chosen


def find_journeys(origin: str, destination: str, day: date, modes: set[str] | None = None,
                  vias: int = DEFAULT_VIAS, value_of_time: float = DEFAULT_VALUE_OF_TIME,
                  travellers: int = 1, via_depth: int = 1, return_date: date | None = None,
                  via: list[str] | None = None) -> dict:
    """Direct and connecting journeys from `origin` to `destination` (airport codes) leaving on `day`,
    and with `return_date` the same for the way back under "return".

    `travellers` multiplies every fare (searched per person, so it costs no extra searches).
    `via_depth=2` also tries going through two via-cities in a row (origin -> A -> B -> destination);
    that adds one leg search per pair of via-cities. `via` names the via-cities instead of picking
    them (Bengaluru -> Goa -> Bhubaneswar -> Jaipur): each one alone and every pair in the given
    order are tried, and the way back goes through them in reverse."""
    if return_date is not None and return_date < day:
        raise TravelDataError("The return date is before the departure date")
    chosen = chosen_via_cities(via, origin.upper(), destination.upper())
    out = one_way(origin, destination, day, modes, vias, value_of_time, travellers, via_depth, chosen)
    out["return"] = (one_way(destination, origin, return_date, modes, vias, value_of_time, travellers, via_depth,
                             chosen[::-1] if chosen else None)
                     if return_date else None)
    return out


def one_way(origin: str, destination: str, day: date, modes: set[str] | None, vias: int,
            value_of_time: float, travellers: int, via_depth: int, chosen: list[str] | None = None) -> dict:
    modes = set(modes or MODES)
    travellers = max(1, min(travellers, MAX_TRAVELLERS))
    if origin not in PLACES or destination not in PLACES:
        raise TravelDataError("Journeys can only be searched between known cities and towns")
    if PLACES[origin]["city"] == PLACES[destination]["city"]:
        raise TravelDataError("The origin and destination are the same city")
    via = chosen or via_cities(origin, destination, max(0, min(vias, MAX_VIAS)))
    # A town without an airport: its nearest airport is always tried, for fly-then-bus journeys.
    via = [*access_vias(origin, destination), *[v for v in via if v not in access_vias(origin, destination)]]
    plan = [(origin, destination, DEPART_HOURS)]
    for v in via:
        plan += [(origin, v, FIRST_LEG_HOURS), (v, destination, SECOND_LEG_HOURS)]
    if chosen:
        # The traveller's own order: every pair a -> b with a named before b.
        plan += [(a, b, MIDDLE_LEG_HOURS) for i, a in enumerate(chosen) for b in chosen[i + 1:]]
    elif via_depth >= 2:
        # Two via-cities in a row, nearer one first: origin -> a -> b -> destination.
        for a in via:
            for b in via:
                if a != b and _distance_km(origin, a) < _distance_km(origin, b):
                    plan.append((a, b, MIDDLE_LEG_HOURS))
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda leg: search_leg(leg[0], leg[1], day, modes, leg[2]), plan))
    edges = [e for found, _ in results for e in found]
    searched = [s for _, done in results for s in done]

    # Journeys that leave on the chosen day (a search from the evening can return the next morning's).
    arrived = [a for a in pareto_search(edges, origin, destination) if a.departure.date() == day]
    kept = efficient(arrived)

    def keep(candidates: list[Label], key) -> Label | None:
        best = min(candidates, key=key, default=None)
        if best is not None and best not in kept:
            kept.append(best)
        return best

    by_fare = lambda a: (a.fare, a.arrival - a.departure)
    by_time = lambda a: (a.arrival - a.departure, a.fare if a.fare is not None else math.inf)
    # Always shown, even when beaten: the cheapest direct option, the cheapest way through each
    # via-city (so the comparison with going direct is visible), and the fastest of each mode.
    keep([a for a in arrived if len(a.edges) == 1 and a.transfers == 0 and a.fare is not None], by_fare)
    through = {v: keep([a for a in arrived if a.fare is not None and v in {e.to for e in a.edges[:-1]}], by_fare) for v in via}
    # The whole chain the traveller named (Bengaluru -> Goa -> Bhubaneswar -> Jaipur), searched on its
    # own legs only: on the full graph a label through just one of the cities can prune it on the way.
    chain = None
    if chosen and len(chosen) > 1:
        hops = set(zip([origin, *chosen], [*chosen, destination]))
        full = [a for a in pareto_search([e for e in edges if (e.frm, e.to) in hops], origin, destination)
                if a.departure.date() == day and len(a.edges) == len(hops) and a.fare is not None]
        chain = keep(full, by_fare)
    for mode in sorted(modes):
        keep([a for a in arrived if {e.mode for e in a.edges} == {mode}], by_time)
    kept.sort(key=lambda a: (a.fare if a.fare is not None else math.inf, a.arrival - a.departure))
    kept = kept[:MAX_OPTIONS]
    journeys = [journey(a, i, travellers) for i, a in enumerate(kept, start=1)]
    ids = {id(a): j["id"] for a, j in zip(kept, journeys)}

    cheapest_direct = min((j for j in journeys if j["kind"] == "direct" and j["fare"] is not None),
                          key=lambda j: j["fare"], default=None)
    via_summary = []
    if chosen and len(chosen) > 1:
        names = " then ".join(PLACES[c]["city"] for c in chosen)
        row = {"city": {"code": "-".join(chosen), "name": names}, "journey": ids.get(id(chain)) if chain else None,
               "fare": chain.fare * travellers if chain else None, "difference_from_direct": None}
        if chain is None:
            row["note"] = f"No priced connection through {names} fits the timetable on this day"
        elif cheapest_direct and cheapest_direct["currency"] == chain.currency:
            diff = chain.fare * travellers - cheapest_direct["fare"]
            row["difference_from_direct"] = diff
            row["note"] = (f"{_money(-diff, chain.currency)} cheaper than the cheapest direct option" if diff < 0
                           else f"{_money(diff, chain.currency)} more than the cheapest direct option")
        else:
            row["note"] = f"Through {names}: {_money(chain.fare * travellers, chain.currency)}"
        via_summary.append(row)
    for v in via:
        best = through[v]
        row = {"city": _place(v), "journey": ids.get(id(best)) if best else None,
               "fare": best.fare * travellers if best else None, "difference_from_direct": None}
        if best is None:
            row["note"] = f"No priced connection through {PLACES[v]['city']} fits the timetable on this day"
        elif cheapest_direct and cheapest_direct["currency"] == best.currency:
            diff = best.fare * travellers - cheapest_direct["fare"]
            row["difference_from_direct"] = diff
            row["note"] = (f"{_money(-diff, best.currency)} cheaper than the cheapest direct option" if diff < 0
                           else f"{_money(diff, best.currency)} more than the cheapest direct option")
        else:
            row["note"] = f"Cheapest through {PLACES[v]['city']}: {_money(best.fare * travellers, best.currency)}"
        via_summary.append(row)

    notice = None
    if not journeys:
        failed = [s["error"] for s in searched if s["error"]]
        notice = failed[0] if failed and len(failed) == len(searched) else "No flights, trains or buses were found for this route and day"
    return {
        "origin": _place(origin),
        "destination": _place(destination),
        "date": day.isoformat(),
        "travellers": travellers,
        "via_depth": 2 if via_depth >= 2 or (chosen and len(chosen) > 1) else 1,
        "via_chosen": bool(chosen),
        "modes": sorted(modes),
        "via_cities": [_place(v) for v in via],
        "via_summary": via_summary,
        "journeys": journeys,
        "recommendations": recommend(journeys, value_of_time),
        "value_of_time": value_of_time,
        "searched": searched,
        "method": "Time-dependent multi-criteria Dijkstra (Martins' label-setting) over real departures: "
                  "fare, arrival time, departure time and number of changes.",
        "notice": notice,
    }

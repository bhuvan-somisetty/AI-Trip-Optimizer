"""The LangGraph optimization pipeline: search -> check -> compose.

Described in docs/08_GenAI_Architecture.md. search_node and check_node are plain
Python; compose_node is the only step that calls the LLM.

A trip has up to three line items: the outbound flight ("flight"), the return flight
("return") and the hotel ("stay"). Each is picked the same way, as the cheapest option
that passes every rule, and all the money maths is done here in code. A trip by train or bus
(the trip form's Trains or Buses) has a train or bus in place of each flight (ground_check).
"""
import json
import logging
import re
import statistics
from datetime import date, datetime, timedelta

from langgraph.graph import END, START, StateGraph

from app import config, ground
from app import travel_data
from app.pipeline.state import PipelineState

logger = logging.getLogger(__name__)


def flexible_days(preferences: dict) -> int:
    # "Flexible dates": also search this many days either side (0, 1 or 2). Off by default
    # because each extra day is one more live search per leg.
    try:
        return max(0, min(2, int(preference(preferences, "flexible_days", "flexibleDays") or 0)))
    except (TypeError, ValueError):
        return 0


def nearby_flights(origin: str, destination: str, day, cabin: str | None, days: int, seen: set) -> list[dict]:
    """Flights up to `days` either side of `day`, for the ledger's "Different day" rows.

    A nearby day that fails or finds nothing is skipped: the trip's own day already worked.
    """
    extra = []
    for offset in [d for k in range(1, days + 1) for d in (-k, k)]:
        try:
            for flight in travel_data.search_flights(origin, destination, day + timedelta(days=offset), cabin):
                if flight["id"] not in seen:
                    seen.add(flight["id"])
                    extra.append(flight)
        except travel_data.TravelDataError:
            continue
    return extra


def search_node(state: PipelineState) -> dict:
    # Pure lookup, no LLM: every option the later nodes see came from a real provider.
    request = state["request"]
    by_ground = ground_modes(request["preferences"])
    if by_ground:
        return search_ground_trip(request, by_ground)
    cabin = request["preferences"].get("cabin_class")
    flex = flexible_days(request["preferences"])
    found: dict = {"flight_options": [], "hotel_options": []}
    try:
        found["flight_options"] = travel_data.search_flights(
            request["origin"],
            request["destination"],
            request["start_date"],
            cabin,
        )
    except travel_data.TravelDataError as e:
        found["search_error"] = str(e)
        return found
    if flex:
        seen = {f["id"] for f in found["flight_options"]}
        found["flight_options"] += nearby_flights(
            request["origin"], request["destination"], request["start_date"], cabin, flex, seen
        )
    # The return leg is searched like the outbound one. If it can't be found the trip is still
    # built, with a flag saying the total has no return flight in it.
    try:
        found["return_options"] = travel_data.search_flights(
            request["destination"],
            request["origin"],
            request["end_date"],
            cabin,
        )
        if flex:
            seen = {f["id"] for f in found["return_options"]}
            found["return_options"] += nearby_flights(
                request["destination"], request["origin"], request["end_date"], cabin, flex, seen
            )
    except travel_data.TravelDataError as e:
        found["return_options"] = []
        found["return_unavailable"] = f"Return flight search failed: {e}"
    search_hotels_into(found, request)
    return found


# ---- trips by train or bus ---------------------------------------------------------------------
# A trip whose traveller picked Trains or Buses (not Flights) in the trip form books no flight: the
# outbound and return line items are the train or bus picked from Google Maps transit
# (app/ground.py). Most trains and buses publish no fare, so the total holds only the fares that
# are known and a flag says which fare to check with the operator. Nothing is estimated.
GROUND_MODES = ("train", "bus")
MODE_WORDS = {"train": ("train", "trains"), "bus": ("bus", "buses")}


def ground_modes(preferences: dict) -> list[str] | None:
    """The trip's chosen ground modes when it excludes flights, else None (a flight trip)."""
    filters = preferences.get("filters")
    modes = filters.get("modes") if isinstance(filters, dict) else None
    if not isinstance(modes, list) or not modes or "flight" in modes:
        return None
    return [m for m in GROUND_MODES if m in modes] or None


def modes_text(modes: list[str]) -> str:
    return " or ".join(MODE_WORDS[m][1] for m in modes)


def search_hotels_into(found: dict, request: dict) -> None:
    if request["end_date"] > request["start_date"]:
        try:
            found["hotel_options"] = travel_data.search_hotels(
                request["destination"], request["start_date"], request["end_date"]
            )
        except travel_data.HotelsUnavailable as e:
            found["hotels_unavailable"] = str(e)
        except travel_data.TravelDataError as e:
            found["search_error"] = str(e)


def search_ground_trip(request: dict, modes: list[str]) -> dict:
    """search_node for a train or bus trip: the day's departures both ways, and hotels."""
    found: dict = {"flight_options": [], "hotel_options": [], "ground_mode": modes,
                   "ground_options": [], "ground_return_options": []}
    try:
        found["ground_options"] = [
            g for g in ground.search_ground(request["origin"], request["destination"], request["start_date"])
            if g.get("kind") in modes
        ]
    except travel_data.TravelDataError as e:
        found["search_error"] = str(e)
        return found
    try:
        found["ground_return_options"] = [
            g for g in ground.search_ground(request["destination"], request["origin"], request["end_date"])
            if g.get("kind") in modes
        ]
    except travel_data.TravelDataError as e:
        found["return_unavailable"] = f"The search for the way back failed: {e}"
    search_hotels_into(found, request)
    return found


def transport_option(g: dict, frm: str, to: str, number: int) -> dict:
    """A train or bus from search_ground as an itinerary line item (stored where a flight would be)."""
    fare = g.get("fare") if g.get("currency") in (None, "INR") else None
    return {
        "id": f"{g['kind'].upper()}-{number}",
        "mode": g["kind"],
        "service": g.get("service"),
        "operator": g.get("operator"),
        "airline": g.get("operator") or g.get("service") or MODE_WORDS[g["kind"]][0].title(),
        "flight_number": g.get("service"),
        "origin": frm,
        "destination": to,
        "from_station": (g.get("from") or {}).get("name"),
        "to_station": (g.get("to") or {}).get("name"),
        "departure_time": g.get("departure_time"),
        "arrival_time": g.get("arrival_time"),
        "duration_minutes": g.get("duration_minutes"),
        "stops": g.get("changes") or 0,
        "cabin_class": None,
        "price": fare,
        "currency": "INR" if fare is not None else None,
        "fare_label": g.get("fare_label") if fare is not None else "Fare not published",
        "fare_class": g.get("fare_class"),
        "class_fares": g.get("class_fares"),
        "class_fares_label": g.get("class_fares_label"),
        "class_fares_note": g.get("class_fares_note"),
        "link": g.get("link"),
        "link_label": g.get("link_label"),
        "source": g.get("source"),
        "data_label": g.get("data_label"),
    }


def ground_candidates(raw: list[dict], frm: str, to: str, day) -> list[dict]:
    options = [transport_option(g, frm, to, i) for i, g in enumerate(raw, start=1)]
    return [o for o in options if (o["departure_time"] or "")[:10] == day.isoformat()]


def pick_ground(options: list[dict]) -> dict | None:
    """The cheapest train or bus with a published fare, else the fastest of the day."""
    priced = [o for o in options if o["price"] is not None]
    if priced:
        return min(priced, key=lambda o: (o["price"], o["duration_minutes"] or 10**6))
    return min(options, key=lambda o: o["duration_minutes"] or 10**6, default=None)


def ground_word(option: dict) -> str:
    return MODE_WORDS.get(option.get("mode"), ("transport",))[0]


def transport_label(option: dict) -> str:
    label = f"{option['id']} {option.get('service') or option.get('airline')}"
    if option.get("departure_time"):
        label += f", departs {option['departure_time'][:16].replace('T', ' ')}"
    return label


def ground_check(state: PipelineState) -> dict:
    """check_node for a train or bus trip: the train or bus each way and the hotel, with the
    budget checked on the known fares and the typical range for the rest."""
    request = state["request"]
    preferences = with_policy_preferences(request)
    policy = request.get("policy")
    nights = (request["end_date"] - request["start_date"]).days
    modes = state["ground_mode"]
    route = f"{request['origin']} to {request['destination']} on {request['start_date'].isoformat()}"
    back = f"{request['destination']} to {request['origin']} on {request['end_date'].isoformat()}"
    flags: list[str] = []
    typical: dict = {}

    outbound = pick_ground(ground_candidates(state.get("ground_options", []), request["origin"],
                                             request["destination"], request["start_date"]))
    if state.get("search_error"):
        flags.append(state["search_error"])
    elif outbound is None:
        flags.append(f"No {modes_text(modes)} found from {route}")
    way_back = pick_ground(ground_candidates(state.get("ground_return_options", []), request["destination"],
                                             request["origin"], request["end_date"]))
    if state.get("return_unavailable"):
        flags.append(f"{state['return_unavailable']}, so the total has no way back in it")
    elif way_back is None and not state.get("search_error"):
        flags.append(f"No {modes_text(modes)} found from {back}, so the total has no way back in it")

    rejected_stay: list = []
    hotels: list = []
    if nights > 0 and not state.get("hotels_unavailable"):
        hotels = screen("stay", state["hotel_options"], hotel_rule_broken, preferences, rejected_stay)
        if policy:
            hotels = screen("stay", hotels, policy_hotel_rule(policy, international(request)), preferences, rejected_stay)
    known_fares = sum(o["price"] for o in (outbound, way_back) if o and o["price"] is not None)
    stay_price = lambda h: h["price_per_night"] * nights
    floor = cheapest(hotels, stay_price, preferences)
    headroom = request["budget"] - known_fares - (stay_price(floor) if floor else 0)
    hotel, too_dear = None, []
    if nights > 0 and state.get("hotels_unavailable"):
        flags.append(state["hotels_unavailable"])
    elif nights > 0:
        hotel, too_dear = choose("stay", hotels, stay_price, preferences, headroom)
        if hotels:
            typical["stay"] = statistics.median(h["price_per_night"] for h in hotels) * nights
        if not state["hotel_options"] and not state.get("search_error"):
            flags.append(f"No hotels found in {request['destination']}")
        elif state["hotel_options"] and hotel is None:
            flags.append(f"No hotel in {request['destination']} meets the trip's preferences")

    total_cost = float(known_fares + (stay_price(hotel) if hotel else 0))
    within_budget = total_cost <= request["budget"]
    if not within_budget:
        flags.append(f"Total {total_cost:,.0f} is {total_cost - request['budget']:,.0f} over the {request['budget']:,.0f} budget")
    unknown = [o for o in (outbound, way_back) if o and o["price"] is None]
    if unknown:
        flags.append(f"The {ground_word(unknown[0])} fare isn't published, so it isn't in the total; "
                     f"check it on the operator's site before booking")

    return {
        "check": {
            "flight": outbound,
            "return_flight": way_back,
            "hotel": hotel,
            "nights": nights,
            "total_cost": total_cost,
            "within_budget": within_budget,
            "flags": flags,
            "rejected": rejected_stay,
            "typical": typical,
            "savings": savings(typical, chosen_prices(None, None, hotel, nights)),
            "too_dear": {"stay": too_dear},
            "ground_mode": modes,
        }
    }


def ground_ledger(kind: str, raw: list[dict], frm: str, to: str, day, chosen: dict | None) -> list[dict]:
    """One row per train or bus of the day: the pick, or why it lost."""
    entries = []
    options = ground_candidates(raw, frm, to, day)
    for option in sorted(options, key=lambda o: (o["price"] is None, o["price"] or 0, o["duration_minutes"] or 10**6)):
        won = bool(chosen) and option["id"] == chosen["id"]
        if won:
            reason = ("Cheapest published fare of the day" if option["price"] is not None
                      else "Fastest of the day; no fare is published, so it isn't in the total")
        elif chosen and option["price"] is not None and chosen["price"] is not None:
            difference = option["price"] - chosen["price"]
            reason = f"Price: {abs(difference):,.0f} {'less' if difference < 0 else 'more'} than {chosen['id']}"
        elif chosen and option["duration_minutes"] and chosen["duration_minutes"]:
            reason = f"Slower: {hours(option['duration_minutes'])} vs {hours(chosen['duration_minutes'])} for {chosen['id']}"
        else:
            reason = "Not picked"
        entries.append({"kind": kind, "alternative": transport_label(option),
                        "price": float(option["price"]) if option["price"] is not None else None,
                        "won": won, "reason": reason})
    return entries


def preference(preferences: dict, key: str, client_key: str):
    """A trip preference by its API name, falling back to the web app's `filters` object.

    The web app saves its whole filter form under preferences["filters"] (camelCase) and copies
    only some keys to the top level, so both places are read; the top-level key wins.
    """
    if key in preferences:
        return preferences[key]
    filters = preferences.get("filters")
    return filters.get(client_key) if isinstance(filters, dict) else None


# Departure windows as the web app labels them, in local airport time: [start, end) hours.
DEPARTURE_WINDOWS = {
    "early_morning": (4, 8),
    "morning": (8, 12),
    "afternoon": (12, 17),
    "evening": (17, 21),
    "night": (21, 4),  # wraps past midnight
}
# A red-eye leaves between 22:30 and 05:00 local time (the web app's wording).
RED_EYE_FROM, RED_EYE_UNTIL = 22 * 60 + 30, 5 * 60


def minutes_after_midnight(flight: dict) -> int | None:
    departs = parse_time(flight.get("departure_time"))
    return departs.hour * 60 + departs.minute if departs else None


def in_window(minutes: int, window: tuple[int, int]) -> bool:
    start, end = window[0] * 60, window[1] * 60
    return start <= minutes < end if start < end else minutes >= start or minutes < end


def same_airline(flight: dict, names: list) -> bool:
    airline = str(flight.get("airline") or "").casefold()
    code = str(flight.get("airline_code") or "").casefold()
    return any(str(n).casefold() in (airline, code) for n in names or [])


def flight_rule_broken(flight: dict, preferences: dict) -> tuple[str, str] | None:
    cabin = preferences.get("cabin_class")
    if cabin and flight["cabin_class"] != cabin:
        return "cabin_class", f"{flight['id']} is {flight['cabin_class']}, trip asks for {cabin}"
    max_stops = preferences.get("max_stops")
    if max_stops is not None and flight["stops"] > max_stops:
        return "max_stops", f"{flight['id']} has {flight['stops']} stop(s), trip allows {max_stops}"
    excluded = preference(preferences, "excluded_airlines", "excludedAirlines")
    if excluded and same_airline(flight, excluded):
        return "excluded_airlines", f"{flight['id']} is {flight['airline']}, which the trip excludes"
    minutes = minutes_after_midnight(flight)
    if preference(preferences, "avoid_red_eye", "avoidRedEye") and minutes is not None and (
        minutes >= RED_EYE_FROM or minutes < RED_EYE_UNTIL
    ):
        return "avoid_red_eye", f"{flight['id']} departs at {flight['departure_time'][11:16]}, a red-eye"
    return None


def outbound_rule_broken(flight: dict, preferences: dict) -> tuple[str, str] | None:
    # The departure window is about when the trip starts, so it applies to the outbound leg only.
    broken = flight_rule_broken(flight, preferences)
    if broken:
        return broken
    window = preference(preferences, "departure_window", "departureWindow")
    minutes = minutes_after_midnight(flight)
    if window in DEPARTURE_WINDOWS and minutes is not None and not in_window(minutes, DEPARTURE_WINDOWS[window]):
        start, end = DEPARTURE_WINDOWS[window]
        return (
            "departure_window",
            f"{flight['id']} departs at {flight['departure_time'][11:16]}, "
            f"trip wants {window.replace('_', ' ')} ({start:02d}:00-{end:02d}:00)",
        )
    return None


def cheapest(options: list[dict], price_of, preferences: dict) -> dict | None:
    # Cheapest first; at the same price a preferred airline wins (a tie-break, not a rule).
    preferred = preference(preferences, "preferred_airlines", "preferredAirlines") or []
    return min(options, key=lambda o: (price_of(o), not same_airline(o, preferred)), default=None)


# ---- trip priority ---------------------------------------------------------
# The web app's "What should the optimizer prioritize?". "cheapest" is the default, and the
# only behaviour before priorities existed. The others rank the options that pass every rule
# by something besides price, but only spend money the budget has room for (see `choose`).
PRIORITIES = ("cheapest", "balanced", "comfort", "fastest")


def trip_priority(preferences: dict) -> str:
    value = preference(preferences, "priority", "priority")
    return value if value in PRIORITIES else "cheapest"


def flight_minutes(flight: dict) -> float | None:
    if flight.get("duration_minutes"):
        return float(flight["duration_minutes"])
    leaves, lands = parse_time(flight.get("departure_time")), parse_time(flight.get("arrival_time"))
    try:
        return (lands - leaves).total_seconds() / 60 if leaves and lands else None
    except TypeError:
        return None


def spread(values: list[float]) -> tuple[float, float]:
    low, high = min(values), max(values)
    return low, (high - low) or 1.0


def scorer(priority: str, kind: str, options: list[dict], price_of):
    """A sort key for `options` under `priority`: lower is better. None means "by price"."""
    if priority == "cheapest" or not options:
        return None
    is_flight = kind in ("flight", "return")
    if priority == "fastest":
        if not is_flight:
            return None  # no distance or travel-time data for hotels, so they stay by price
        worst = max((m for m in map(flight_minutes, options) if m is not None), default=0) + 1
        return lambda o: (flight_minutes(o) if flight_minutes(o) is not None else worst,)
    if priority == "comfort":
        if is_flight:
            return lambda o: (o["stops"],)
        return lambda o: (-(o.get("rating") or 0),)
    # balanced: half price, half travel time (flights) or guest rating (hotels), each scaled 0-1.
    price_low, price_range = spread([float(price_of(o)) for o in options])
    if is_flight:
        minutes = [m for m in map(flight_minutes, options) if m is not None]
        if not minutes:
            return None
        low, width = spread(minutes)
        other = lambda o: ((flight_minutes(o) if flight_minutes(o) is not None else low + width) - low) / width
    else:
        ratings = [o.get("rating") or 0 for o in options]
        low, width = spread(ratings)
        other = lambda o: 1 - ((o.get("rating") or 0) - low) / width
    return lambda o: (round(0.5 * (float(price_of(o)) - price_low) / price_range + 0.5 * other(o), 6),)


def choose(kind: str, options: list[dict], price_of, preferences: dict, headroom: float) -> tuple[dict | None, list[str]]:
    """The option to book under the trip's priority, and the ids that ranked higher but cost too much.

    `headroom` is how much more than the cheapest option this line item may cost without the
    trip going over budget. The cheapest option always fits, so a priority never pushes a trip
    over budget that the cheapest picks would have kept within it.
    """
    floor = cheapest(options, price_of, preferences)
    rank = scorer(trip_priority(preferences), kind, options, price_of)
    if floor is None or rank is None:
        return floor, []
    preferred = preference(preferences, "preferred_airlines", "preferredAirlines") or []
    key = lambda o: (*rank(o), price_of(o), not same_airline(o, preferred))
    room = max(headroom, 0.0)
    affordable = [o for o in options if price_of(o) - price_of(floor) <= room]
    chosen = min(affordable, key=key)
    too_dear = [o["id"] for o in options if o not in affordable and key(o) < key(chosen)]
    return chosen, too_dear


WHY_BY_PRIORITY = {
    ("balanced", "flight"): "best balance of price and travel time that meets every trip preference and fits the budget",
    ("balanced", "stay"): "best balance of price and guest rating that meets every trip preference and fits the budget",
    ("comfort", "flight"): "fewest stops that meets every trip preference and fits the budget",
    ("comfort", "stay"): "best-rated hotel that meets every trip preference and fits the budget",
    ("fastest", "flight"): "shortest flight that meets every trip preference and fits the budget",
}


def why_chosen(preferences: dict, kind: str) -> str:
    group = "stay" if kind == "stay" else "flight"
    return WHY_BY_PRIORITY.get((trip_priority(preferences), group), WHY_CHOSEN)


def parse_time(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


def leaves_before_landing(return_flight: dict, outbound: dict | None) -> bool:
    # Only matters for a same-day trip: the return can't leave before the outbound lands.
    if outbound is None:
        return False
    leaves, lands = parse_time(return_flight.get("departure_time")), parse_time(outbound.get("arrival_time"))
    try:
        return bool(leaves and lands and leaves < lands)
    except TypeError:  # one time has a UTC offset and the other doesn't, so they can't be compared
        return False


def days_off(flight: dict, day) -> int:
    # Search also returns fares from nearby days; 0 means the flight leaves on `day`.
    departure = flight.get("departure_time")
    return (date.fromisoformat(departure[:10]) - day).days if departure else 0


def hotel_rule_broken(hotel: dict, preferences: dict) -> tuple[str, str] | None:
    min_rating = preferences.get("min_hotel_rating")
    if min_rating is not None and hotel["rating"] is None:
        return "min_hotel_rating", f"{hotel['id']} has no guest rating, trip needs at least {min_rating}"
    if min_rating is not None and hotel["rating"] < min_rating:
        return "min_hotel_rating", f"{hotel['id']} is rated {hotel['rating']}, trip needs at least {min_rating}"
    cap = preference(preferences, "max_nightly_rate", "maxNightlyRate")
    if cap and hotel["price_per_night"] > cap:
        return "max_nightly_rate", f"{hotel['id']} is {hotel['price_per_night']:,.0f} a night, trip caps it at {cap:,.0f}"
    for amenity in preference(preferences, "required_amenities", "requiredAmenities") or []:
        if not has_amenity(hotel, amenity):
            label = AMENITY_WORDS.get(amenity, (amenity,))[0]
            return "required_amenities", f"{hotel['id']} doesn't list {label}"
    return None


# Required-amenity ids (as the web app sends them) and words that mark them in a hotel's amenity list.
AMENITY_WORDS = {
    "wifi": ("Wi-Fi", "wifi"),
    "breakfast": ("breakfast",),
    "gym": ("gym", "fitness"),
    "pool": ("pool",),
    "airport_shuttle": ("airport shuttle",),
    "meeting_rooms": ("meeting room", "business centre", "business center", "conference"),
    "spa": ("spa",),
    "parking": ("parking",),
}


def has_amenity(hotel: dict, amenity: str) -> bool:
    words = AMENITY_WORDS.get(amenity, (amenity.replace("_", " "),))
    listed = " | ".join(str(a).replace("_", " ") for a in hotel.get("amenities") or [])
    return any(re.search(rf"\b{re.escape(w)}\b", listed, re.IGNORECASE) for w in words)


def screen(kind: str, options: list[dict], rule_broken, preferences: dict, rejected: list) -> list[dict]:
    passing = []
    for option in options:
        broken = rule_broken(option, preferences)
        if broken is None:
            passing.append(option)
        else:
            rejected.append({"kind": kind, "option_id": option["id"], "rule": broken[0], "detail": broken[1]})
    return passing


def on_the_day(kind: str, options: list[dict], day, rejected: list) -> list[dict]:
    # The trip's dates are fixed (hotel nights hang off them), so only a flight on the day can
    # be booked. Fares from nearby days stay in the ledger as date trade-offs.
    ends = "ends" if kind == "return" else "starts"
    kept = []
    for option in options:
        moved = days_off(option, day)
        if moved == 0:
            kept.append(option)
        else:
            side = "before" if moved < 0 else "after"
            rejected.append({
                "kind": kind,
                "option_id": option["id"],
                "rule": "travel_date",
                "detail": f"{option['id']} departs {option['departure_time'][:10]}, "
                          f"{abs(moved)} day(s) {side} the trip {ends}",
            })
    return kept


def price_check(
    request: dict, flight: dict | None, hotel: dict | None, nights: int, return_flight: dict | None = None,
) -> tuple[float, bool, str | None]:
    # Total cost and the budget verdict, with a flag naming each line item when it's over.
    flight_cost = flight["price"] if flight else 0
    return_cost = return_flight["price"] if return_flight else 0
    hotel_cost = hotel["price_per_night"] * nights if hotel else 0
    total_cost = float(flight_cost + return_cost + hotel_cost)
    within_budget = total_cost <= request["budget"]
    if within_budget:
        return total_cost, True, None
    items = []
    if flight:
        items.append(f"flight {flight['id']} {flight_cost:,.0f}")
    if return_flight:
        items.append(f"return flight {return_flight['id']} {return_cost:,.0f}")
    if hotel:
        items.append(f"hotel {hotel['id']} {nights} night(s) {hotel_cost:,.0f}")
    flag = (
        f"Total {total_cost:,.0f} is {total_cost - request['budget']:,.0f} over the "
        f"{request['budget']:,.0f} budget ({' + '.join(items)})"
    )
    return total_cost, False, flag


def savings(typical: dict, chosen: dict) -> float:
    """PRD US-010, as docs/14_Evaluation_Metrics.md defines it: for each line item, the median
    price of the options that met every rule minus the price chosen, summed over the line items.
    The median rather than the priciest option, so one luxury hotel can't inflate the figure."""
    return float(sum(typical[kind] - price for kind, price in chosen.items() if kind in typical))


def chosen_prices(flight: dict | None, return_flight: dict | None, hotel: dict | None, nights: int) -> dict:
    prices = {}
    if flight:
        prices["flight"] = flight["price"]
    if return_flight:
        prices["return"] = return_flight["price"]
    if hotel:
        prices["stay"] = hotel["price_per_night"] * nights
    return prices


# ---- company travel policy (Settings > Travel policy, app/policy.py) ---------------
# The router puts the policy in request["policy"]. A request without one (older saved runs,
# unit tests) is checked against the trip's own preferences only.

def international(request: dict) -> bool:
    return travel_data.CITIES.get(request["destination"], ("", "IN"))[1] != "IN"


def policy_flight_rule(policy: dict):
    def broken(flight: dict, _preferences: dict) -> tuple[str, str] | None:
        minimum = policy.get("business_class_min_hours") or 0
        minutes = flight_minutes(flight)
        if flight.get("cabin_class") == "business" and minutes is not None and minutes < minimum * 60:
            return (
                "policy_business_class",
                f"{flight['id']} is business class on a {hours(minutes)} flight; company policy allows "
                f"business class only on flights of {minimum:g} hours or more",
            )
        return None
    return broken


def policy_hotel_rule(policy: dict, abroad: bool):
    cap = policy.get("max_nightly_rate_intl" if abroad else "max_nightly_rate")

    def broken(hotel: dict, _preferences: dict) -> tuple[str, str] | None:
        if cap and hotel["price_per_night"] > cap:
            where = "international" if abroad else "domestic"
            return (
                "policy_hotel_cap",
                f"{hotel['id']} is {hotel['price_per_night']:,.0f} a night; company policy caps "
                f"{where} hotels at {cap:,.0f}",
            )
        return None
    return broken


def policy_flags(request: dict, flight: dict | None, return_flight: dict | None) -> list[str]:
    """Warnings, not rules: the trip can still be approved, but the reviewer should know."""
    policy = request.get("policy")
    if not policy:
        return []
    flags = []
    limit = policy.get("manager_approval_flight_over")
    for leg, option in (("Flight", flight), ("Return flight", return_flight)):
        if limit and option and option["price"] > limit:
            flags.append(
                f"{leg} {option['id']} costs {option['price']:,.0f}, over the {limit:,.0f} company limit: "
                "needs manager approval"
            )
    ahead = policy.get("advance_booking_days") or 0
    days = (request["start_date"] - date.today()).days
    if ahead and days < ahead:  # 0 days means the policy sets no advance-booking rule
        when = f"starts in {days} day(s)" if days >= 0 else f"started {-days} day(s) ago"
        flags.append(f"Trip {when}; company policy asks for booking at least {ahead} days ahead")
    return flags


def fare_flags(state: PipelineState, request: dict, flight: dict | None, return_flight: dict | None) -> list[str]:
    """Hints about the fare itself, all from real search data: a cheaper fare on a nearby day
    (only when the trip asked for flexible dates) and Google's "prices are high" level."""
    flags = []
    legs = (("Flight", flight, state.get("flight_options") or [], request["start_date"]),
            ("Return flight", return_flight, state.get("return_options") or [], request["end_date"]))
    for name, chosen, options, day in legs:
        if chosen is None:
            continue
        if flexible_days(request["preferences"]):
            cheaper = [o for o in options if days_off(o, day) != 0 and o["price"] < chosen["price"]]
            best = min(cheaper, key=lambda o: o["price"], default=None)
            if best:
                flags.append(
                    f"{name}: {best['id']} on {best['departure_time'][:10]} costs {best['price']:,.0f}, "
                    f"{chosen['price'] - best['price']:,.0f} less than {chosen['id']} on the trip's date"
                )
        if chosen.get("price_level") == "high":
            low_high = chosen.get("typical_price_range")
            typical = f" (typical {low_high[0]:,.0f} to {low_high[1]:,.0f})" if low_high else ""
            flags.append(f"{name}: Google Flights rates fares on this date as high for the route{typical}")
    return flags


def with_policy_preferences(request: dict) -> dict:
    # The policy's preferred vendors join the trip's preferred airlines: both only break price ties.
    preferences = request["preferences"]
    policy = request.get("policy") or {}
    if not policy.get("preferred_airlines"):
        return preferences
    trip_preferred = preference(preferences, "preferred_airlines", "preferredAirlines") or []
    return {**preferences, "preferred_airlines": list(trip_preferred) + list(policy["preferred_airlines"])}


def check_node(state: PipelineState) -> dict:
    # Pure Python, no LLM: picks, per the trip's priority, among the options that pass every
    # rule (the cheapest, by default) and does the money maths here, so the verdict is reproducible.
    if state.get("ground_mode"):
        return ground_check(state)
    request = state["request"]
    preferences = with_policy_preferences(request)
    policy = request.get("policy")
    nights = (request["end_date"] - request["start_date"]).days
    route = f"{request['origin']} to {request['destination']} on {request['start_date'].isoformat()}"
    flags: list[str] = []
    rejected: list = []
    # Median price of the options that passed every rule, per line item, for savings.
    typical: dict = {}

    # Every line item is screened first, so the budget headroom a priority may spend is known
    # before anything is chosen. Rejections are kept per line item, in the order they're found.
    flight_price, stay_price = (lambda f: f["price"]), (lambda h: h["price_per_night"] * nights)
    rejected_flight: list = []
    on_day = on_the_day("flight", state["flight_options"], request["start_date"], rejected_flight)
    flights = screen("flight", on_day, outbound_rule_broken, preferences, rejected_flight)
    if policy:
        flights = screen("flight", flights, policy_flight_rule(policy), preferences, rejected_flight)

    rejected_return: list = []
    return_candidates: list = []
    if "return_options" in state:
        on_day_back = on_the_day("return", state["return_options"], request["end_date"], rejected_return)
        return_candidates = screen("return", on_day_back, flight_rule_broken, preferences, rejected_return)
        if policy:
            return_candidates = screen(
                "return", return_candidates, policy_flight_rule(policy), preferences, rejected_return
            )

    rejected_stay: list = []
    hotels: list = []
    if nights > 0 and not state.get("hotels_unavailable"):
        hotels = screen("stay", state["hotel_options"], hotel_rule_broken, preferences, rejected_stay)
        if policy:
            hotels = screen("stay", hotels, policy_hotel_rule(policy, international(request)), preferences, rejected_stay)

    # How much the trip can spend above its cheapest valid picks and still be within budget.
    floor_total = sum(
        price(option)
        for option, price in (
            (cheapest(flights, flight_price, preferences), flight_price),
            (cheapest(return_candidates, flight_price, preferences), flight_price),
            (cheapest(hotels, stay_price, preferences), stay_price),
        )
        if option
    )
    headroom = request["budget"] - floor_total
    too_dear: dict = {}

    def pick(kind, options, price):
        nonlocal headroom
        chosen, blocked = choose(kind, options, price, preferences, headroom)
        too_dear[kind] = blocked
        floor = cheapest(options, price, preferences)
        if chosen and floor:
            headroom -= price(chosen) - price(floor)
        return chosen

    flight = pick("flight", flights, flight_price)
    if flights:
        typical["flight"] = statistics.median(f["price"] for f in flights)
    if state.get("search_error"):
        flags.append(state["search_error"])
    elif not state["flight_options"]:
        flags.append(f"No flights found from {route}")
    elif not on_day:
        nearest = sorted(state["flight_options"], key=lambda f: f["price"])[:3]
        listed = ", ".join(f"{f['id']} on {f['departure_time'][:10]} for {f['price']:,}" for f in nearest)
        flags.append(f"No flights found from {route}; nearest real fares: {listed}")
    elif flight is None:
        flags.append(f"No flight from {route} meets the trip's preferences")

    # The return leg exists only when search_node looked for one, which every real run does.
    return_flight = None
    if "return_options" in state:
        back = f"{request['destination']} to {request['origin']} on {request['end_date'].isoformat()}"
        no_return = "so the total has no return flight in it"
        returns = []
        for option in return_candidates:
            if leaves_before_landing(option, flight):
                rejected_return.append({
                    "kind": "return",
                    "option_id": option["id"],
                    "rule": "connection",
                    "detail": f"{option['id']} leaves before {flight['id']} lands",
                })
            else:
                returns.append(option)
        return_flight = pick("return", returns, flight_price)
        if returns:
            typical["return"] = statistics.median(f["price"] for f in returns)
        if state.get("search_error"):
            pass  # the outbound search already failed and its flag says why
        elif state.get("return_unavailable"):
            flags.append(f"{state['return_unavailable']}, {no_return}")
        elif not on_day_back:
            flags.append(f"No return fare found from {back}, {no_return}")
        elif return_flight is None:
            flags.append(f"No return flight from {back} meets the trip's preferences, {no_return}")

    hotel = None
    if nights > 0 and state.get("hotels_unavailable"):
        flags.append(state["hotels_unavailable"])
    elif nights > 0:
        hotel = pick("stay", hotels, stay_price)
        if hotels:
            typical["stay"] = statistics.median(h["price_per_night"] for h in hotels) * nights
        if not state["hotel_options"] and not state.get("search_error"):
            flags.append(f"No hotels found in {request['destination']}")
        elif state["hotel_options"] and hotel is None:
            flags.append(f"No hotel in {request['destination']} meets the trip's preferences")
    rejected = rejected_flight + rejected_return + rejected_stay

    total_cost, within_budget, budget_flag = price_check(request, flight, hotel, nights, return_flight)
    if budget_flag:
        flags.append(budget_flag)
    flags += policy_flags(request, flight, return_flight)
    flags += fare_flags(state, request, flight, return_flight)

    return {
        "check": {
            "flight": flight,
            "return_flight": return_flight,
            "hotel": hotel,
            "nights": nights,
            "total_cost": total_cost,
            "within_budget": within_budget,
            "flags": flags,
            "rejected": rejected,
            "typical": typical,
            "savings": savings(typical, chosen_prices(flight, return_flight, hotel, nights)),
            # Options the trip's priority ranked above the pick but the budget had no room for.
            "too_dear": too_dear,
        }
    }


def flight_label(flight: dict) -> str:
    label = f"{flight['id']} {flight['airline']} {flight['cabin_class']}, {flight['stops']} stop(s)"
    if flight.get("departure_time"):
        label += f", departs {flight['departure_time'][:10]}"
    return label


def hotel_label(hotel: dict) -> str:
    rating = "unrated" if hotel["rating"] is None else f"rated {hotel['rating']}"
    return f"{hotel['id']} {hotel['name']}, {rating}"


def hours(minutes: float) -> str:
    return f"{int(minutes // 60)}h {int(minutes % 60):02d}m"


def priority_reason(priority: str, kind: str, option: dict, chosen: dict) -> str | None:
    """Why `option` ranked below `chosen` under a non-default priority, or None to explain by price."""
    if priority == "cheapest":
        return None
    if kind == "stay":
        if priority in ("comfort", "balanced") and (option.get("rating") or 0) < (chosen.get("rating") or 0):
            return f"Lower rated: {option.get('rating') or 'unrated'} vs {chosen['rating']} for {chosen['id']}"
        return None
    if priority == "comfort" and option["stops"] > chosen["stops"]:
        return f"More stops: {option['stops']} vs {chosen['stops']} for {chosen['id']}"
    mine, theirs = flight_minutes(option), flight_minutes(chosen)
    if priority in ("fastest", "balanced") and mine and theirs and mine > theirs:
        return f"Slower: {hours(mine)} vs {hours(theirs)} for {chosen['id']}"
    return None


def ledger_entries(
    kind, options, chosen, price_of, label, rejected_by_id, picked=False,
    priority="cheapest", why=None, too_dear=(),
) -> list[dict]:
    # Every option search_node found gets one row: the winner, or why it lost.
    # `kind` ("flight", "return" or "stay") lets clients group rows without parsing option ids.
    # `picked` means a reviewer chose this line item by hand instead of the optimizer.
    entries = []
    for option in sorted(options, key=price_of):
        price = float(price_of(option))
        if chosen and option["id"] == chosen["id"]:
            reason = PICKED_REASON if picked else (why or WHY_CHOSEN)[0].upper() + (why or WHY_CHOSEN)[1:]
        elif option["id"] in rejected_by_id and rejected_by_id[option["id"]]["rule"] == "travel_date":
            reason = f"Different day: {rejected_by_id[option['id']]['detail']}"
            if chosen:
                difference = price - price_of(chosen)
                reason += f"; {abs(difference):,.0f} {'less' if difference < 0 else 'more'} than {chosen['id']}"
        elif option["id"] in rejected_by_id and rejected_by_id[option["id"]]["rule"] == "connection":
            reason = f"Timing: {rejected_by_id[option['id']]['detail']}"
        elif option["id"] in rejected_by_id:
            rejection = rejected_by_id[option["id"]]
            reason = f"Preference {rejection['rule']}: {rejection['detail']}"
        else:
            difference = price - price_of(chosen)
            if difference == 0:
                price_note = f"same price as {chosen['id']}"
            else:
                price_note = f"{abs(difference):,.0f} {'less' if difference < 0 else 'more'} than {chosen['id']}"
            ranked = None if picked else priority_reason(priority, kind, option, chosen)
            if option["id"] in too_dear and not picked:
                reason = f"Budget: ranks higher but costs {price_note}, more than the budget has room for"
            elif ranked:
                reason = f"{ranked}; {price_note}"
            elif difference == 0:
                reason = f"Price: same as {chosen['id']}, which was picked first"
            else:
                reason = f"Price: {price_note}"
        won = bool(chosen) and option["id"] == chosen["id"]
        entries.append({"kind": kind, "alternative": label(option), "price": price, "won": won, "reason": reason})
    return entries


def rejections(check: dict, kind: str) -> dict:
    # One line item's rejections, by option id. A return flight can share an id with an
    # outbound one, so each rejection says which line item it belongs to.
    return {r["option_id"]: r for r in check["rejected"] if r.get("kind", kind) == kind}


def build_ledger(state: PipelineState) -> list[dict]:
    check = state["check"]
    nights = check["nights"]
    picked = state.get("picked", [])
    preferences = state["request"]["preferences"]
    if state.get("ground_mode"):
        request = state["request"]
        ledger = ground_ledger("flight", state.get("ground_options", []), request["origin"],
                               request["destination"], request["start_date"], check["flight"])
        ledger += ground_ledger("return", state.get("ground_return_options", []), request["destination"],
                                request["origin"], request["end_date"], check.get("return_flight"))
        if nights > 0:
            ledger += ledger_entries(
                "stay", state["hotel_options"], check["hotel"], lambda h: h["price_per_night"] * nights,
                hotel_label, rejections(check, "stay"), picked="stay" in picked,
                priority=trip_priority(preferences), why=why_chosen(preferences, "stay"),
                too_dear=check.get("too_dear", {}).get("stay", []),
            )
        return ledger
    ranking = lambda kind: {
        "priority": trip_priority(preferences),
        "why": why_chosen(preferences, kind),
        "too_dear": check.get("too_dear", {}).get(kind, []),
    }
    ledger = ledger_entries(
        "flight",
        state["flight_options"], check["flight"], lambda f: f["price"], flight_label, rejections(check, "flight"),
        picked="flight" in picked, **ranking("flight"),
    )
    if state.get("return_options"):
        ledger += ledger_entries(
            "return",
            state["return_options"],
            check.get("return_flight"),
            lambda f: f["price"],
            flight_label,
            rejections(check, "return"),
            picked="return" in picked, **ranking("return"),
        )
    if nights > 0:
        ledger += ledger_entries(
            "stay",
            state["hotel_options"],
            check["hotel"],
            lambda h: h["price_per_night"] * nights,
            hotel_label,
            rejections(check, "stay"),
            picked="stay" in picked, **ranking("stay"),
        )
    return ledger


# check_node's selection rule, stated once so the rationale can explain the choice.
WHY_CHOSEN = "cheapest option that meets every trip preference"
# A line item a reviewer swapped in by hand (edit_itinerary).
WHY_PICKED = "picked by the reviewer from the options that meet every trip preference"
PICKED_REASON = "Picked by the reviewer; meets every trip preference"


def rupees(amount) -> int:
    # Whole rupees, as the app shows them: the facts then never carry "15986.0" or 950.3333 for the
    # LLM to copy. The guardrail compares numbers, and 15,986 written by the LLM still matches 15986.
    return round(float(amount))


def ground_fact(option: dict | None, compared: int) -> dict | None:
    if option is None:
        return None
    fact = {
        "travel_by": ground_word(option),
        "option": transport_label(option),
        "price": rupees(option["price"]) if option["price"] is not None else None,
        "why_chosen": "cheapest published fare of the day" if option["price"] is not None
        else "fastest of the day; its fare isn't published",
        "options_compared": compared,
    }
    return fact


def rationale_facts(state: PipelineState) -> dict:
    # The only numbers the rationale may use; all of them were computed in code.
    request = state["request"]
    check = state["check"]
    hotel = check["hotel"]
    return_flight = check.get("return_flight")
    picked = state.get("picked", [])
    by_ground = state.get("ground_mode")
    return {
        "route": f"{request['origin']} to {request['destination']}",
        "dates": f"{request['start_date'].isoformat()} to {request['end_date'].isoformat()}",
        "budget": rupees(request["budget"]),
        "flight": ground_fact(check["flight"], len(state.get("ground_options", []))) if by_ground else {
            "option": flight_label(check["flight"]),
            "price": rupees(check["flight"]["price"]),
            "why_chosen": WHY_PICKED if "flight" in picked else why_chosen(request["preferences"], "flight"),
            "options_compared": len(state["flight_options"]),
        },
        "return_flight": None
        if return_flight is None
        else ground_fact(return_flight, len(state.get("ground_return_options", []))) if by_ground
        else {
            "option": flight_label(return_flight),
            "price": rupees(return_flight["price"]),
            "why_chosen": WHY_PICKED if "return" in picked else why_chosen(request["preferences"], "return"),
            "options_compared": len(state.get("return_options", [])),
        },
        "hotel": None
        if hotel is None
        else {
            "option": hotel_label(hotel),
            "price_per_night": rupees(hotel["price_per_night"]),
            "nights": check["nights"],
            "stay_cost": rupees(hotel["price_per_night"] * check["nights"]),
            "why_chosen": WHY_PICKED if "stay" in picked else why_chosen(request["preferences"], "stay"),
            "options_compared": len(state["hotel_options"]),
        },
        "total_cost": rupees(check["total_cost"]),
        "savings_vs_median_valid_options": rupees(check.get("savings", 0.0)),
        "within_budget": check["within_budget"],
        "difference_from_budget": rupees(abs(request["budget"] - check["total_cost"])),
        "flags": check["flags"],
        "options_ruled_out": [r["detail"] for r in check["rejected"]],
    }


def leg_text(leg: dict, word: str) -> str:
    """ "flight X at 4,827", or for a train or bus without a fare, its typical range."""
    text = f"{leg.get('travel_by') or word} {leg['option']}"
    if leg["price"] is not None:
        return f"{text} at {leg['price']:,.0f}"
    return f"{text} (fare not published)"


def template_rationale(facts: dict) -> str:
    parts = [f"Chose {leg_text(facts['flight'], 'flight')}"]
    if facts.get("return_flight"):
        back = facts["return_flight"]
        word = f"return {back['travel_by']}" if back.get("travel_by") else "return flight"
        parts.append(f"{'with' if facts['hotel'] else 'and'} {leg_text({**back, 'travel_by': None}, word)}")
    if facts["hotel"]:
        hotel = facts["hotel"]
        parts.append(
            f"and hotel {hotel['option']} at {hotel['price_per_night']:,.0f} a night for "
            f"{hotel['nights']} night(s) ({hotel['stay_cost']:,.0f})"
        )
    items = (facts["flight"], facts.get("return_flight"), facts["hotel"])
    by_hand = [item for item in items if item and item["why_chosen"] == WHY_PICKED]
    if by_hand:
        which = "these options" if len(by_hand) > 1 else "one of them"
        text = " ".join(parts) + f". The reviewer picked {which} by hand from the options that meet every trip preference. "
    else:
        reasons = list(dict.fromkeys(item["why_chosen"] for item in items if item))
        if reasons == [WHY_CHOSEN]:
            text = " ".join(parts) + ", the cheapest options that meet every trip preference. "
        else:
            text = " ".join(parts) + f". Picked as the {' and the '.join(reasons)}. "
    text += f"Total cost is {facts['total_cost']:,.0f} against a budget of {facts['budget']:,.0f}, "
    if facts["within_budget"]:
        text += f"leaving {facts['difference_from_budget']:,.0f} unspent."
    else:
        text += f"which is {facts['difference_from_budget']:,.0f} over budget."
    if facts["options_ruled_out"]:
        text += f" {len(facts['options_ruled_out'])} option(s) were ruled out by the trip's dates or preferences."
    return text


RATIONALE_PROMPT = """You explain a business trip itinerary to the manager who will approve it.
Write 3 to 5 short sentences in plain, natural English: which flights and hotel were chosen and why
(use why_chosen and options_compared), the total cost against the budget, and any flags or options
ruled out. When a line item has travel_by (train or bus), it is a train or bus, not a flight; when its
price is null, say its fare isn't published and must be checked with the operator. Write like a helpful colleague, not a report: never mention field names such as
price_per_night or within_budget, never say true or false, and skip anything that is empty.

Use ONLY the facts below. Never introduce, round, convert or calculate a number that is not written
in the facts. Write amounts as whole numbers with thousands separators, e.g. 15,986. Don't mention clock times, flight durations or hours, even when the choice was about
speed: say "the shortest flight" instead. No currency symbols, no markdown.

Facts:
{facts}"""


def numbers_in(text: str) -> set[float]:
    return {float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)}


def get_llm():
    if not config.OPENAI_API_KEY:
        return None
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=config.OPENAI_MODEL,
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_BASE_URL,
        temperature=0,
        timeout=20,
        # One retry rides out a brief 503; more would burn the free tier's small daily quota.
        max_retries=1,
    )


def write_rationale(facts: dict) -> tuple[str, str | None]:
    """The LLM's rationale, or the template one when no LLM is set up or the call fails.

    The second value is the guardrail failure (docs/08_GenAI_Architecture.md): set when the
    LLM's prose used a number that isn't in the facts, so the caller never shows it.
    """
    llm = get_llm()
    if llm is not None:
        facts_text = json.dumps(facts, indent=2)
        rationale = None
        try:
            rationale = llm.invoke(RATIONALE_PROMPT.format(facts=facts_text)).content.strip() or None
        except Exception:
            # A busy or rate-limited LLM shouldn't fail a trip whose choices are already made.
            logger.warning("Rationale LLM call failed, using the template rationale", exc_info=True)
        if rationale is not None:
            invented = numbers_in(rationale) - numbers_in(facts_text)
            if invented:
                listed = ", ".join(f"{n:g}" for n in sorted(invented))
                return rationale, f"Rationale used numbers not in the itinerary: {listed}"
            return rationale, None
    return template_rationale(facts), None


def compose(state: PipelineState, use_llm: bool = True) -> dict:
    """The itinerary, or the reason none can be built, from a state check_node has run on.

    With `use_llm=False` the rationale is the template one: the What-If preview uses that so a
    preview is instant and spends no LLM quota. Applying the preview writes the real rationale.
    """
    check = state["check"]
    hotel_missing = check["nights"] > 0 and check["hotel"] is None and not state.get("hotels_unavailable")
    if check["flight"] is None or hotel_missing:
        return {"failure_reason": "; ".join(check["flags"]) or "No itinerary could be built"}

    facts = rationale_facts(state)
    rationale, invented = write_rationale(facts) if use_llm else (template_rationale(facts), None)
    if invented:
        # The guardrail fails the run instead of showing a figure the code didn't compute.
        return {"failure_reason": invented}

    return {
        "itinerary": {
            "flight": check["flight"],
            "return_flight": check.get("return_flight"),
            "hotel": check["hotel"],
            "total_cost": check["total_cost"],
            "savings": check.get("savings", 0.0),
            "rationale": rationale,
            "tradeoff_ledger": build_ledger(state),
        }
    }


def compose_node(state: PipelineState) -> dict:
    # The only LLM call in the pipeline, and it only writes prose: the choice, the total
    # and the Trade-off Ledger all come from check_node's numbers.
    return compose(state)


def rerun(state: PipelineState, use_llm: bool = True) -> PipelineState:
    """check + compose on saved search results, without searching again (What-If, PRD US-011)."""
    checked = {**state, **check_node(state)}
    return {**checked, **compose(checked, use_llm)}


class EditRefused(ValueError):
    """A reviewer edit that can't be applied; the message says why."""


KIND_NAMES = {"flight": "flight", "return": "return flight", "stay": "hotel"}


def edit_itinerary(state: PipelineState, current: dict, kind: str, option_id: str, picked: list[str]) -> dict:
    """Swaps one line item of a saved itinerary for another option from the same search (PRD US-007).

    `state` holds the request and the saved search results, `current` the itinerary's flight,
    return flight and hotel, `picked` the line items a reviewer already chose. Only options that
    pass every rule can be picked, so an edit changes the price but never brings in a flight on
    another day or one that breaks a preference. Total, budget verdict, savings, ledger and
    rationale are recomputed in code.
    """
    check = check_node(state)["check"]
    if kind == "stay" and check["nights"] == 0:
        raise EditRefused("A same-day trip has no stay to change")
    options = {
        "flight": state["flight_options"],
        "return": state.get("return_options", []),
        "stay": state["hotel_options"],
    }[kind]
    option = next((o for o in options if o["id"] == option_id), None)
    if option is None:
        raise EditRefused(f"{option_id} isn't one of this trip's {KIND_NAMES[kind]} options")
    # check_node judged return timing against its own outbound pick, so timing is checked
    # again below against the pair the reviewer ends up with.
    rejected_by_id = {i: r for i, r in rejections(check, kind).items() if r["rule"] != "connection"}
    if option_id in rejected_by_id:
        raise EditRefused(f"{option_id} can't be picked: {rejected_by_id[option_id]['detail']}")

    request = state["request"]
    flight = option if kind == "flight" else current["flight"]
    return_flight = option if kind == "return" else current.get("return_flight")
    hotel = option if kind == "stay" else current["hotel"]
    if return_flight and leaves_before_landing(return_flight, flight):
        raise EditRefused(f"{return_flight['id']} leaves before {flight['id']} lands")
    # check_node's flags describe its own pick: keep the availability ones, redo the budget and
    # policy ones for the line items the reviewer ends up with.
    _, _, own_budget_flag = price_check(
        request, check["flight"], check["hotel"], check["nights"], check.get("return_flight")
    )
    own = {
        own_budget_flag,
        *policy_flags(request, check["flight"], check.get("return_flight")),
        *fare_flags(state, request, check["flight"], check.get("return_flight")),
    }
    flags = [f for f in check["flags"] if f not in own]
    total_cost, within_budget, budget_flag = price_check(request, flight, hotel, check["nights"], return_flight)
    if budget_flag:
        flags.append(budget_flag)
    flags += policy_flags(request, flight, return_flight)
    flags += fare_flags(state, request, flight, return_flight)
    saved = savings(check["typical"], chosen_prices(flight, return_flight, hotel, check["nights"]))

    edited: PipelineState = {
        **state,
        "picked": sorted(set(picked) | {kind}),
        "check": {**check, "flight": flight, "return_flight": return_flight, "hotel": hotel,
                  "total_cost": total_cost, "within_budget": within_budget, "flags": flags, "savings": saved},
    }
    facts = rationale_facts(edited)
    rationale, invented = write_rationale(facts)
    if invented:
        # The reviewer made this choice, so a bad LLM sentence falls back instead of failing the trip.
        logger.warning("Edited itinerary's rationale failed the guardrail: %s", invented)
        rationale = template_rationale(facts)
    return {
        "flight": flight,
        "return_flight": return_flight,
        "hotel": hotel,
        "total_cost": total_cost,
        "savings": saved,
        "within_budget": within_budget,
        "flags": flags,
        "rationale": rationale,
        "tradeoff_ledger": build_ledger(edited),
        "picked": edited["picked"],
    }


def build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("search", search_node)
    graph.add_node("check", check_node)
    graph.add_node("compose", compose_node)
    graph.add_edge(START, "search")
    graph.add_edge("search", "check")
    graph.add_edge("check", "compose")
    graph.add_edge("compose", END)
    return graph.compile()


pipeline = build_graph()

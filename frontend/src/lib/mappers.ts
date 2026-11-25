import type { AirportResponse, AuditEventResponse, FlightResponse, LedgerEntryResponse, PolicyBody, PolicyResponse, TravelerBody, TravelerResponse, TripBody, TripResponse, TripResultResponse } from "./api";
import type { City } from "./catalog";
import { formatInr } from "./format";
import type { AuditEvent, CabinClass, ConstraintIssue, Flight, Hotel, Itinerary, LedgerEntry, Policy, Traveler, Trip, TripFilters } from "./types";

/**
 * Converts between the frontend's Traveler/Trip and the backend's smaller shapes.
 * The backend only stores name + preferences for a traveler and one traveler_id per
 * trip, so every frontend-only field travels inside `preferences`.
 */

type Prefs = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const obj = (v: unknown): Prefs => (v && typeof v === "object" && !Array.isArray(v) ? (v as Prefs) : {});

// ---------------------------------------------------------------- travelers

export type TravelerInput = Omit<Traveler, "id" | "createdAt">;

export function fromTraveler(t: TravelerInput, createdAt: string): TravelerBody {
  return {
    name: t.name,
    preferences: {
      ...t.preferences,
      email: t.email,
      department: t.department,
      homeCity: t.homeCity,
      createdAt,
    },
  };
}

export function toTraveler(r: TravelerResponse): Traveler {
  const p = obj(r.preferences);
  return {
    id: r.id,
    name: r.name,
    email: str(p.email),
    department: str(p.department, "Unassigned"),
    homeCity: str(p.homeCity),
    preferences: {
      seat: str(p.seat) || undefined,
      dietary: str(p.dietary) || undefined,
      notes: str(p.notes) || undefined,
      tags: strList(p.tags),
      preferredAirlines: strList(p.preferredAirlines),
    },
    // Travelers created outside the app (e.g. Swagger) have no stored timestamp.
    createdAt: str(p.createdAt, new Date(0).toISOString()),
  };
}

// ---------------------------------------------------------------- trips

export type TripInput = Omit<Trip, "id" | "code" | "status" | "createdAt" | "createdBy">;

const cabins: CabinClass[] = ["economy", "premium_economy", "business"];

/** The backend has no trip code, so derive a stable display code from the id. */
export const tripCode = (id: string) => `TRIP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

export function fromTrip(t: TripInput, createdAt: string): TripBody {
  const travelerId = t.travelerIds[0];
  if (!travelerId) throw new Error("Select a traveler for this trip.");
  if (!t.returnDate) throw new Error("A return date is required.");
  return {
    traveler_id: travelerId,
    origin: t.origin,
    destination: t.destination,
    dates: [t.departDate, t.returnDate],
    budget: t.budget,
    preferences: {
      title: t.title,
      purpose: t.purpose,
      rooms: t.rooms,
      notes: t.notes,
      filters: t.filters,
      createdAt,
      // Top-level keys the backend optimizer reads (backend/app/pipeline/graph.py).
      cabin_class: t.filters.cabin,
      max_stops: t.filters.maxStops,
      min_hotel_rating: t.filters.minHotelRating,
    },
  };
}

export function toTrip(r: TripResponse, ctx: { defaultFilters: TripFilters; createdBy: string }): Trip {
  const p = obj(r.preferences);
  const filters: TripFilters = { ...ctx.defaultFilters, ...(obj(p.filters) as Partial<TripFilters>) };
  // The optimizer's keys win, so a trip edited directly through the API still shows what it will run with.
  if (cabins.includes(p.cabin_class as CabinClass)) filters.cabin = p.cabin_class as CabinClass;
  if (p.max_stops === 0 || p.max_stops === 1 || p.max_stops === 2) filters.maxStops = p.max_stops;
  filters.minHotelRating = num(p.min_hotel_rating, filters.minHotelRating);
  return {
    id: r.id,
    code: tripCode(r.id),
    title: str(p.title) || `${r.origin} → ${r.destination}`,
    travelerIds: [r.traveler_id],
    origin: r.origin,
    destination: r.destination,
    departDate: r.dates[0],
    returnDate: r.dates[1],
    purpose: str(p.purpose),
    budget: Number(r.budget),
    rooms: num(p.rooms, 1),
    filters,
    notes: str(p.notes),
    status: r.status,
    failureReason: r.failure_reason ?? undefined,
    createdBy: ctx.createdBy,
    createdAt: str(p.createdAt, new Date(0).toISOString()),
  };
}

// ---------------------------------------------------------------- itineraries

const nightsBetween = (start: string, end: string | null) =>
  end ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)) : 0;

/** "FL-1001 IndiGo economy, 0 stop(s)" → "FL-1001" */
const optionIdOf = (alternative: string) => alternative.split(" ")[0];

const ledgerKinds = { flight: "outbound", return: "return", stay: "stay" } as const;

/** Names for the rules a ledger row can cite as "Preference <rule>: <detail>". */
const ruleLabels: Record<string, string> = {
  cabin_class: "Cabin class",
  max_stops: "Stops",
  departure_window: "Departure time",
  avoid_red_eye: "Red-eye flight",
  excluded_airlines: "Excluded airline",
  min_hotel_rating: "Hotel rating",
  max_nightly_rate: "Nightly rate cap",
  required_amenities: "Missing amenity",
  policy_hotel_cap: "Company hotel cap",
  policy_business_class: "Business class policy",
};

/** "Preference avoid_red_eye: FL-1 departs at 02:10" becomes "Red-eye flight: FL-1 departs at 02:10". Other reasons are already plain. */
export function readableReason(reason: string): string {
  const m = /^Preference ([a-z_]+): ([\s\S]*)$/.exec(reason);
  if (!m) return reason;
  const label = ruleLabels[m[1]] ?? m[1].replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return `${label}: ${m[2]}`;
}

function toLedgerEntry(e: LedgerEntryResponse, i: number, nights: number): LedgerEntry {
  const optionId = optionIdOf(e.alternative);
  const isStay = e.kind ? e.kind === "stay" : optionId.startsWith("HT-");
  // A rule ruled it out: a broken preference, a fare on another day, or a return that leaves too early.
  const screened = e.reason.startsWith("Preference") || e.reason.startsWith("Different day") || e.reason.startsWith("Timing");
  // A train or bus of a trip by train or bus may have no published fare.
  const price = e.price ?? 0;
  return {
    id: `led_${i}_${optionId}`,
    kind: e.kind ? ledgerKinds[e.kind] : isStay ? "stay" : "outbound",
    optionId,
    label: e.alternative,
    // The UI shows stays per night; the backend prices them for the whole stay.
    detail: isStay ? `${formatInr(price)} for ${nights} night${nights === 1 ? "" : "s"}` : e.price === null ? "Fare not published" : "One-way fare per traveler",
    price: isStay && nights > 0 ? price / nights : price,
    priceKnown: e.price !== null,
    won: e.won,
    feasible: !screened,
    reasonCode: e.won ? "WINNER" : screened ? "CONSTRAINT" : "PRICE",
    reason: readableReason(e.reason),
  };
}

function toIssue(flag: string, i: number): ConstraintIssue {
  const overBudget = /^Total .* over/.test(flag);
  // Without a live hotel provider the trip is still valid, just flight-only.
  if (/hotel prices are unavailable/i.test(flag)) return { id: `iss_${i}`, rule: "Hotel prices", lineItem: "Stay", severity: "info", message: flag };
  // A trip with no return fare is still valid; its total just has no flight back in it.
  if (/no return flight in it/i.test(flag)) return { id: `iss_${i}`, rule: "Return flight", lineItem: "Return", severity: "warning", message: flag };
  // Fare hints from the search data: a cheaper fare on a nearby day, or Google rating the date's fares as high.
  const fare = /^(Flight|Return flight): (.*)$/.exec(flag);
  if (fare && (/ on the trip's date$/.test(fare[2]) || /^Google Flights rates fares/.test(fare[2]))) {
    return {
      id: `iss_${i}`,
      rule: fare[2].startsWith("Google") ? "Fare level" : "Cheaper nearby date",
      lineItem: fare[1] === "Flight" ? "Outbound flight" : "Return flight",
      severity: "warning",
      message: flag,
    };
  }
  return {
    id: `iss_${i}`,
    rule: overBudget ? "Budget" : "Availability",
    lineItem: overBudget ? "Total cost" : "Search results",
    severity: overBudget ? "error" : "warning",
    message: flag,
  };
}

/** Providers leave fields out as null; the frontend types use undefined for "not known". */
const orUndefined = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

function toFlight(f: FlightResponse): Flight {
  return {
    id: f.id,
    origin: f.origin,
    destination: f.destination,
    airline: f.mode ? (f.operator ?? f.airline) : f.airline,
    flightNo: f.mode ? (f.service ?? f.id) : (f.flight_number ?? f.id),
    departure: f.departure_time,
    arrival: orUndefined(f.arrival_time),
    durationMin: orUndefined(f.duration_minutes),
    price: f.price ?? 0,
    priceKnown: f.price !== null,
    mode: f.mode,
    bookingLabel: orUndefined(f.link_label),
    classFares: orUndefined(f.class_fares),
    fareClass: orUndefined(f.fare_class),
    classFaresLabel: orUndefined(f.class_fares_label),
    classFaresNote: orUndefined(f.class_fares_note),
    fromStation: orUndefined(f.from_station),
    toStation: orUndefined(f.to_station),
    cabin: cabins.includes(f.cabin_class as CabinClass) ? (f.cabin_class as CabinClass) : "economy",
    stops: f.stops,
    layovers: f.layovers?.map((l) => ({
      airport: l.airport ?? "",
      airportName: orUndefined(l.airport_name),
      minutes: orUndefined(l.minutes),
      overnight: l.overnight,
    })),
    priceLevel: orUndefined(f.price_level),
    typicalPriceRange: orUndefined(f.typical_price_range),
    priceStatus: f.price_status,
    bookingLink: orUndefined(f.link),
    source: f.source,
  };
}

/**
 * Converts the backend optimizer's result into the frontend Itinerary. Only data the backend
 * returns is shown: an outbound flight, a return flight when one was found, and a stay, for
 * one traveler and one room, with no option scores. Savings are against the median-priced options
 * that met every rule, so baselineCost is total + savings; 0 when the backend has no figure.
 */
export function toItinerary(r: TripResultResponse, trip: Trip, opts: { runMs?: number; generatedAt?: string } = {}): Itinerary | undefined {
  const it = r.itinerary;
  if (!it) return undefined;
  const nights = nightsBetween(trip.departDate, trip.returnDate);
  const f = it.flight;
  const back = it.return_flight ?? null;
  const h = it.hotel;
  const savings = typeof it.savings === "number" ? it.savings : null;
  const stay: Hotel | null = h
    ? {
        id: h.id,
        city: h.city,
        name: h.name,
        area: orUndefined(h.address),
        pricePerNight: h.price_per_night,
        rating: orUndefined(h.rating),
        stars: orUndefined(h.stars),
        amenities: h.amenities ?? [],
        distanceKm: orUndefined(h.distance_to_center_km),
        images: h.images?.map((img) => ({ thumbnail: orUndefined(img.thumbnail), original: orUndefined(img.original) })),
        latitude: orUndefined(h.latitude),
        longitude: orUndefined(h.longitude),
        priceStatus: h.price_status,
        source: h.source,
      }
    : null;
  return {
    outbound: toFlight(f),
    return: back ? toFlight(back) : null,
    stay,
    nights,
    rooms: 1,
    travelers: 1,
    flightCost: (f.price ?? 0) + (back?.price ?? 0),
    stayCost: h ? h.price_per_night * nights : 0,
    totalCost: it.total_cost,
    baselineCost: savings === null ? 0 : it.total_cost + savings,
    savings: savings ?? 0,
    savingsBasis: "valid-options",
    ledger: r.tradeoff_ledger.map((e, i) => toLedgerEntry(e, i, nights)),
    issues: it.flags.map(toIssue),
    rationale: it.rationale,
    generatedAt: opts.generatedAt ?? "",
    runMs: opts.runMs ?? 0,
    edited: (it.picked?.length ?? 0) > 0,
    locked: it.editable === false,
  };
}

// ---------------------------------------------------------------- policy

/** The backend's snake_case policy as the Settings page and the optimizer use it. */
export function toPolicy(r: PolicyResponse): Policy {
  return {
    currency: "INR",
    managerApprovalFlightOver: r.manager_approval_flight_over,
    maxNightlyRate: r.max_nightly_rate,
    maxNightlyRateIntl: r.max_nightly_rate_intl,
    businessClassMinHours: r.business_class_min_hours,
    advanceBookingDays: r.advance_booking_days,
    preferredAirlines: r.preferred_airlines,
    updatedAt: r.updated_at ?? undefined,
    updatedBy: r.updated_by ?? undefined,
  };
}

/** The six editable fields for PUT /policy. */
export function fromPolicy(p: Policy): PolicyBody {
  return {
    manager_approval_flight_over: p.managerApprovalFlightOver,
    max_nightly_rate: p.maxNightlyRate,
    max_nightly_rate_intl: p.maxNightlyRateIntl,
    business_class_min_hours: p.businessClassMinHours,
    advance_booking_days: p.advanceBookingDays,
    preferred_airlines: p.preferredAirlines,
  };
}

// ---------------------------------------------------------------- audit

const fieldLabels: Record<string, string> = {
  budget: "budget",
  cabin_class: "cabin",
  max_stops: "max stops",
  min_hotel_rating: "min hotel rating",
  traveler_id: "traveler",
  preferences: "filters",
};

/** Field changes arrive as "max_stops 1 -> 0"; show them as "max stops 1 → 0". */
function readableSummary(summary: string): string {
  return summary
    .replace(/\b(budget|cabin_class|max_stops|min_hotel_rating) (\S+) -> (\S+?)(?=[,)])/g, (_m, f: string, from: string, to: string) => `${fieldLabels[f]} ${from} → ${to}`)
    .replace(/ -> /g, " → ")
    .replace(/(changed )([a-z_, ]+)$/, (_m, lead: string, list: string) => lead + list.replace(/\b[a-z_]+\b/g, (w) => fieldLabels[w] ?? w));
}

/** A row of GET /audit as the Audit page shows it. */
export function toAuditEvent(r: AuditEventResponse): AuditEvent {
  return {
    id: r.id,
    tripId: r.trip_id,
    type: r.event_type as AuditEvent["type"],
    actor: r.actor,
    actorName: r.actor_name ?? undefined,
    summary: readableSummary(r.summary),
    payload: r.payload,
    createdAt: r.created_at,
  };
}

/**
 * An airport from GET /airports as a City, so the forms and labels treat it like the built-in
 * list. hotelIndex only matters to demo mode's generated prices, which never use these.
 */
export function toCity(a: AirportResponse): City {
  return {
    code: a.code,
    name: a.city,
    country: a.country_name,
    lat: a.latitude,
    lon: a.longitude,
    international: a.country !== "IN",
    hotelIndex: 1,
  };
}

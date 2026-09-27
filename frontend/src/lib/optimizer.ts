import { cabinLabel, cityByCode, searchFlights, searchHotels, amenityLabel } from "./catalog";
import { formatInr, formatDuration, formatTime } from "./format";
import type {
  ConstraintIssue,
  Flight,
  Hotel,
  Itinerary,
  LedgerEntry,
  Policy,
  Priority,
  ReasonCode,
  TimeWindow,
  Trip,
} from "./types";

/**
 * Two-stage optimization pipeline (docs/08_GenAI_Architecture.md):
 *   1. search + hard-constraint screening + scoring  → candidate pool
 *   2. combination search under budget + composition → itinerary, ledger, issues, rationale
 * Every money figure is computed here; the rationale only restates numbers already
 * present on the itinerary (product principle: no unsupported financial claims).
 */

export const windowHours: Record<TimeWindow, [number, number] | null> = {
  any: null,
  early_morning: [4, 8],
  morning: [8, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 28],
};

export const windowLabel: Record<TimeWindow, string> = {
  any: "Any time",
  early_morning: "Early morning (4–8)",
  morning: "Morning (8–12)",
  afternoon: "Afternoon (12–17)",
  evening: "Evening (17–21)",
  night: "Night (21–4)",
};

export const priorityLabel: Record<Priority, string> = {
  cheapest: "Lowest cost",
  balanced: "Balanced",
  comfort: "Comfort first",
  fastest: "Fastest travel",
};

const weights: Record<Priority, { cost: number; time: number; comfort: number }> = {
  cheapest: { cost: 0.75, time: 0.1, comfort: 0.15 },
  balanced: { cost: 0.5, time: 0.25, comfort: 0.25 },
  comfort: { cost: 0.25, time: 0.25, comfort: 0.5 },
  fastest: { cost: 0.3, time: 0.55, comfort: 0.15 },
};

type Screened<T> = { option: T; score: number; reject?: { code: ReasonCode; reason: string } };

function hourOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

export function isRedEye(f: Flight) {
  const h = hourOf(f.departure);
  return h < 5 || h >= 22.5;
}

function inWindow(f: Flight, w: TimeWindow) {
  const range = windowHours[w];
  if (!range) return true;
  let h = hourOf(f.departure);
  if (w === "night" && h < 4) h += 24;
  return h >= range[0] && h < range[1];
}

export function nightsBetween(a: string, b: string | null) {
  if (!b) return 1;
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function screenFlights(flights: Flight[], trip: Trip): Screened<Flight>[] {
  const f = trip.filters;
  const w = weights[f.priority];
  const prices = flights.map((x) => x.price);
  const durs = flights.map((x) => x.durationMin);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minD = Math.min(...durs);
  const maxD = Math.max(...durs);

  return flights.map((fl) => {
    const costScore = 1 - (fl.price - minP) / Math.max(1, maxP - minP);
    const timeScore = 1 - (fl.durationMin - minD) / Math.max(1, maxD - minD);
    let comfort = 1 - fl.stops * 0.35;
    if (isRedEye(fl)) comfort -= 0.25;
    if (fl.refundable) comfort += 0.1;
    if (f.preferredAirlines.includes(fl.airline)) comfort += 0.25;
    const score = Math.round((w.cost * costScore + w.time * timeScore + w.comfort * Math.max(0, Math.min(1, comfort))) * 100);

    let reject: Screened<Flight>["reject"];
    if (f.excludedAirlines.includes(fl.airline)) {
      reject = { code: "CONSTRAINT", reason: `${fl.airline} is on the excluded-airline list for this trip.` };
    } else if (fl.stops > f.maxStops) {
      reject = {
        code: "CONSTRAINT",
        reason: `${fl.stops} stop${fl.stops > 1 ? "s" : ""} via ${fl.via} exceeds the max-stops rule (${f.maxStops === 0 ? "non-stop only" : `≤ ${f.maxStops}`}).`,
      };
    } else if (f.avoidRedEye && isRedEye(fl)) {
      reject = { code: "PREFERENCE", reason: `Red-eye departure at ${formatTime(fl.departure)} — traveler asked to avoid red-eyes.` };
    } else if (!inWindow(fl, f.departureWindow)) {
      reject = {
        code: "PREFERENCE",
        reason: `Departs ${formatTime(fl.departure)}, outside the preferred ${windowLabel[f.departureWindow].toLowerCase()} window.`,
      };
    }
    return { option: fl, score, reject };
  });
}

function screenHotels(hotels: Hotel[], trip: Trip, policy: Policy): Screened<Hotel>[] {
  const f = trip.filters;
  const w = weights[f.priority];
  const intl = cityByCode[trip.destination]?.international;
  const policyCap = intl ? policy.maxNightlyRateIntl : policy.maxNightlyRate;
  const cap = f.maxNightlyRate ?? null;
  const prices = hotels.map((h) => h.pricePerNight);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  return hotels.map((h) => {
    const costScore = 1 - (h.pricePerNight - minP) / Math.max(1, maxP - minP);
    const locScore = 1 - Math.min(1, h.distanceKm / 10);
    const comfort = (h.rating - 3) / 2 * 0.7 + (h.amenities.length / 8) * 0.3;
    const score = Math.round((w.cost * costScore + w.time * locScore + w.comfort * Math.max(0, Math.min(1, comfort))) * 100);

    let reject: Screened<Hotel>["reject"];
    const missing = f.requiredAmenities.filter((a) => !h.amenities.includes(a));
    if (h.rating < f.minHotelRating) {
      reject = { code: "CONSTRAINT", reason: `Guest rating ${h.rating} is below the ${f.minHotelRating}+ minimum.` };
    } else if (h.distanceKm > f.maxHotelDistanceKm) {
      reject = { code: "CONSTRAINT", reason: `${h.distanceKm} km from the city centre exceeds the ${f.maxHotelDistanceKm} km limit.` };
    } else if (cap !== null && h.pricePerNight > cap) {
      reject = { code: "BUDGET", reason: `${formatInr(h.pricePerNight)}/night is over the trip's nightly cap of ${formatInr(cap)}.` };
    } else if (h.pricePerNight > policyCap) {
      reject = {
        code: "CONSTRAINT",
        reason: `${formatInr(h.pricePerNight)}/night breaks the company hotel policy cap of ${formatInr(policyCap)}.`,
      };
    } else if (missing.length) {
      reject = { code: "PREFERENCE", reason: `Missing required amenities: ${missing.map((m) => amenityLabel[m] ?? m).join(", ")}.` };
    }
    return { option: h, score, reject };
  });
}

import type { TravelerBody, TravelerResponse, TripBody, TripResponse } from "./api";
import type { CabinClass, Traveler, Trip, TripFilters } from "./types";

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
    createdBy: ctx.createdBy,
    createdAt: str(p.createdAt, new Date(0).toISOString()),
  };
}

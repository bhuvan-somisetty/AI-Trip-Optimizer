import type { Outcome, Session, TripStatus } from "./types";

/**
 * Thin client for the FastAPI backend (docs/07_API_Specification.md). When the API
 * isn't reachable at sign-in the app falls back to workspace mode so demos never dead-end.
 * Resource calls return the backend's own shapes; lib/mappers.ts converts them.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** An error response from the API, carrying the HTTP status so callers can branch on 401/404/409. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The backend couldn't be reached at all (not running, blocked, or timed out). */
export class ApiUnavailable extends ApiError {
  constructor() {
    super(0, "Can't reach the server. Check that the backend is running.");
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function call<T>(method: Method, path: string, opts: { body?: unknown; token?: string; timeoutMs?: number } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiUnavailable();
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, detailMessage(data, `Request failed (${res.status})`));
  return data as T;
}

function detailMessage(data: { detail?: unknown }, fallback: string) {
  const { detail } = data;
  if (typeof detail === "string") return detail;
  // FastAPI validation errors (422) return detail as a list of { msg, loc }
  if (Array.isArray(detail)) {
    const messages = detail
      .filter((d): d is { msg: string; loc?: unknown[] } => typeof d?.msg === "string")
      .map((d) => {
        const msg = d.msg.replace(/^Value error, /, "");
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field}: ${msg}` : msg;
      });
    if (messages.length) return messages.join("; ");
  }
  return fallback;
}

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/** Decodes a JWT's payload without checking it; only for display fields, never for trust. */
function jwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

/** Reads the role claim from the JWT payload; the backend has no /me endpoint. */
function roleFromToken(token: string): Session["role"] {
  return jwtPayload(token).role === "admin" ? "admin" : "member";
}

/**
 * Demo mode runs the whole app in the browser on generated flights and hotels. It is off unless
 * NEXT_PUBLIC_DEMO_MODE=true, so a real deployment never falls back to made-up data when the
 * backend is down; the login form shows "Can't reach the server" instead.
 */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Auth calls give up quickly so an offline backend drops straight into demo mode (when enabled).
const AUTH_TIMEOUT_MS = 2500;

/** The signed-in user's account (GET /me). `name` is null until they set one; the email can't change. */
export type MeResponse = { id: string; email: string; name: string | null; role: Session["role"] };

export const getMe = (token: string) => call<MeResponse>("GET", "/me", { token });

/** The name is 1-100 characters and not blank (422 otherwise). */
export const updateMe = (token: string, body: { name: string }) => call<MeResponse>("PATCH", "/me", { token, body });

/**
 * Builds the session from GET /me so the role and name come from the server. If /me can't be read,
 * the role from the token and the fallback name still let the user in.
 */
async function sessionFor(token: string, email: string, fallbackName: string): Promise<Session> {
  try {
    const me = await getMe(token);
    return { name: me.name || fallbackName, email: me.email, role: me.role, mode: "api", token };
  } catch {
    return { name: fallbackName, email, role: roleFromToken(token), mode: "api", token };
  }
}

export async function login(email: string, password: string): Promise<Session> {
  try {
    const { access_token } = await call<{ access_token: string }>("POST", "/auth/login", {
      body: { email, password },
      timeoutMs: AUTH_TIMEOUT_MS,
    });
    return await sessionFor(access_token, email, nameFromEmail(email));
  } catch (e) {
    if (e instanceof ApiUnavailable && DEMO_ENABLED) return { name: nameFromEmail(email), email, role: "admin", mode: "demo" };
    throw e;
  }
}

/**
 * Signs in with the ID token from Google's button. The backend checks it and returns our own JWT;
 * the name and email shown in the app come from Google's token.
 */
export async function loginWithGoogle(credential: string): Promise<Session> {
  const { access_token } = await call<{ access_token: string }>("POST", "/auth/google", { body: { credential } });
  const google = jwtPayload(credential);
  const email = typeof google.email === "string" ? google.email : "";
  return sessionFor(access_token, email, typeof google.name === "string" && google.name ? google.name : nameFromEmail(email));
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  try {
    await call("POST", "/auth/register", { body: { email, password, name }, timeoutMs: AUTH_TIMEOUT_MS });
    const { access_token } = await call<{ access_token: string }>("POST", "/auth/login", {
      body: { email, password },
      timeoutMs: AUTH_TIMEOUT_MS,
    });
    return await sessionFor(access_token, email, name);
  } catch (e) {
    if (e instanceof ApiUnavailable && DEMO_ENABLED) return { name, email, role: "admin", mode: "demo" };
    throw e;
  }
}

// ---------------------------------------------------------------- travel policy

/** The company travel policy as the backend stores it (snake_case). `updated_by` is the editor's email. */
export type PolicyResponse = {
  manager_approval_flight_over: number;
  max_nightly_rate: number;
  max_nightly_rate_intl: number;
  business_class_min_hours: number;
  advance_booking_days: number;
  preferred_airlines: string[];
  updated_at: string | null;
  updated_by: string | null;
};
export type PolicyBody = Omit<PolicyResponse, "updated_at" | "updated_by">;

export const getPolicy = (token: string) => call<PolicyResponse>("GET", "/policy", { token });

/** Admins only: 403 for members. Writes a POLICY_UPDATED audit event. */
export const putPolicy = (token: string, body: PolicyBody) => call<PolicyResponse>("PUT", "/policy", { token, body });

// ---------------------------------------------------------------- travelers & trips

export type TravelerBody = { name: string; preferences: Record<string, unknown> };
export type TravelerResponse = TravelerBody & { id: string; created_by: string };

export type TripBody = {
  traveler_id: string;
  origin: string;
  destination: string;
  /** [start, end] as YYYY-MM-DD */
  dates: [string, string];
  budget: number;
  preferences: Record<string, unknown>;
};
export type TripResponse = TripBody & { id: string; status: TripStatus; failure_reason: string | null; created_by: string };

const id = encodeURIComponent;

export const listTravelers = (token: string) => call<TravelerResponse[]>("GET", "/travelers", { token });

export const createTraveler = (token: string, body: TravelerBody) => call<TravelerResponse>("POST", "/traveler", { token, body });

export const updateTraveler = (token: string, travelerId: string, body: TravelerBody) =>
  call<TravelerResponse>("PUT", `/traveler/${id(travelerId)}`, { token, body });

/** 409 when the traveler still has trips; 404 when it isn't yours. */
export const deleteTraveler = (token: string, travelerId: string) => call<void>("DELETE", `/traveler/${id(travelerId)}`, { token });

export const listTrips = (token: string, status?: TripStatus) =>
  call<TripResponse[]>("GET", `/trips${status ? `?status=${id(status)}` : ""}`, { token });

export const getTrip = (token: string, tripId: string) => call<TripResponse>("GET", `/trips/${id(tripId)}`, { token });

export const createTrip = (token: string, body: TripBody) => call<TripResponse>("POST", "/trip", { token, body });

/**
 * Any subset of the trip fields; leave a field out instead of sending null. `preferences` replaces the whole object.
 * 409 when the trip is OPTIMIZING, UNDER_REVIEW or DECIDED; 404 when it isn't yours; 422 on bad values.
 * An optimized or failed trip goes back to DRAFT and loses its saved itinerary.
 */
export const updateTrip = (token: string, tripId: string, body: Partial<TripBody>) =>
  call<TripResponse>("PATCH", `/trips/${id(tripId)}`, { token, body });

// ---------------------------------------------------------------- optimize, review, decide

/** One row of the backend's Trade-off Ledger. Stay prices are the total for the whole stay. */
export type LedgerEntryResponse = {
  /** "flight" (outbound) | "return" | "stay"; null for itineraries saved before the backend recorded it */
  kind: "flight" | "return" | "stay" | null;
  alternative: string;
  price: number;
  won: boolean;
  reason: string;
};

/** A flight as backend/app/travel_data.py returns it; fields the provider didn't send are null. */
export type FlightResponse = {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time?: string | null;
  airline: string;
  flight_number?: string | null;
  price: number;
  currency?: string;
  cabin_class: string;
  stops: number;
  /** Each connection, as Google Flights lists it; empty for non-stop, missing for cached fares. */
  layovers?: { airport: string | null; airport_name: string | null; minutes: number | null; overnight: boolean }[];
  duration_minutes?: number | null;
  /** Google Flights' fare level for the date; null when Google gave none. */
  price_level?: "low" | "typical" | "high" | null;
  typical_price_range?: [number, number] | null;
  price_status?: "cached" | "live";
  link?: string | null;
  source?: string;
};

export type HotelResponse = {
  id: string;
  city: string;
  name: string;
  address?: string | null;
  price_per_night: number;
  rating?: number | null;
  stars?: number | null;
  amenities?: string[];
  distance_to_center_km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Google Hotels' photos, up to 5. */
  images?: { thumbnail: string | null; original: string | null }[];
  price_status?: "cached" | "live";
  source?: string;
};

export type ItineraryResponse = {
  flight: FlightResponse;
  /** null when no return fare was found on the end date (a flag says so); missing from older backends */
  return_flight?: FlightResponse | null;
  hotel: HotelResponse | null;
  total_cost: number;
  /** the median-priced options that met every rule minus the chosen ones; null on itineraries saved before savings existed */
  savings?: number | null;
  within_budget: boolean;
  flags: string[];
  rationale: string;
  /** line items a reviewer swapped in by hand; missing from older backends */
  picked?: ("flight" | "return" | "stay")[];
  /** false for itineraries saved before the backend kept search results: re-optimize to edit */
  editable?: boolean;
};

/** What optimize and GET itinerary return; `itinerary` is null and `reason` set when optimization failed. */
export type TripResultResponse = {
  status: TripStatus;
  itinerary: ItineraryResponse | null;
  tradeoff_ledger: LedgerEntryResponse[];
  reason: string | null;
};

export type DecisionResponse = {
  id: string;
  trip_id: string;
  outcome: Outcome;
  reason: string | null;
  decided_by: string;
  decided_at: string;
};

// The pipeline calls the flight and hotel providers and then the LLM (~20 s), which can take a while.
const OPTIMIZE_TIMEOUT_MS = 90000;

/** 409 when the trip is under review, decided, or already optimizing. */
export const optimizeTrip = (token: string, tripId: string) =>
  call<TripResultResponse>("POST", `/trips/${id(tripId)}/optimize`, { token, timeoutMs: OPTIMIZE_TIMEOUT_MS });

/** 404 when the trip hasn't been optimized yet. */
export const getItinerary = (token: string, tripId: string) => call<TripResultResponse>("GET", `/trips/${id(tripId)}/itinerary`, { token });

/** OPTIMIZED → UNDER_REVIEW; 409 from any other status. */
export const startReview = (token: string, tripId: string) => call<TripResponse>("POST", `/trips/${id(tripId)}/review`, { token });

/** 400 when rejecting without a reason; 409 unless the trip is OPTIMIZED or UNDER_REVIEW. */
export const decideTrip = (token: string, tripId: string, outcome: Outcome, reason: string | null) =>
  call<DecisionResponse>("POST", `/trips/${id(tripId)}/decision`, { token, body: { outcome, reason } });

/**
 * PRD US-007: swaps the flight or hotel for another option from the same search; the backend
 * recomputes the total, flags, ledger and rationale. 400 for an option that breaks a rule,
 * 409 unless the trip is OPTIMIZED or UNDER_REVIEW.
 */
export const editItinerary = (token: string, tripId: string, kind: "flight" | "return" | "stay", optionId: string) =>
  call<TripResultResponse>("PATCH", `/trips/${id(tripId)}/itinerary`, { token, body: { kind, option_id: optionId } });

/**
 * PRD US-011 What-If inputs. Only the keys sent change; a preference sent as null is removed,
 * so the optimizer stops screening on it.
 */
export type WhatIfBody = {
  budget?: number;
  cabin_class?: "economy" | "premium_economy" | "business" | null;
  max_stops?: 0 | 1 | 2 | null;
  min_hotel_rating?: number | null;
};

export type Change = { field: string; before: string | number | boolean | null; after: string | number | boolean | null };

export type WhatIfResponse = {
  inputs: Change[];
  /** status is what the trip would become: OPTIMIZED, or OPTIMIZATION_FAILED with a reason */
  preview: TripResultResponse;
  /** what changes in the itinerary; empty when the result is the same */
  diff: Change[];
};

/** Reruns the optimizer on the trip's saved search results; saves nothing. 400 when nothing changes. */
export const previewTrip = (token: string, tripId: string, body: WhatIfBody) =>
  call<WhatIfResponse>("POST", `/trips/${id(tripId)}/preview`, { token, body });

/** Saves the inputs and the itinerary they produce; the trip moves to UNDER_REVIEW. 400 when no itinerary can be built. */
export const applyPreview = (token: string, tripId: string, body: WhatIfBody) =>
  call<TripResultResponse>("POST", `/trips/${id(tripId)}/preview/apply`, { token, body, timeoutMs: OPTIMIZE_TIMEOUT_MS });

/** One row of the server-side audit trail (GET /audit), newest first. */
export type AuditEventResponse = {
  id: string;
  trip_id: string | null;
  event_type: string;
  actor: string; // email of the user who did it; admins see everyone's events
  actor_name: string | null; // their display name, null until they set one
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export const listAudit = (token: string) => call<AuditEventResponse[]>("GET", "/audit?limit=500", { token });

/** 404 when the trip hasn't been decided yet. */
export const getDecision = (token: string, tripId: string) => call<DecisionResponse>("GET", `/trips/${id(tripId)}/decision`, { token });

// ---------------------------------------------------------------- explore, route, transport

// The first explore or route for a city asks OpenTripMap and OpenStreetMap live (30 to 70 s); later ones are cached.
const PLACES_TIMEOUT_MS = 100000;

/** An attraction or restaurant from OpenTripMap; fields it didn't send are null. */
export type PlaceResponse = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  wikipedia: string | null;
  rating: number | string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  source: string;
  data_label: string;
};

/** A local dish: the name and description come from the AI model, the photo and text from Wikipedia. */
export type DishResponse = {
  name: string;
  ai_description: string | null;
  image: string | null;
  wikipedia_text: string | null;
  wikipedia: string | null;
  data_label: string;
  image_label: string | null;
};

export type ExploreResponse = {
  city: string;
  city_name: string;
  attractions: PlaceResponse[];
  restaurants: PlaceResponse[];
  dishes: DishResponse[];
  /** why the places lists are empty; null when they loaded */
  notice: string | null;
  /** why the dishes list is empty; null when it loaded */
  dishes_notice: string | null;
  source: string | null;
  fetched_at: string | null;
  cached: boolean;
};

export const getExplore = (token: string, tripId: string) =>
  call<ExploreResponse>("GET", `/trips/${id(tripId)}/explore`, { token, timeoutMs: PLACES_TIMEOUT_MS });

export type RouteStopResponse = {
  order: number;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  /** metres from the place to the nearest road */
  to_road_m: number;
  road_m_from_hotel: number;
};

export type RouteLegResponse = {
  from: string;
  to: string;
  road_m: number;
  straight_m: number;
  /** [lat, lon] points along the road */
  path: [number, number][];
};

export type RouteResponse = {
  city: string;
  hotel: { name: string; latitude: number; longitude: number; to_road_m: number } | null;
  stops: RouteStopResponse[];
  legs: RouteLegResponse[];
  total_road_m: number | null;
  /** attractions no road from the hotel reaches */
  unreachable: string[];
  source: string;
  data_label: string;
  /** why there is no route (e.g. the trip isn't optimized yet); null when there is one */
  notice: string | null;
};

export const getRoute = (token: string, tripId: string, stops: number) =>
  call<RouteResponse>("GET", `/trips/${id(tripId)}/route?stops=${stops}`, { token, timeoutMs: PLACES_TIMEOUT_MS });

export type TransportStop = { name: string | null; code: string | null; time: string | null };

/** A train, bus or ferry from Google Maps transit. The fare is null (fare_label "Not available") unless Google gave one. */
export type GroundOptionResponse = {
  id: string;
  kind: "train" | "bus" | "ferry";
  service: string | null;
  operator: string | null;
  from: TransportStop;
  to: TransportStop;
  departs: string | null;
  arrives: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  changes: number;
  legs: { service: string | null; kind: "train" | "bus" | "ferry" | null; from: TransportStop; to: TransportStop; duration_minutes: number | null }[];
  fare: number | null;
  currency: string | null;
  fare_label: string;
  source: string;
  data_label: string;
};

export type TransportFlightResponse = {
  kind: "flight";
  service: string;
  departs: string | null;
  arrives: string | null;
  duration_minutes: number | null;
  stops: number | null;
  fare: number | null;
  currency: string;
  fare_label: string;
  source: string | null;
  data_label: string;
};

export type TransportResponse = {
  origin: string;
  destination: string;
  date: string;
  flight: TransportFlightResponse | null;
  trains: GroundOptionResponse[];
  buses: GroundOptionResponse[];
  /** Missing from an API without ferry search; treat that as an empty list. */
  ferries?: GroundOptionResponse[];
  comparison: { mode: "Flight" | "Train" | "Bus" | "Ferry"; service: string | null; departs: string | null; duration_minutes: number | null; fare: number | null; currency: string | null; fare_label: string }[];
  notice: string | null;
};

export const getTransport = (token: string, tripId: string) =>
  call<TransportResponse>("GET", `/trips/${id(tripId)}/transport`, { token, timeoutMs: PLACES_TIMEOUT_MS });

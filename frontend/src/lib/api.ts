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

type Method = "GET" | "POST" | "PUT" | "DELETE";

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

/** Reads the role claim from the JWT payload; the backend has no /me endpoint. */
function roleFromToken(token: string): Session["role"] {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
    return payload.role === "admin" ? "admin" : "member";
  } catch {
    return "member";
  }
}

// Auth calls give up quickly so an offline backend drops straight into demo mode.
const AUTH_TIMEOUT_MS = 2500;

export async function login(email: string, password: string, name?: string): Promise<Session> {
  try {
    const { access_token } = await call<{ access_token: string }>("POST", "/auth/login", {
      body: { email, password },
      timeoutMs: AUTH_TIMEOUT_MS,
    });
    return {
      name: name || nameFromEmail(email),
      email,
      role: roleFromToken(access_token),
      mode: "api",
      token: access_token,
    };
  } catch (e) {
    if (e instanceof ApiUnavailable) return { name: name || nameFromEmail(email), email, role: "admin", mode: "demo" };
    throw e;
  }
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  try {
    await call("POST", "/auth/register", { body: { email, password }, timeoutMs: AUTH_TIMEOUT_MS });
    return await login(email, password, name);
  } catch (e) {
    if (e instanceof ApiUnavailable) return { name, email, role: "admin", mode: "demo" };
    throw e;
  }
}

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

// ---------------------------------------------------------------- optimize, review, decide

export type ApiFlight = {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  airline: string;
  price: number;
  cabin_class: string;
  stops: number;
};

export type ApiHotel = {
  id: string;
  city: string;
  name: string;
  price_per_night: number;
  rating: number;
  amenities: string[];
  distance_to_center_km: number;
};

export type TripResult = {
  status: TripStatus;
  itinerary: null | {
    flight: ApiFlight;
    hotel: ApiHotel | null;
    total_cost: number;
    within_budget: boolean;
    flags: string[];
    rationale: string;
  };
  tradeoff_ledger: { alternative: string; price: number; won: boolean; reason: string }[];
  /** Failure reason when status is OPTIMIZATION_FAILED */
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

// The pipeline runs inside the request (and may call an LLM for the rationale), so allow longer than other calls.
const OPTIMIZE_TIMEOUT_MS = 60000;

/** 409 unless the trip is DRAFT, OPTIMIZED or OPTIMIZATION_FAILED. */
export const optimizeTrip = (token: string, tripId: string) =>
  call<TripResult>("POST", `/trips/${id(tripId)}/optimize`, { token, timeoutMs: OPTIMIZE_TIMEOUT_MS });

/** The saved result, without re-running; 404 if the trip was never optimized. */
export const getItinerary = (token: string, tripId: string) => call<TripResult>("GET", `/trips/${id(tripId)}/itinerary`, { token });

/** 409 unless the trip is OPTIMIZED. */
export const startReview = (token: string, tripId: string) => call<TripResponse>("POST", `/trips/${id(tripId)}/review`, { token });

/** 409 unless OPTIMIZED or UNDER_REVIEW; 400 when rejecting without a reason. */
export const decideTrip = (token: string, tripId: string, outcome: Outcome, reason: string) =>
  call<DecisionResponse>("POST", `/trips/${id(tripId)}/decision`, { token, body: { outcome, reason } });

/** 404 if the trip hasn't been decided. */
export const getDecision = (token: string, tripId: string) => call<DecisionResponse>("GET", `/trips/${id(tripId)}/decision`, { token });

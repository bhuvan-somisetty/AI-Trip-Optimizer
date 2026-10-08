"use client";

import { useSyncExternalStore } from "react";
import * as api from "./api";
import { cityByCode } from "./catalog";
import { addDays, formatInr, toIsoDate, uid } from "./format";
import { builtInDocs } from "./knowledge";
import { fromTraveler, fromTrip, toItinerary, toTraveler, toTrip, type TravelerInput, type TripInput } from "./mappers";
import { OptimizationError, editItinerary, optimize } from "./optimizer";
import { toast } from "./toast";
import type {
  AuditEvent,
  ChatMessage,
  KnowledgeDoc,
  Outcome,
  Policy,
  Session,
  Settings,
  Traveler,
  Trip,
  TripFilters,
} from "./types";

/**
 * Client-side workspace store. It mirrors the REST resources in docs/07_API_Specification.md
 * (travelers, trips, itineraries, decisions, audit, documents) and persists to localStorage,
 * so the whole product works end-to-end even when the FastAPI backend isn't running.
 * In API mode (session.mode === "api") travelers and trips are read from and saved to the backend.
 */

export type State = {
  version: number;
  hydrated: boolean;
  /** true while travelers and trips are loading from the API */
  syncing: boolean;
  session: Session | null;
  travelers: Traveler[];
  trips: Trip[];
  audit: AuditEvent[];
  docs: KnowledgeDoc[];
  chat: ChatMessage[];
  policy: Policy;
  settings: Settings;
  readNotificationsAt: string;
  tripSeq: number;
};

const KEY = "ato-workspace-v2";
const VERSION = 2;

export const defaultPolicy: Policy = {
  currency: "INR",
  managerApprovalFlightOver: 25000,
  maxNightlyRate: 8000,
  maxNightlyRateIntl: 18000,
  businessClassMinHours: 6,
  advanceBookingDays: 14,
  preferredAirlines: ["IndiGo", "Air India", "Vistara", "Emirates", "Singapore Airlines"],
};

export const defaultFilters: TripFilters = {
  cabin: "economy",
  maxStops: 1,
  departureWindow: "any",
  avoidRedEye: true,
  preferredAirlines: [],
  excludedAirlines: [],
  minHotelRating: 3.5,
  maxHotelDistanceKm: 8,
  maxNightlyRate: null,
  requiredAmenities: ["wifi"],
  priority: "balanced",
};

const empty: State = {
  version: VERSION,
  hydrated: false,
  syncing: false,
  session: null,
  travelers: [],
  trips: [],
  audit: [],
  docs: [],
  chat: [],
  policy: defaultPolicy,
  settings: { theme: "light", notifyDecisions: true, notifyPipeline: true, compactTables: false },
  readNotificationsAt: new Date(0).toISOString(),
  tripSeq: 0,
};

let state: State = empty;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, hydrated: undefined, syncing: undefined }));
  } catch {
    /* storage full or blocked — state still lives in memory */
  }
}

function set(updater: (s: State) => Partial<State>) {
  state = { ...state, ...updater(state) };
  persist();
  emit();
}

function hydrate() {
  if (state.hydrated || typeof window === "undefined") return;
  let loaded: State | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed.version === VERSION) loaded = parsed;
    }
  } catch {
    loaded = null;
  }
  state = { ...(loaded ?? seed()), hydrated: true, syncing: false };
  persist();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  hydrate();
  return state;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, () => empty);
}

export function getState() {
  hydrate();
  return state;
}

// ---------------------------------------------------------------- helpers

function actor() {
  return state.session?.name ?? "System";
}

function log(e: Omit<AuditEvent, "id" | "createdAt" | "actor"> & { actor?: string; createdAt?: string }): AuditEvent {
  return { id: uid("evt_"), actor: e.actor ?? actor(), createdAt: e.createdAt ?? new Date().toISOString(), ...e };
}

function patchTrip(id: string, patch: Partial<Trip>, events: AuditEvent[] = []) {
  set((s) => ({
    trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    audit: [...events, ...s.audit],
  }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isApi = () => state.session?.mode === "api";

/** Runs an authenticated API call; a 401 ends the session (AppGate then redirects to /login). */
async function remote<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = state.session?.token;
  if (!token) throw new api.ApiError(401, "You're signed out. Please log in again.");
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof api.ApiError && e.status === 401) {
      actions.logout();
      throw new api.ApiError(401, "Your session expired. Please log in again.");
    }
    throw e;
  }
}

const tripContext = () => ({ defaultFilters, createdBy: actor() });

/**
 * The backend status is the truth. Itineraries and decisions are only fetched when a trip's page
 * opens, so keep ones already loaded while the status hasn't changed (the Trips list shows their cost).
 */
function withLoadedDetails(trip: Trip, local: Trip | undefined): Trip {
  if (!local || local.status !== trip.status) return trip;
  const { itinerary, outcome, decidedAt, decisionReason } = local;
  return { ...trip, itinerary, outcome, decidedAt, decisionReason };
}

const decisionFields = (d: api.DecisionResponse) => ({ outcome: d.outcome, decidedAt: d.decided_at, decisionReason: d.reason });

/** After a 409 the local status is stale; re-read the trip so the page shows the backend's. */
async function refreshAfterConflict(id: string, e: unknown) {
  if (!(e instanceof api.ApiError) || e.status !== 409) return;
  try {
    const r = await remote((tok) => api.getTrip(tok, id));
    patchTrip(id, { status: r.status, failureReason: r.failure_reason ?? undefined });
  } catch {
    /* keep the local copy; the original error is what the user needs to see */
  }
}

const notOnServerYet = "This isn't available for trips saved on the server yet.";

let syncing: Promise<void> | null = null;

// ---------------------------------------------------------------- actions

export const actions = {
  login(session: Session) {
    set(() => ({ session }));
  },
  logout() {
    // Don't leave one account's travelers and trips behind for the next person on this browser.
    const wasApi = isApi();
    set(() => {
      if (!wasApi) return { session: null };
      const { travelers, trips } = seed();
      return { session: null, travelers, trips };
    });
  },
  updateProfile(patch: Partial<Session>) {
    set((s) => ({ session: s.session ? { ...s.session, ...patch } : s.session }));
  },

  /** Loads the signed-in user's travelers and trips from the API. No-op in demo mode. */
  syncFromApi() {
    if (!isApi()) return Promise.resolve();
    syncing ??= (async () => {
      const token = state.session?.token;
      set(() => ({ syncing: true }));
      try {
        const [travelers, trips] = await Promise.all([remote(api.listTravelers), remote((tok) => api.listTrips(tok))]);
        if (state.session?.token !== token) return; // signed out or switched accounts meanwhile
        set((s) => ({
          travelers: travelers.map(toTraveler),
          trips: trips.map((r) => {
            const trip = toTrip(r, tripContext());
            return withLoadedDetails(trip, s.trips.find((x) => x.id === trip.id));
          }),
        }));
      } catch (e) {
        toast("Couldn't load your data", { description: (e as Error).message, variant: "error" });
      } finally {
        syncing = null;
        set(() => ({ syncing: false }));
      }
    })();
    return syncing;
  },

  async addTraveler(t: TravelerInput) {
    const createdAt = new Date().toISOString();
    const traveler: Traveler = isApi()
      ? toTraveler(await remote((tok) => api.createTraveler(tok, fromTraveler(t, createdAt))))
      : { ...t, id: uid("trv_"), createdAt };
    set((s) => ({
      travelers: [traveler, ...s.travelers],
      audit: [log({ tripId: null, type: "TRAVELER_CREATED", summary: `Added traveler ${traveler.name}` }), ...s.audit],
    }));
    return traveler;
  },
  async updateTraveler(id: string, patch: Partial<Traveler>) {
    let saved: Traveler | undefined;
    if (isApi()) {
      const current = state.travelers.find((t) => t.id === id);
      if (!current) throw new Error("Traveler not found.");
      // PUT replaces the whole traveler, so send every field.
      const next = { ...current, ...patch };
      saved = toTraveler(await remote((tok) => api.updateTraveler(tok, id, fromTraveler(next, current.createdAt))));
    }
    set((s) => ({
      travelers: s.travelers.map((t) => (t.id === id ? (saved ?? { ...t, ...patch }) : t)),
      audit: [log({ tripId: null, type: "TRAVELER_UPDATED", summary: `Updated traveler ${patch.name ?? s.travelers.find((t) => t.id === id)?.name}` }), ...s.audit],
    }));
  },
  /** PRD US-001: a traveler with existing trips cannot be deleted (API returns 409). */
  async deleteTraveler(id: string) {
    const trips = state.trips.filter((t) => t.travelerIds.includes(id));
    // The API answers 409 with its own message when the traveler has trips.
    if (isApi()) await remote((tok) => api.deleteTraveler(tok, id));
    else if (trips.length) {
      throw new Error(`This traveler is on ${trips.length} trip${trips.length > 1 ? "s" : ""} (${trips.map((t) => t.code).slice(0, 3).join(", ")}${trips.length > 3 ? "…" : ""}) and can't be deleted.`);
    }
    const name = state.travelers.find((t) => t.id === id)?.name;
    set((s) => ({
      travelers: s.travelers.filter((t) => t.id !== id),
      audit: [log({ tripId: null, type: "TRAVELER_DELETED", summary: `Deleted traveler ${name}` }), ...s.audit],
    }));
  },

  async createTrip(input: TripInput) {
    const createdAt = new Date().toISOString();
    const seq = isApi() ? state.tripSeq : state.tripSeq + 1;
    const trip: Trip = isApi()
      ? toTrip(await remote((tok) => api.createTrip(tok, fromTrip(input, createdAt))), tripContext())
      : {
          ...input,
          id: uid("trip_"),
          code: `TRIP-${String(seq).padStart(4, "0")}`,
          status: "DRAFT",
          createdBy: actor(),
          createdAt,
        };
    set((s) => ({
      tripSeq: seq,
      trips: [trip, ...s.trips],
      audit: [
        log({
          tripId: trip.id,
          type: "TRIP_CREATED",
          summary: `Created ${trip.code}: ${trip.origin} → ${trip.destination}, budget ${formatInr(trip.budget)}`,
        }),
        ...s.audit,
      ],
    }));
    return trip;
  },
  updateTrip(id: string, patch: Partial<Trip>) {
    const t = state.trips.find((x) => x.id === id);
    if (!t) return;
    const reset = t.status === "OPTIMIZATION_FAILED" || t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW";
    patchTrip(id, { ...patch, ...(reset ? { status: "DRAFT", itinerary: undefined, failureReason: undefined } : {}) });
  },
  /** Decided trips are part of the audit record and can't be removed; audit events are never purged. */
  deleteTrip(id: string) {
    if (isApi()) throw new Error("Deleting trips isn't available on the server yet.");
    const t = state.trips.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "DECIDED") throw new Error("Decided trips are part of the audit record and can't be deleted.");
    set((s) => ({
      trips: s.trips.filter((x) => x.id !== id),
      audit: [log({ tripId: null, type: "TRIP_DELETED", summary: `Deleted ${t.code} (${t.title}) while ${t.status.toLowerCase().replace("_", " ")}` }), ...s.audit],
    }));
  },
  async duplicateTrip(id: string) {
    const t = state.trips.find((x) => x.id === id);
    if (!t) throw new Error("Trip not found.");
    return actions.createTrip({
      title: `${t.title} (copy)`,
      travelerIds: t.travelerIds,
      origin: t.origin,
      destination: t.destination,
      departDate: t.departDate,
      returnDate: t.returnDate,
      purpose: t.purpose,
      budget: t.budget,
      rooms: t.rooms,
      filters: t.filters,
      notes: t.notes,
    });
  },

  /** API mode: loads the saved itinerary (and decision) for one trip, when its page opens. */
  async loadTripDetails(id: string) {
    const trip = state.trips.find((t) => t.id === id);
    if (!isApi() || !trip) return;
    if (!["OPTIMIZED", "UNDER_REVIEW", "DECIDED", "OPTIMIZATION_FAILED"].includes(trip.status)) return;
    const [result, decision] = await Promise.all([
      remote((tok) => api.getItinerary(tok, id)),
      trip.status === "DECIDED" ? remote((tok) => api.getDecision(tok, id)) : null,
    ]);
    const fresh = state.trips.find((t) => t.id === id);
    if (!fresh) return;
    // runMs 0 marks a saved result rather than a run timed in this browser.
    patchTrip(id, { status: result.status, itinerary: toItinerary(result, fresh, 0), failureReason: result.reason ?? undefined, ...(decision ? decisionFields(decision) : {}) });
  },

  async runOptimization(id: string) {
    const trip = state.trips.find((t) => t.id === id);
    if (!trip) return;
    if (isApi()) {
      const previous = trip.status;
      patchTrip(id, { status: "OPTIMIZING", failureReason: undefined });
      const started = performance.now();
      let result: api.TripResult;
      try {
        result = await remote((tok) => api.optimizeTrip(tok, id));
      } catch (e) {
        patchTrip(id, { status: previous });
        await refreshAfterConflict(id, e);
        throw e;
      }
      const fresh = state.trips.find((t) => t.id === id);
      if (!fresh) return;
      const itinerary = toItinerary(result, fresh, Math.round(performance.now() - started));
      if (result.status === "OPTIMIZED" && itinerary) {
        patchTrip(id, { status: "OPTIMIZED", itinerary, failureReason: undefined }, [
          log({
            tripId: id,
            type: "PIPELINE_RUN",
            summary: `Optimizer composed itinerary: ${formatInr(itinerary.totalCost)} (${itinerary.ledger.length} options evaluated, ${itinerary.issues.length} flags)`,
            payload: { totalCost: itinerary.totalCost, runMs: itinerary.runMs, issues: itinerary.issues.length },
          }),
        ]);
      } else {
        const reason = result.reason ?? "The optimizer couldn't build an itinerary.";
        patchTrip(id, { status: result.status, failureReason: reason, itinerary: undefined }, [
          log({ tripId: id, type: "PIPELINE_FAILED", summary: `Optimization failed: ${reason}` }),
        ]);
      }
      return;
    }
    patchTrip(id, { status: "OPTIMIZING", failureReason: undefined });
    await sleep(2600);
    const fresh = state.trips.find((t) => t.id === id);
    if (!fresh) return;
    try {
      const itinerary = optimize(fresh, state.policy);
      patchTrip(id, { status: "OPTIMIZED", itinerary }, [
        log({
          tripId: id,
          type: "PIPELINE_RUN",
          summary: `Optimizer composed itinerary: ${formatInr(itinerary.totalCost)} (${itinerary.ledger.length} options evaluated, ${itinerary.issues.length} flags)`,
          payload: { totalCost: itinerary.totalCost, savings: itinerary.savings, runMs: itinerary.runMs, issues: itinerary.issues.length },
        }),
      ]);
    } catch (e) {
      const reason = e instanceof OptimizationError ? e.message : "Unexpected pipeline error.";
      patchTrip(id, { status: "OPTIMIZATION_FAILED", failureReason: reason, itinerary: undefined }, [
        log({ tripId: id, type: "PIPELINE_FAILED", summary: `Optimization failed: ${reason}` }),
      ]);
    }
  },
  async startReview(id: string) {
    let status: Trip["status"] = "UNDER_REVIEW";
    if (isApi()) {
      try {
        status = (await remote((tok) => api.startReview(tok, id))).status;
      } catch (e) {
        await refreshAfterConflict(id, e);
        throw e;
      }
    }
    patchTrip(id, { status }, [log({ tripId: id, type: "REVIEW_STARTED", summary: "Itinerary moved to review" })]);
  },
  editLineItem(id: string, kind: "outbound" | "return" | "stay", optionId: string) {
    if (isApi()) throw new Error(notOnServerYet);
    const trip = state.trips.find((t) => t.id === id);
    if (!trip?.itinerary) return;
    const before = trip.itinerary.totalCost;
    const itinerary = editItinerary(trip, state.policy, kind, optionId);
    const label = itinerary.ledger.find((l) => l.kind === kind && l.won)?.label;
    patchTrip(id, { itinerary, status: "UNDER_REVIEW" }, [
      log({
        tripId: id,
        type: "ITINERARY_EDITED",
        summary: `Swapped ${kind === "stay" ? "hotel" : `${kind} flight`} to ${label}; total ${formatInr(before)} → ${formatInr(itinerary.totalCost)}`,
        payload: { kind, optionId, before, after: itinerary.totalCost },
      }),
    ]);
  },
  /** PRD US-007: approve → DECIDED; reject requires a stored reason (the API answers 400 without one). */
  async decide(id: string, outcome: Outcome, reason: string) {
    let fields: Partial<Trip> = { outcome, decidedAt: new Date().toISOString(), decisionReason: reason.trim() || null };
    if (isApi()) {
      try {
        fields = decisionFields(await remote((tok) => api.decideTrip(tok, id, outcome, reason.trim())));
      } catch (e) {
        await refreshAfterConflict(id, e);
        throw e;
      }
    } else if (outcome === "REJECTED" && !reason.trim()) {
      throw new Error("A reason is required to reject an itinerary.");
    }
    patchTrip(id, { status: "DECIDED", ...fields }, [
      log({
        tripId: id,
        type: "DECISION",
        summary: `${outcome === "APPROVED" ? "Approved" : "Rejected"} itinerary${fields.decisionReason ? ` — "${fields.decisionReason}"` : ""}`,
        payload: { outcome, reason: fields.decisionReason ?? null },
      }),
    ]);
  },
  applyPreview(id: string, patch: Partial<Trip>) {
    if (isApi()) throw new Error(notOnServerYet);
    const trip = state.trips.find((t) => t.id === id);
    if (!trip) return;
    const next = { ...trip, ...patch };
    const itinerary = optimize(next, state.policy);
    patchTrip(id, { ...patch, itinerary, status: "UNDER_REVIEW" }, [
      log({
        tripId: id,
        type: "PIPELINE_RUN",
        summary: `What-if preview saved: budget ${formatInr(next.budget)}, priority ${next.filters.priority}; total now ${formatInr(itinerary.totalCost)}`,
        payload: { totalCost: itinerary.totalCost, whatIf: true },
      }),
    ]);
  },

  addDoc(doc: Pick<KnowledgeDoc, "title" | "category" | "content">) {
    const d: KnowledgeDoc = {
      ...doc,
      id: uid("doc_"),
      sizeBytes: new Blob([doc.content]).size,
      uploadedBy: actor(),
      uploadedAt: new Date().toISOString(),
      builtIn: false,
    };
    set((s) => ({ docs: [d, ...s.docs], audit: [log({ tripId: null, type: "DOCUMENT_UPLOAD", summary: `Uploaded "${d.title}"` }), ...s.audit] }));
    return d;
  },
  deleteDoc(id: string) {
    const d = state.docs.find((x) => x.id === id);
    set((s) => ({ docs: s.docs.filter((x) => x.id !== id), audit: [log({ tripId: null, type: "DOCUMENT_DELETED", summary: `Removed "${d?.title}"` }), ...s.audit] }));
  },

  addMessages(...msgs: ChatMessage[]) {
    set((s) => ({ chat: [...s.chat, ...msgs] }));
  },
  logQuery(question: string, mode: string, tripId?: string) {
    set((s) => ({ audit: [log({ tripId: tripId ?? null, type: "ASSISTANT_QUERY", summary: `Asked (${mode}): "${question.slice(0, 80)}"` }), ...s.audit] }));
  },
  clearChat(mode: "knowledge" | "itinerary", tripId?: string) {
    set((s) => ({ chat: s.chat.filter((m) => !(m.mode === mode && (mode === "knowledge" || m.tripId === tripId))) }));
  },

  updatePolicy(p: Policy) {
    set((s) => ({ policy: p, audit: [log({ tripId: null, type: "POLICY_UPDATED", summary: "Updated travel policy rules" }), ...s.audit] }));
  },
  updateSettings(p: Partial<Settings>) {
    set((s) => ({ settings: { ...s.settings, ...p } }));
  },
  markNotificationsRead() {
    set(() => ({ readNotificationsAt: new Date().toISOString() }));
  },
  resetWorkspace() {
    const session = state.session;
    state = { ...seed(), session, hydrated: true };
    persist();
    emit();
  },
};

// ---------------------------------------------------------------- seed data

function seed(): State {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const travelers: Traveler[] = [
    { name: "Aarav Mehta", email: "aarav.mehta@acmecorp.in", department: "Sales", homeCity: "BLR", preferences: { seat: "Aisle", dietary: "Vegetarian", tags: ["frequent-flyer", "client-facing"], preferredAirlines: ["Vistara"] } },
    { name: "Priya Nair", email: "priya.nair@acmecorp.in", department: "Engineering", homeCity: "BLR", preferences: { seat: "Window", dietary: "None", tags: ["conference-speaker"], preferredAirlines: [] } },
    { name: "Rohan Kapoor", email: "rohan.kapoor@acmecorp.in", department: "Leadership", homeCity: "DEL", preferences: { seat: "Aisle", dietary: "Jain", notes: "Needs lounge access on long-haul", tags: ["executive"], preferredAirlines: ["Emirates", "Air India"] } },
    { name: "Ananya Iyer", email: "ananya.iyer@acmecorp.in", department: "Marketing", homeCity: "BOM", preferences: { seat: "Window", dietary: "Vegan", tags: ["events"], preferredAirlines: ["IndiGo"] } },
    { name: "Kabir Singh", email: "kabir.singh@acmecorp.in", department: "Operations", homeCity: "HYD", preferences: { seat: "No preference", dietary: "None", tags: ["site-visits"], preferredAirlines: [] } },
    { name: "Meera Das", email: "meera.das@acmecorp.in", department: "Finance", homeCity: "BBI", preferences: { seat: "Aisle", dietary: "None", tags: ["audit"], preferredAirlines: ["Air India"] } },
  ].map((t, i) => ({ ...t, preferences: { notes: undefined, ...t.preferences }, id: `trv_seed${i}`, createdAt: iso(addDays(now, -150 + i * 4)) }));

  type SeedTrip = {
    title: string;
    who: number[];
    o: string;
    d: string;
    start: number;
    len: number | null;
    budget: number;
    created: number;
    purpose: string;
    status: "DRAFT" | "OPTIMIZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";
    turnaroundH?: number;
    reason?: string;
    f?: Partial<TripFilters>;
  };
  const plan: SeedTrip[] = [
    { title: "Q3 client pitch — Reliance", who: [0], o: "BLR", d: "BOM", start: -104, len: 2, budget: 38000, created: -121, purpose: "Client meeting", status: "APPROVED", turnaroundH: 5 },
    { title: "AWS Summit Singapore", who: [1], o: "BLR", d: "SIN", start: -92, len: 4, budget: 145000, created: -118, purpose: "Conference", status: "APPROVED", turnaroundH: 20 },
    { title: "Board offsite prep", who: [2], o: "DEL", d: "DXB", start: -80, len: 3, budget: 70000, created: -99, purpose: "Leadership offsite", status: "REJECTED", turnaroundH: 30, reason: "Offsite moved online — trip no longer required." },
    { title: "Campaign shoot — Goa", who: [3, 4], o: "BOM", d: "GOI", start: -70, len: 3, budget: 62000, created: -88, purpose: "Marketing event", status: "APPROVED", turnaroundH: 9 },
    { title: "Plant audit Hyderabad", who: [5], o: "BBI", d: "HYD", start: -55, len: 2, budget: 30000, created: -73, purpose: "Audit", status: "APPROVED", turnaroundH: 3 },
    { title: "Partner summit London", who: [2], o: "DEL", d: "LHR", start: -40, len: 5, budget: 320000, created: -66, purpose: "Partnership", status: "APPROVED", turnaroundH: 26, f: { cabin: "business", priority: "comfort" } },
    { title: "Hiring drive Chennai", who: [1, 4], o: "BLR", d: "MAA", start: -28, len: 1, budget: 26000, created: -44, purpose: "Recruitment", status: "APPROVED", turnaroundH: 4 },
    { title: "Tokyo distributor visit", who: [0], o: "BLR", d: "NRT", start: -15, len: 4, budget: 150000, created: -36, purpose: "Client meeting", status: "REJECTED", turnaroundH: 18, reason: "Budget exceeds Q3 allocation; revisit in Q4." },
    { title: "Mumbai investor day", who: [2, 5], o: "DEL", d: "BOM", start: 9, len: 2, budget: 72000, created: -8, purpose: "Investor relations", status: "UNDER_REVIEW" },
    { title: "GITEX Dubai booth", who: [3], o: "BOM", d: "DXB", start: 21, len: 4, budget: 95000, created: -5, purpose: "Conference", status: "OPTIMIZED" },
    { title: "Frankfurt supplier QBR", who: [4], o: "HYD", d: "FRA", start: 34, len: 3, budget: 140000, created: -3, purpose: "Vendor review", status: "APPROVED", turnaroundH: 11 },
    { title: "Kolkata regional kickoff", who: [5, 0], o: "BBI", d: "CCU", start: 17, len: 2, budget: 40000, created: -2, purpose: "Internal", status: "FAILED", f: { maxStops: 0, departureWindow: "early_morning", minHotelRating: 4.9 } },
    { title: "SF product conference", who: [1], o: "BLR", d: "SFO", start: 48, len: 5, budget: 260000, created: -1, purpose: "Conference", status: "DRAFT" },
    { title: "Pune customer onsite", who: [4], o: "HYD", d: "PNQ", start: 12, len: 2, budget: 28000, created: 0, purpose: "Client meeting", status: "DRAFT" },
  ];

  const trips: Trip[] = [];
  const audit: AuditEvent[] = [];
  plan.forEach((p, i) => {
    const created = addDays(now, p.created);
    created.setHours(9 + (i % 6), (i * 17) % 60);
    const depart = addDays(now, p.start);
    const trip: Trip = {
      id: `trip_seed${i}`,
      code: `TRIP-${String(i + 1).padStart(4, "0")}`,
      title: p.title,
      travelerIds: p.who.map((w) => travelers[w].id),
      origin: p.o,
      destination: p.d,
      departDate: toIsoDate(depart),
      returnDate: p.len ? toIsoDate(addDays(depart, p.len)) : null,
      purpose: p.purpose,
      budget: p.budget,
      rooms: p.who.length,
      filters: { ...defaultFilters, ...p.f },
      notes: "",
      status: "DRAFT",
      createdBy: i % 3 === 0 ? "Swetalin Rout" : "Bhuvan Somisetty",
      createdAt: iso(created),
    };
    const who = trip.createdBy;
    audit.push(log({ tripId: trip.id, type: "TRIP_CREATED", actor: who, createdAt: iso(created), summary: `Created ${trip.code}: ${trip.origin} → ${trip.destination}, budget ${formatInr(trip.budget)}` }));

    if (p.status !== "DRAFT") {
      const ran = new Date(created.getTime() + 20 * 60000);
      try {
        const it = optimize(trip, defaultPolicy);
        it.generatedAt = iso(ran);
        trip.itinerary = it;
        trip.status = "OPTIMIZED";
        audit.push(log({ tripId: trip.id, type: "PIPELINE_RUN", actor: who, createdAt: iso(ran), summary: `Optimizer composed itinerary: ${formatInr(it.totalCost)} (${it.ledger.length} options evaluated, ${it.issues.length} flags)`, payload: { totalCost: it.totalCost, savings: it.savings, runMs: it.runMs } }));
      } catch (e) {
        trip.status = "OPTIMIZATION_FAILED";
        trip.failureReason = (e as Error).message;
        audit.push(log({ tripId: trip.id, type: "PIPELINE_FAILED", actor: who, createdAt: iso(ran), summary: `Optimization failed: ${trip.failureReason}` }));
      }
    }
    if (p.status === "UNDER_REVIEW" && trip.itinerary) {
      trip.status = "UNDER_REVIEW";
      audit.push(log({ tripId: trip.id, type: "REVIEW_STARTED", actor: "Bhuvan Somisetty", createdAt: iso(new Date(created.getTime() + 3 * 3600000)), summary: "Itinerary moved to review" }));
    }
    if ((p.status === "APPROVED" || p.status === "REJECTED") && trip.itinerary) {
      const decided = new Date(created.getTime() + (p.turnaroundH ?? 6) * 3600000);
      trip.status = "DECIDED";
      trip.outcome = p.status;
      trip.decidedAt = iso(decided);
      audit.push(log({ tripId: trip.id, type: "DECISION", actor: "Bhuvan Somisetty", createdAt: iso(decided), summary: `${p.status === "APPROVED" ? "Approved" : "Rejected"} itinerary${p.reason ? ` — "${p.reason}"` : ""}`, payload: { outcome: p.status, reason: p.reason ?? null } }));
    }
    trips.push(trip);
  });

  const docs: KnowledgeDoc[] = builtInDocs.map((d, i) => ({
    ...d,
    sizeBytes: new Blob([d.content]).size,
    uploadedBy: "Swetalin Rout",
    uploadedAt: iso(addDays(now, -160 + i)),
  }));
  for (const d of docs) audit.push(log({ tripId: null, type: "DOCUMENT_UPLOAD", actor: d.uploadedBy, createdAt: d.uploadedAt, summary: `Uploaded "${d.title}"` }));

  audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    ...empty,
    travelers: travelers.reverse(),
    trips: trips.reverse(),
    audit,
    docs,
    tripSeq: plan.length,
    readNotificationsAt: iso(addDays(now, -4)),
  };
}

export function travelerNames(trip: Trip, travelers: Traveler[]) {
  return trip.travelerIds.map((id) => travelers.find((t) => t.id === id)?.name ?? "Unknown");
}

export function routeLabel(trip: Trip) {
  return `${cityByCode[trip.origin]?.name ?? trip.origin} → ${cityByCode[trip.destination]?.name ?? trip.destination}`;
}

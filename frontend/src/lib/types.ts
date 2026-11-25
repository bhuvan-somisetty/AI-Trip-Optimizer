export type TripStatus =
  | "DRAFT"
  | "OPTIMIZING"
  | "OPTIMIZED"
  | "UNDER_REVIEW"
  | "DECIDED"
  | "OPTIMIZATION_FAILED";

export type Outcome = "APPROVED" | "REJECTED";

export type CabinClass = "economy" | "premium_economy" | "business";
export type Priority = "cheapest" | "balanced" | "comfort" | "fastest";
export type TimeWindow = "any" | "early_morning" | "morning" | "afternoon" | "evening" | "night";

export type Traveler = {
  id: string;
  name: string;
  email: string;
  department: string;
  homeCity: string;
  preferences: {
    seat?: string;
    dietary?: string;
    notes?: string;
    tags: string[];
    preferredAirlines: string[];
  };
  createdAt: string;
};

/** How the traveller is willing to go; the optimizer prices flights, the results page compares all three. */
export type TransportMode = "flight" | "train" | "bus";

export type TripFilters = {
  /** Missing on trips saved before transport modes existed: treat that as all three. */
  modes?: TransportMode[];
  /** Longest acceptable journey in hours; null or missing = no limit. */
  maxDurationHours?: number | null;
  cabin: CabinClass;
  maxStops: 0 | 1 | 2;
  /** Also search this many days either side of each flight date for cheaper fares (0 = off). */
  flexibleDays: 0 | 1 | 2;
  departureWindow: TimeWindow;
  avoidRedEye: boolean;
  preferredAirlines: string[];
  excludedAirlines: string[];
  minHotelRating: number;
  maxHotelDistanceKm: number;
  maxNightlyRate: number | null;
  requiredAmenities: string[];
  priority: Priority;
};

export type Trip = {
  id: string;
  code: string;
  title: string;
  travelerIds: string[];
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  purpose: string;
  budget: number;
  rooms: number;
  filters: TripFilters;
  notes: string;
  status: TripStatus;
  outcome?: Outcome;
  failureReason?: string;
  /** reason stored with the decision (required for rejections) */
  decisionReason?: string;
  itinerary?: Itinerary;
  createdBy: string;
  createdAt: string;
  decidedAt?: string;
};

/**
 * Fields marked optional are ones the live providers don't send (backend/app/travel_data.py).
 * They stay undefined rather than being guessed, and the UI hides them.
 */
export type Flight = {
  id: string;
  origin: string;
  destination: string;
  airline: string;
  flightNo: string;
  departure: string;
  arrival?: string;
  durationMin?: number;
  price: number;
  cabin: CabinClass;
  stops: number;
  via?: string;
  /** Where each connection waits, as Google Flights lists it; empty for non-stop flights. */
  layovers?: Layover[];
  /** Google Flights' view of fares on this date for the route; undefined when Google gave none. */
  priceLevel?: "low" | "typical" | "high";
  /** Google Flights' typical fare range for the route, [low, high]. */
  typicalPriceRange?: [number, number];
  /** not in the backend's flight data, so undefined for server-optimized itineraries */
  refundable?: boolean;
  baggageKg?: number;
  /** "cached": a real fare found in the last 48 hours, not re-checked; "live": quoted now */
  priceStatus?: "cached" | "live";
  bookingLink?: string;
  source?: string;
  /** a trip by train or bus books one in place of the flight; undefined for a flight */
  mode?: "train" | "bus";
  /** false when the train or bus publishes no fare: `price` is then 0 and not a price */
  priceKnown?: boolean;
  bookingLabel?: string;
  /** Indian trains: official fare per class, what it is for, or why there is none */
  classFares?: Record<string, number>;
  /** the class `price` is for, e.g. "SL" */
  fareClass?: string;
  classFaresLabel?: string;
  classFaresNote?: string;
  /** stations, for a train or bus */
  fromStation?: string;
  toStation?: string;
};

export type Layover = {
  airport: string;
  airportName?: string;
  minutes?: number;
  overnight: boolean;
};

export type HotelImage = { thumbnail?: string; original?: string };

export type Hotel = {
  id: string;
  city: string;
  name: string;
  area?: string;
  pricePerNight: number;
  rating?: number;
  stars?: number;
  amenities: string[];
  distanceKm?: number;
  freeCancellation?: boolean;
  /** Google Hotels' photos of the hotel, up to 5. */
  images?: HotelImage[];
  latitude?: number;
  longitude?: number;
  priceStatus?: "cached" | "live";
  source?: string;
};

export type ReasonCode = "WINNER" | "PRICE" | "BUDGET" | "CONSTRAINT" | "PREFERENCE";

export type LedgerEntry = {
  id: string;
  kind: "outbound" | "return" | "stay";
  optionId: string;
  label: string;
  detail: string;
  price: number;
  /** false for a train or bus whose fare isn't published: `price` is then 0 and not shown */
  priceKnown?: boolean;
  /** 0-100 weighted score from the browser optimizer; the backend picks by price and has none */
  score?: number;
  won: boolean;
  /** false when a hard filter or policy rule screened this option out */
  feasible: boolean;
  reasonCode: ReasonCode;
  reason: string;
};

export type ConstraintIssue = {
  id: string;
  rule: string;
  lineItem: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export type Itinerary = {
  outbound: Flight;
  return: Flight | null;
  stay: Hotel | null;
  nights: number;
  rooms: number;
  travelers: number;
  flightCost: number;
  stayCost: number;
  totalCost: number;
  /** What savings are measured against; 0 when there is no figure (server itineraries saved before savings existed). */
  baselineCost: number;
  savings: number;
  /**
   * "market": the demo optimizer's typical market cost for the route and stay.
   * "valid-options": the median price of the server's options that met every rule (docs/14_Evaluation_Metrics.md).
   */
  savingsBasis?: "market" | "valid-options";
  ledger: LedgerEntry[];
  issues: ConstraintIssue[];
  rationale: string;
  generatedAt: string;
  runMs: number;
  edited: boolean;
  /** true for server itineraries saved before edits existed; optimize again to edit them */
  locked?: boolean;
};

export type AuditEvent = {
  id: string;
  tripId: string | null;
  type:
    | "TRIP_CREATED"
    | "TRIP_UPDATED"
    | "TRIP_DELETED"
    | "PIPELINE_RUN"
    | "PIPELINE_FAILED"
    | "ITINERARY_EDITED"
    | "REVIEW_STARTED"
    | "DECISION"
    | "DOCUMENT_UPLOAD"
    | "DOCUMENT_DELETED"
    | "TRAVELER_CREATED"
    | "TRAVELER_UPDATED"
    | "TRAVELER_DELETED"
    | "ASSISTANT_QUERY"
    | "POLICY_UPDATED";
  /** Email of who did it. */
  actor: string;
  /** Their display name when they have set one; show it in place of the email. */
  actorName?: string;
  summary: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type Policy = {
  currency: "INR";
  managerApprovalFlightOver: number;
  maxNightlyRate: number;
  maxNightlyRateIntl: number;
  businessClassMinHours: number;
  advanceBookingDays: number;
  preferredAirlines: string[];
  /** Set by the API: when the policy last changed and the email of who changed it. */
  updatedAt?: string;
  updatedBy?: string;
};

export type Session = {
  name: string;
  email: string;
  role: "member" | "admin";
  mode: "api" | "demo";
  token?: string;
};

export type Settings = {
  notifyDecisions: boolean;
  notifyPipeline: boolean;
  compactTables: boolean;
};

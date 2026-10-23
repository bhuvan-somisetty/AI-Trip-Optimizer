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

export type TripFilters = {
  cabin: CabinClass;
  maxStops: 0 | 1 | 2;
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
  refundable?: boolean;
  baggageKg?: number;
  /** "cached": a real fare found in the last 48 hours, not re-checked; "live": quoted now */
  priceStatus?: "cached" | "live";
  bookingLink?: string;
  source?: string;
};

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
  /** Demo optimizer only; the backend picks the cheapest option that passes every rule. */
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
  /** Only the local demo optimizer has a market baseline to compare against. */
  baselineCost?: number;
  savings?: number;
  /** Set when the backend built this from real provider data. */
  live?: { flags: string[]; withinBudget: boolean };
  ledger: LedgerEntry[];
  issues: ConstraintIssue[];
  rationale: string;
  generatedAt: string;
  runMs: number;
  edited: boolean;
};

export type AuditEvent = {
  id: string;
  tripId: string | null;
  type:
    | "TRIP_CREATED"
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
  actor: string;
  summary: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  content: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  builtIn: boolean;
};

export type Citation = { docId: string; docTitle: string; chunk: number; excerpt: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: "knowledge" | "itinerary";
  tripId?: string;
  citations?: Citation[];
  covered?: boolean;
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
};

export type Session = {
  name: string;
  email: string;
  role: "member" | "admin";
  mode: "api" | "demo";
  token?: string;
};

export type Settings = {
  theme: "light" | "dark" | "system";
  notifyDecisions: boolean;
  notifyPipeline: boolean;
  compactTables: boolean;
};

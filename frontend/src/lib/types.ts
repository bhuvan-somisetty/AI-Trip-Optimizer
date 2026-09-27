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

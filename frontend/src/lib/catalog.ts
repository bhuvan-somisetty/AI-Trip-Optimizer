import type { CabinClass, Flight, Hotel } from "./types";

/**
 * Mock supplier catalog. There is no live GDS access (see docs/09_Mock_Data_Spec.md),
 * so flights and hotels are generated deterministically from the route + date:
 * the same search always returns the same options, which keeps the Trade-off
 * Ledger reproducible and auditable.
 */

export type City = {
  code: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  international: boolean;
  hotelIndex: number;
};

export const cities: City[] = [
  { code: "BLR", name: "Bengaluru", country: "India", lat: 12.97, lon: 77.59, international: false, hotelIndex: 1 },
  { code: "DEL", name: "New Delhi", country: "India", lat: 28.61, lon: 77.21, international: false, hotelIndex: 1.15 },
  { code: "BOM", name: "Mumbai", country: "India", lat: 19.08, lon: 72.88, international: false, hotelIndex: 1.3 },
  { code: "MAA", name: "Chennai", country: "India", lat: 13.08, lon: 80.27, international: false, hotelIndex: 0.9 },
  { code: "HYD", name: "Hyderabad", country: "India", lat: 17.39, lon: 78.49, international: false, hotelIndex: 0.92 },
  { code: "CCU", name: "Kolkata", country: "India", lat: 22.57, lon: 88.36, international: false, hotelIndex: 0.85 },
  { code: "PNQ", name: "Pune", country: "India", lat: 18.52, lon: 73.86, international: false, hotelIndex: 0.88 },
  { code: "GOI", name: "Goa", country: "India", lat: 15.49, lon: 73.83, international: false, hotelIndex: 1.1 },
  { code: "BBI", name: "Bhubaneswar", country: "India", lat: 20.3, lon: 85.82, international: false, hotelIndex: 0.75 },
  { code: "DXB", name: "Dubai", country: "UAE", lat: 25.2, lon: 55.27, international: true, hotelIndex: 2.1 },
  { code: "SIN", name: "Singapore", country: "Singapore", lat: 1.35, lon: 103.82, international: true, hotelIndex: 2.6 },
  { code: "LHR", name: "London", country: "United Kingdom", lat: 51.47, lon: -0.45, international: true, hotelIndex: 3.4 },
  { code: "JFK", name: "New York", country: "United States", lat: 40.64, lon: -73.78, international: true, hotelIndex: 3.8 },
  { code: "NRT", name: "Tokyo", country: "Japan", lat: 35.77, lon: 140.39, international: true, hotelIndex: 2.9 },
  { code: "CDG", name: "Paris", country: "France", lat: 49.01, lon: 2.55, international: true, hotelIndex: 3.1 },
  { code: "BKK", name: "Bangkok", country: "Thailand", lat: 13.69, lon: 100.75, international: true, hotelIndex: 1.4 },
  { code: "FRA", name: "Frankfurt", country: "Germany", lat: 50.04, lon: 8.56, international: true, hotelIndex: 2.7 },
  { code: "SFO", name: "San Francisco", country: "United States", lat: 37.62, lon: -122.38, international: true, hotelIndex: 3.9 },
];

export const cityByCode = Object.fromEntries(cities.map((c) => [c.code, c])) as Record<string, City>;

export function cityLabel(code: string) {
  const c = cityByCode[code];
  return c ? `${c.name} (${c.code})` : code;
}

export const airlines = [
  "IndiGo",
  "Air India",
  "Vistara",
  "Akasa Air",
  "SpiceJet",
  "Emirates",
  "Singapore Airlines",
  "Lufthansa",
  "British Airways",
  "Qatar Airways",
];

const domesticAirlines = ["IndiGo", "Air India", "Vistara", "Akasa Air", "SpiceJet"];
const intlAirlines = ["Air India", "Vistara", "Emirates", "Singapore Airlines", "Lufthansa", "British Airways", "Qatar Airways"];
const airlineCode: Record<string, string> = {
  IndiGo: "6E",
  "Air India": "AI",
  Vistara: "UK",
  "Akasa Air": "QP",
  SpiceJet: "SG",
  Emirates: "EK",
  "Singapore Airlines": "SQ",
  Lufthansa: "LH",
  "British Airways": "BA",
  "Qatar Airways": "QR",
};
const hubs = ["DXB", "DOH", "FRA", "SIN", "BOM", "DEL"];

export const amenityOptions = [
  { id: "wifi", label: "Free Wi-Fi" },
  { id: "breakfast", label: "Breakfast included" },
  { id: "gym", label: "Gym" },
  { id: "pool", label: "Pool" },
  { id: "airport_shuttle", label: "Airport shuttle" },
  { id: "meeting_rooms", label: "Meeting rooms" },
  { id: "spa", label: "Spa" },
  { id: "parking", label: "Parking" },
];

export const amenityLabel = Object.fromEntries(amenityOptions.map((a) => [a.id, a.label])) as Record<string, string>;

export const cabinLabel: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
};

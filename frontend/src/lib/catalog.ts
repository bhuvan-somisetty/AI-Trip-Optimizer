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

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distanceKm(a: string, b: string) {
  const A = cityByCode[a];
  const B = cityByCode[b];
  if (!A || !B) return 1500;
  const R = 6371;
  const dLat = ((B.lat - A.lat) * Math.PI) / 180;
  const dLon = ((B.lon - A.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((A.lat * Math.PI) / 180) * Math.cos((B.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

const cabinMultiplier: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.65,
  business: 3.4,
};

// Departure hours chosen so every route has a red-eye, early, daytime and evening option.
const slots = [0.75, 5.5, 6.25, 8.5, 10.75, 13.25, 16, 18.5, 20.75, 23.25];

export function searchFlights(origin: string, destination: string, date: string, cabin: CabinClass): Flight[] {
  const rand = rng(`${origin}-${destination}-${date}-${cabin}`);
  const dist = distanceKm(origin, destination);
  const intl = cityByCode[origin]?.international || cityByCode[destination]?.international;
  const pool = intl ? intlAirlines : domesticAirlines;
  const count = 6 + Math.floor(rand() * 3);
  const chosenSlots = [...slots].sort(() => rand() - 0.5).slice(0, count).sort((a, b) => a - b);

  return chosenSlots.map((slot, i) => {
    const airline = pool[Math.floor(rand() * pool.length)];
    const stopsRoll = rand();
    const stops = dist < 900 ? 0 : intl ? (stopsRoll < 0.45 ? 0 : stopsRoll < 0.9 ? 1 : 2) : stopsRoll < 0.72 ? 0 : 1;
    const cruise = (dist / 780) * 60 + 35;
    const durationMin = Math.round(cruise + stops * (75 + rand() * 110));
    const base = intl ? 5200 + dist * 4.4 : 2100 + dist * 3.6;
    const redEye = slot < 5 || slot > 22.5;
    const peak = slot >= 6 && slot <= 9.5;
    let price = base * cabinMultiplier[cabin] * (0.78 + rand() * 0.55);
    if (redEye) price *= 0.82;
    if (peak) price *= 1.12;
    if (stops > 0) price *= 0.86 - (stops - 1) * 0.05;
    if (airline === "Emirates" || airline === "Singapore Airlines" || airline === "Vistara") price *= 1.1;

    const dep = new Date(`${date}T00:00:00`);
    dep.setMinutes(Math.round(slot * 60));
    const arr = new Date(dep.getTime() + durationMin * 60000);
    return {
      id: `FL-${hash(`${origin}${destination}${date}${cabin}${i}`) % 90000 + 10000}`,
      origin,
      destination,
      airline,
      flightNo: `${airlineCode[airline]} ${100 + Math.floor(rand() * 899)}`,
      departure: toLocalIso(dep),
      arrival: toLocalIso(arr),
      durationMin,
      price: Math.round(price / 10) * 10,
      cabin,
      stops,
      via: stops > 0 ? hubs.filter((h) => h !== origin && h !== destination)[Math.floor(rand() * 4)] : undefined,
      refundable: rand() > 0.55,
      baggageKg: cabin === "business" ? 40 : intl ? 30 : 15,
    };
  });
}

const hotelBrands = [
  ["Taj", "The Leela", "ITC", "Oberoi", "JW Marriott"],
  ["Novotel", "Hyatt Place", "Courtyard", "Radisson Blu", "Holiday Inn"],
  ["Lemon Tree", "ibis", "Ginger", "Treebo", "FabHotel"],
];
const areas = ["Central Business District", "Airport Zone", "Old Town", "Tech Park", "Riverside", "Convention Quarter"];

export function searchHotels(city: string): Hotel[] {
  const rand = rng(`hotels-${city}`);
  const c = cityByCode[city];
  const index = c?.hotelIndex ?? 1;
  const name = c?.name ?? city;
  const hotels: Hotel[] = [];
  hotelBrands.forEach((tier, t) => {
    const perTier = 2;
    const picks = [...tier].sort(() => rand() - 0.5).slice(0, perTier);
    picks.forEach((brand, i) => {
      const stars = 5 - t;
      const base = [9500, 5200, 2600][t];
      const amenities = ["wifi"];
      if (t < 2 || rand() > 0.5) amenities.push("breakfast");
      if (t === 0 || rand() > 0.6) amenities.push("gym");
      if (t === 0 || rand() > 0.75) amenities.push("pool");
      if (rand() > 0.5) amenities.push("airport_shuttle");
      if (t < 2 && rand() > 0.35) amenities.push("meeting_rooms");
      if (t === 0 && rand() > 0.4) amenities.push("spa");
      if (rand() > 0.45) amenities.push("parking");
      hotels.push({
        id: `HT-${hash(`${city}${brand}${i}`) % 9000 + 1000}`,
        city,
        name: `${brand} ${name}${i === 1 && t === 1 ? " Airport" : ""}`,
        area: areas[Math.floor(rand() * areas.length)],
        pricePerNight: Math.round((base * index * (0.82 + rand() * 0.4)) / 50) * 50,
        rating: Math.round((4.8 - t * 0.45 - rand() * 0.5) * 10) / 10,
        stars,
        amenities,
        distanceKm: Math.round((0.4 + rand() * (t === 2 ? 9 : 6)) * 10) / 10,
        freeCancellation: rand() > 0.4,
      });
    });
  });
  return hotels;
}

function toLocalIso(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/**
 * Small map helpers shared by the destination page, Explore and the day-by-day plan.
 * Nothing here calls an API: directions open OpenStreetMap's own routing page in a new tab.
 */

export type LatLon = { latitude: number; longitude: number };

/** Straight-line distance in metres (haversine). */
export function metresBetween(a: LatLon, b: LatLon) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
}

export const km = (metres: number) => `${(metres / 1000).toFixed(1)} km`;

/** "1h 05m" or "25 min" for a number of minutes. */
export function minutesLabel(minutes: number) {
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** OpenStreetMap's map centred on a point. */
export function mapUrl(to: LatLon) {
  return `https://www.openstreetmap.org/?mlat=${to.latitude}&mlon=${to.longitude}#map=17/${to.latitude}/${to.longitude}`;
}

/** OpenStreetMap driving directions from a point (the hotel, or the user once they allowed it), else the map. */
export function directionsUrl(to: LatLon, from?: LatLon | null) {
  if (!from) return mapUrl(to);
  const route = `${from.latitude},${from.longitude};${to.latitude},${to.longitude}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`;
}

/** A point when both coordinates are known. */
export function pointOf(p: { latitude: number | null; longitude: number | null }): LatLon | null {
  return p.latitude === null || p.longitude === null ? null : { latitude: p.latitude, longitude: p.longitude };
}

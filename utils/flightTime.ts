// Relative (not '@/…') so the Convex bundler can resolve this when the
// day-trip reachability helper pulls it server-side — Convex doesn't know the
// '@' path alias. Works identically for client imports.
import { countryCoordinates } from '../data/countryCoordinates';

/**
 * Calculates approximate flight hours between two countries using
 * great-circle distance between their capital city coordinates.
 *
 * Uses the Haversine formula with an average commercial flight speed of 850 km/h
 * and adds 0.5h for takeoff/landing overhead.
 */
export function getFlightHours(fromCode: string, toCode: string): number | null {
  const distKm = greatCircleKm(fromCode, toCode);
  if (distKm === null) return null;

  const avgSpeedKmH = 850;
  const overhead = 0.5; // takeoff/landing
  const hours = distKm / avgSpeedKmH + overhead;

  return Math.round(hours * 2) / 2; // round to nearest 0.5h
}

/**
 * Great-circle distance in km between two countries' capital coordinates
 * (Haversine). Returns null if either capital is unknown. The raw distance
 * powers the day-trip reachability pre-filter (utils/dayTripReach.ts), where
 * we need kilometres rather than rounded flight-hours.
 */
export function greatCircleKm(fromCode: string, toCode: string): number | null {
  const from = countryCoordinates[fromCode];
  const to = countryCoordinates[toCode];
  if (!from || !to) return null;

  const R = 6371; // Earth radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

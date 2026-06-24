// types/dayPlan.ts
//
// The shape of an input-driven, map-centric DAY PLAN — the new "Plan my day"
// feature. This is deliberately NOT the multi-day trip / day-trip-discovery
// shape: a day plan is a single routed door-to-door day built from the user's
// own start location, transport, reach, and vibe, with every stop a REAL
// place (geocoded) carrying web-sourced provenance.

export type DayPlanTransport = 'car' | 'transit' | 'walk' | 'cycle';

export const DAY_PLAN_TRANSPORTS: readonly DayPlanTransport[] = ['car', 'transit', 'walk', 'cycle'];

export interface DayPlanSource {
  /** Where the recommendation came from, e.g. "Time Out", "r/london". */
  label: string;
  url: string;
}

export interface DayPlanStop {
  name: string;
  /** Authoritative coordinates — resolved by the geocoder, NEVER the LLM. */
  lat: number;
  lng: number;
  /** Reuses the itinerary StopKind vocabulary loosely (landmark/cafe/etc.). */
  kind?: string;
  /** Local arrival time 'HH:MM'. */
  time: string;
  /** Dwell time in minutes. */
  durationMin: number;
  /** 1-2 sentences: the specific thing to do here and why it earns the slot. */
  why: string;
  /** Provenance — the web source that recommends this. */
  source?: DayPlanSource;
  area?: string;
  /** Booking / reserve-ahead note, if any. */
  bookingNote?: string;
}

export interface DayPlanLeg {
  /** Travel minutes for this leg (node i → node i+1). */
  durationMin: number;
  distanceKm: number;
  /** Whether this leg's time came from real routing (OSRM) vs an estimate. */
  estimated?: boolean;
}

export interface DayPlanStart {
  lat: number;
  lng: number;
  /** Human label, e.g. "Shoreditch, London". */
  label: string;
}

export interface DayPlan {
  start: DayPlanStart;
  transport: DayPlanTransport;
  reachMinutes: number;
  /** Editorial title for the day, e.g. "Oysters & big skies in Whitstable". */
  title: string;
  /** 1-2 sentence overview of the day. */
  summary: string;
  /** The main area the day centres on, e.g. "Whitstable". */
  destArea?: string;
  /** Ordered stops (morning → evening). */
  stops: DayPlanStop[];
  /** Travel legs between consecutive nodes where the node sequence is
   *  [start, stop0, stop1, …, lastStop, start]. So legs.length === stops.length + 1
   *  (the final leg is the journey home). */
  legs: DayPlanLeg[];
  /** The full road-route polyline through start → stops → home, [lng,lat]
   *  pairs (from OSRM). The map draws this single line. */
  routeGeometry?: [number, number][];
  totalDistanceKm?: number;
  totalTravelMin?: number;
}

const TRANSPORT_LABEL: Record<DayPlanTransport, string> = {
  car: 'Driving',
  transit: 'Transit',
  walk: 'Walking',
  cycle: 'Cycling',
};

export function transportLabel(t: DayPlanTransport): string {
  return TRANSPORT_LABEL[t] ?? 'Travel';
}

/** "1h 20m" / "45m" from minutes. */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** Parse a stored DayPlan JSON. Light shape guard, not a validator (the server
 *  built it from geocoded data). Returns null on absence/garbage. */
export function parseDayPlan(raw: string | undefined | null): DayPlan | null {
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    const dp = p as DayPlan;
    if (!dp.start || !Array.isArray(dp.stops)) return null;
    return dp;
  } catch {
    return null;
  }
}

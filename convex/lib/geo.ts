// convex/lib/geo.ts
//
// Server-side geocoding + routing for the day planner — no API key required,
// callable straight from a Convex action.
//
//   • Geocoding: Photon (photon.komoot.io) — Komoot's open OSM geocoder.
//   • Routing:   OSRM public demo (router.project-osrm.org) — driving routes
//     with real road geometry + per-leg durations.
//
// Both are public/community endpoints. They're the right call here because the
// app's Google key is LEGACY-only and unreachable from Convex/RN without a
// cross-repo Vercel route. For production scale we'd move geocoding+routing
// behind our own proxy with the legacy Google key; for now these resolve real
// coordinates + routes with zero setup. Every LLM-named place is resolved here
// so nothing hallucinated reaches the map.

const PHOTON_URL = "https://photon.komoot.io/api/";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
const UA = "visa-atlas/day-planner";

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Forward-geocode a free-text place/address. `bias` nudges results toward the
 * day's area (Photon `lat`/`lon` priority). Returns the best hit or null.
 */
export async function geocode(
  query: string,
  bias?: { lat: number; lng: number },
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const params = new URLSearchParams({ q, limit: "1" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  try {
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      headers: { "User-Agent": UA },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const feats = (json as { features?: unknown[] }).features;
    if (!Array.isArray(feats) || feats.length === 0) return null;
    const f = feats[0] as {
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, unknown>;
    };
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const p = f.properties ?? {};
    const label =
      [p.name, p.street, p.city, p.state]
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .slice(0, 2)
        .join(", ") || query;
    return { lat, lng, label };
  } catch {
    return null;
  }
}

export interface RouteResult {
  /** Full road polyline through every node, [lng,lat] pairs. */
  geometry: [number, number][];
  /** Per-leg duration (minutes) and distance (km), node i → node i+1. */
  legs: { durationMin: number; distanceKm: number }[];
  totalDurationMin: number;
  totalDistanceKm: number;
}

/**
 * Driving route through an ordered list of [lng,lat] coordinates (start →
 * stops → home). Returns the road geometry + per-leg times. Null on failure
 * (the caller falls back to straight-line estimates). OSRM's public demo is
 * driving-only; non-car modes scale these durations.
 */
export async function routeDriving(
  coords: [number, number][],
): Promise<RouteResult | null> {
  if (coords.length < 2) return null;
  const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_URL}${path}?overview=full&geometries=geojson&annotations=false`;
  // The public OSRM demo is rate-limited; one retry smooths transient misses
  // (the caller still falls back to straight-line legs if both fail).
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await tryRoute(url);
    if (r) return r;
  }
  return null;
}

async function tryRoute(url: string): Promise<RouteResult | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: Array<{
        duration?: number;
        distance?: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: Array<{ duration?: number; distance?: number }>;
      }>;
    };
    if (json.code !== "Ok" || !json.routes?.length) return null;
    const r = json.routes[0];
    const geometry = (r.geometry?.coordinates ?? []) as [number, number][];
    const legs = (r.legs ?? []).map((l) => ({
      durationMin: Math.round((l.duration ?? 0) / 60),
      distanceKm: Math.round(((l.distance ?? 0) / 1000) * 10) / 10,
    }));
    return {
      geometry,
      legs,
      totalDurationMin: Math.round((r.duration ?? 0) / 60),
      totalDistanceKm: Math.round(((r.distance ?? 0) / 1000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

/** Great-circle km between two [lng,lat] points (Haversine) — straight-line
 *  fallback when routing is unavailable. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Rough minutes for a straight-line leg by mode, when OSRM is unavailable. */
export function estimateLegMinutes(
  km: number,
  transport: "car" | "transit" | "walk" | "cycle",
): number {
  const kmh = { car: 40, transit: 25, cycle: 15, walk: 4.8 }[transport] ?? 30;
  // ×1.3 detour factor since straight-line underestimates road distance.
  return Math.round(((km * 1.3) / kmh) * 60);
}

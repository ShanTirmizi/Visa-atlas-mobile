// utils/geocodeClient.ts
//
// Client-side geocoding for the day-planner INPUT screen (search a start
// address, reverse-geocode a tapped point). Uses Photon (Komoot's open OSM
// geocoder) — no key, and RN's native fetch has no CORS restriction. The
// generation action does its own server-side geocoding of stops; this is only
// for picking the start location.

const PHOTON = 'https://photon.komoot.io';

export interface GeoHit {
  lat: number;
  lng: number;
  label: string;
}

function labelFor(p: Record<string, unknown>, fallback: string): string {
  const parts = [p.name, p.street, p.district, p.city, p.state]
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
  // De-dup consecutive repeats and cap to 3 segments for a tidy label.
  const seen: string[] = [];
  for (const part of parts) {
    if (seen[seen.length - 1] !== part) seen.push(part);
    if (seen.length >= 3) break;
  }
  return seen.join(', ') || fallback;
}

/** Forward geocode (search-as-you-go). Returns up to `limit` hits. */
export async function searchPlaces(
  query: string,
  bias?: { lat: number; lng: number },
  limit = 5,
): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (bias) {
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lng));
  }
  try {
    const res = await fetch(`${PHOTON}/api/?${params.toString()}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: unknown[] };
    const feats = Array.isArray(json.features) ? json.features : [];
    return feats
      .map((f) => {
        const ff = f as {
          geometry?: { coordinates?: [number, number] };
          properties?: Record<string, unknown>;
        };
        const c = ff.geometry?.coordinates;
        if (!c || c.length < 2) return null;
        return { lat: c[1], lng: c[0], label: labelFor(ff.properties ?? {}, q) };
      })
      .filter((h): h is GeoHit => h !== null);
  } catch {
    return [];
  }
}

/** Reverse geocode a tapped coordinate → a human label. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}`);
    if (!res.ok) return 'Dropped pin';
    const json = (await res.json()) as { features?: unknown[] };
    const f = (json.features ?? [])[0] as { properties?: Record<string, unknown> } | undefined;
    return f ? labelFor(f.properties ?? {}, 'Dropped pin') : 'Dropped pin';
  } catch {
    return 'Dropped pin';
  }
}

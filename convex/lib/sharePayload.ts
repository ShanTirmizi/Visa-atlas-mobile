// convex/lib/sharePayload.ts
//
// The PUBLIC share allowlist. `buildSharedTripPayload` is the single
// projection between a trips doc and what an anonymous visitor sees on
// the web share page (visa-atlas.vercel.app/t/<token>) — it constructs a
// fresh object field-by-field and NEVER spreads the doc, so a new trips
// column can't leak by default. Fields that must never cross this
// boundary: userId, userNotes, refinementAnswers, every visa* field,
// budgetBreakdown, dailyBudget, costLevel, packingSuggestions,
// accommodationTips, visaChecklist, checklistProgress, highlights,
// status, iataCode, vibeTag, companions, surpriseMe, flightHours, legs.
//
// The visa-atlas WEB repo mirrors SharedTripPayload by hand
// (src/lib/share/types.ts there) — any change to the shapes below must
// be mirrored in that file in the same change.

import type { Doc } from "../_generated/dataModel";
import {
  parseItineraryDays,
  parseDiningGuide,
  type ItineraryDay,
  type DiningGuide,
} from "../../types/itinerary";

export interface SharedImage {
  url: string;
  thumb?: string;
  credit?: string;
  creditUrl?: string;
}

export interface SharedLocalGuide {
  tipping?: string;
  connectivity?: string;
  tapWater?: string;
  plugType?: string;
  dressCode?: string;
  cashOrCard?: string;
  apps?: { name: string; purpose: string }[];
  scamWarnings?: string[];
  localCustoms?: string[];
}

export interface SharedLocalEssentials {
  emergencyNumber?: string;
  policeNumber?: string;
  ambulanceNumber?: string;
}

export interface SharedTripPayload {
  countryName: string;
  countryCode: string;
  region: string;
  capital: string;
  currency: string;
  language: string;
  timezone: string;
  duration: number;
  startDate: string | null;
  endDate: string | null;
  isMultiCountry: boolean;
  routeTitle: string | null;
  heroImage: SharedImage | null;
  dayImages: SharedImage[] | null;
  activityImages: SharedImage[] | null;
  itinerary: ItineraryDay[];
  diningGuide: DiningGuide | null;
  localGuide: SharedLocalGuide | null;
  localEssentials: SharedLocalEssentials | null;
}

// ── Narrowing helpers ────────────────────────────────────────────

/** Only https URLs survive — the web page renders these as <img src> /
 *  <a href>, so http://, data:, and javascript: values are all dropped. */
function httpsUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("https://")
    ? value
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function strArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((x): x is string => typeof x === "string");
  return items.length > 0 ? items : undefined;
}

/** Validate one image entry. A missing/non-https `url` rejects the whole
 *  entry; the optional fields are individually dropped when invalid. */
function toSharedImage(value: unknown): SharedImage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const url = httpsUrl(raw.url);
  if (url === undefined) return null;
  const thumb = httpsUrl(raw.thumb);
  const credit = str(raw.credit);
  const creditUrl = httpsUrl(raw.creditUrl);
  return {
    url,
    ...(thumb !== undefined ? { thumb } : {}),
    ...(credit !== undefined ? { credit } : {}),
    ...(creditUrl !== undefined ? { creditUrl } : {}),
  };
}

/** Parse a JSON-stringified single image field (trips.heroImage). */
function parseSharedImage(raw: string | undefined): SharedImage | null {
  if (!raw) return null;
  try {
    return toSharedImage(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Parse a JSON-stringified image array (trips.dayImages /
 *  trips.activityImages). Invalid entries are filtered; empty → null. */
function parseSharedImageArray(raw: string | undefined): SharedImage[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const images = parsed
      .map(toSharedImage)
      .filter((img): img is SharedImage => img !== null);
    return images.length > 0 ? images : null;
  } catch {
    return null;
  }
}

/** Pick ONLY the SharedLocalGuide fields out of trips.localGuide. */
function parseSharedLocalGuide(raw: string | undefined): SharedLocalGuide | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const g = parsed as Record<string, unknown>;

  const apps = Array.isArray(g.apps)
    ? (g.apps as unknown[])
        .map((a): { name: string; purpose: string } | null => {
          if (!a || typeof a !== "object") return null;
          const app = a as Record<string, unknown>;
          const name = str(app.name);
          const purpose = str(app.purpose);
          return name !== undefined && purpose !== undefined
            ? { name, purpose }
            : null;
        })
        .filter((a): a is { name: string; purpose: string } => a !== null)
    : [];

  const guide: SharedLocalGuide = {
    ...(str(g.tipping) !== undefined ? { tipping: str(g.tipping) } : {}),
    ...(str(g.connectivity) !== undefined
      ? { connectivity: str(g.connectivity) }
      : {}),
    ...(str(g.tapWater) !== undefined ? { tapWater: str(g.tapWater) } : {}),
    ...(str(g.plugType) !== undefined ? { plugType: str(g.plugType) } : {}),
    ...(str(g.dressCode) !== undefined ? { dressCode: str(g.dressCode) } : {}),
    ...(str(g.cashOrCard) !== undefined
      ? { cashOrCard: str(g.cashOrCard) }
      : {}),
    ...(apps.length > 0 ? { apps } : {}),
    ...(strArray(g.scamWarnings) !== undefined
      ? { scamWarnings: strArray(g.scamWarnings) }
      : {}),
    ...(strArray(g.localCustoms) !== undefined
      ? { localCustoms: strArray(g.localCustoms) }
      : {}),
  };

  return Object.keys(guide).length > 0 ? guide : null;
}

/** Pick ONLY the emergency/police/ambulance numbers out of
 *  trips.localEssentials — ukEmbassy / nearestHospital are deliberately
 *  dropped (owner-residence-specific, not for an anonymous viewer). */
function parseSharedLocalEssentials(
  raw: string | undefined,
): SharedLocalEssentials | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const e = parsed as Record<string, unknown>;
  const emergencyNumber = str(e.emergencyNumber);
  const policeNumber = str(e.policeNumber);
  const ambulanceNumber = str(e.ambulanceNumber);
  const essentials: SharedLocalEssentials = {
    ...(emergencyNumber !== undefined ? { emergencyNumber } : {}),
    ...(policeNumber !== undefined ? { policeNumber } : {}),
    ...(ambulanceNumber !== undefined ? { ambulanceNumber } : {}),
  };
  return Object.keys(essentials).length > 0 ? essentials : null;
}

// ── The allowlist projection ─────────────────────────────────────

export function buildSharedTripPayload(trip: Doc<"trips">): SharedTripPayload {
  return {
    countryName: trip.countryName,
    countryCode: trip.countryCode,
    region: trip.region,
    capital: trip.capital,
    currency: trip.currency,
    language: trip.language,
    timezone: trip.timezone,
    duration: trip.duration,
    startDate: trip.startDate ?? null,
    endDate: trip.endDate ?? null,
    isMultiCountry: trip.isMultiCountry ?? false,
    routeTitle: trip.routeTitle ?? null,
    heroImage: parseSharedImage(trip.heroImage),
    dayImages: parseSharedImageArray(trip.dayImages),
    activityImages: parseSharedImageArray(trip.activityImages),
    itinerary: parseItineraryDays(trip.itinerary),
    diningGuide: parseDiningGuide(trip.diningGuide),
    localGuide: parseSharedLocalGuide(trip.localGuide),
    localEssentials: parseSharedLocalEssentials(trip.localEssentials),
  };
}

// convex/lib/sharePayload.ts
//
// The PUBLIC share allowlist. `buildSharedTripPayload` is the single
// projection between a trips doc and what an anonymous visitor sees on
// the web share page (visa-atlas.vercel.app/t/<token>) — it constructs a
// fresh object field-by-field and NEVER spreads the doc, so a new trips
// column can't leak by default. The same rule holds one level down:
// itinerary days/stops and the dining guide are client-writable JSON
// (any editor can write arbitrary keys through trips.updateTripField),
// so the toShared* projectors below rebuild every nested object with
// ONLY known keys — an unknown nested key can't leak either. Fields that
// must never cross this boundary: userId, userNotes, refinementAnswers,
// every visa* field, budgetBreakdown, dailyBudget, costLevel,
// packingSuggestions, accommodationTips, visaChecklist,
// checklistProgress, highlights, status, iataCode, vibeTag, companions,
// surpriseMe, flightHours, legs.
//
// The visa-atlas WEB repo mirrors SharedTripPayload by hand
// (src/lib/share/types.ts there) — any change to the shapes below must
// be mirrored in that file in the same change.

import type { Doc } from "../_generated/dataModel";
import {
  parseItineraryDays,
  parseDiningGuide,
  isUsableStop,
  STOP_KINDS,
  MEAL_TAGS,
  PRICE_TIERS,
  CROWD_SIGNALS,
  type ItineraryDay,
  type ItineraryStop,
  type DiningGuide,
  type DiningSpot,
  type MustTryDish,
  type MealTag,
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

/** Membership check against a closed value set (STOP_KINDS, MEAL_TAGS,
 *  PRICE_TIERS, CROWD_SIGNALS) — anything outside the set is dropped. */
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
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

  const tipping = str(g.tipping);
  const connectivity = str(g.connectivity);
  const tapWater = str(g.tapWater);
  const plugType = str(g.plugType);
  const dressCode = str(g.dressCode);
  const cashOrCard = str(g.cashOrCard);
  const scamWarnings = strArray(g.scamWarnings);
  const localCustoms = strArray(g.localCustoms);

  const guide: SharedLocalGuide = {
    ...(tipping !== undefined ? { tipping } : {}),
    ...(connectivity !== undefined ? { connectivity } : {}),
    ...(tapWater !== undefined ? { tapWater } : {}),
    ...(plugType !== undefined ? { plugType } : {}),
    ...(dressCode !== undefined ? { dressCode } : {}),
    ...(cashOrCard !== undefined ? { cashOrCard } : {}),
    ...(apps.length > 0 ? { apps } : {}),
    ...(scamWarnings !== undefined ? { scamWarnings } : {}),
    ...(localCustoms !== undefined ? { localCustoms } : {}),
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

// ── Nested allowlist projectors ──────────────────────────────────
//
// parseItineraryDays / parseDiningGuide only guarantee coarse shape
// (object-ness, intro is a string) — the objects inside are whatever an
// editor last wrote. These projectors are the nested-key counterpart of
// buildSharedTripPayload: rebuild each object with ONLY known keys, each
// field kept only when it has the right type.

/** isUsableStop guarantees slot/name/note; the rebuild drops every other
 *  key. Optional fields survive only as their declared type — `kind`
 *  must be one of STOP_KINDS, time/duration must be strings. */
function toSharedStop(stop: ItineraryStop): ItineraryStop {
  const s = stop as unknown as Record<string, unknown>;
  const kind = oneOf(s.kind, STOP_KINDS);
  const time = str(s.time);
  const duration = str(s.duration);
  return {
    slot: stop.slot,
    name: stop.name,
    note: stop.note,
    ...(kind !== undefined ? { kind } : {}),
    ...(time !== undefined ? { time } : {}),
    ...(duration !== undefined ? { duration } : {}),
  };
}

/** Rebuild one itinerary day with ONLY the ItineraryDay keys. Required
 *  fields fall back ("" / 0) instead of dropping the day —
 *  parseItineraryDays deliberately keeps array indices stable so day
 *  navigation stays aligned, and renderers carry per-field fallbacks.
 *  Stops that fail isUsableStop are dropped (same filter every client
 *  surface applies via stopsForSlot). */
function toSharedItineraryDay(value: ItineraryDay): ItineraryDay {
  const d = value as unknown as Record<string, unknown>;
  const subtitle = str(d.subtitle);
  const heroSubject = str(d.heroSubject);
  const morningPlace = str(d.morningPlace);
  const afternoonPlace = str(d.afternoonPlace);
  const eveningPlace = str(d.eveningPlace);
  const tip = str(d.tip);
  const localTip = str(d.localTip);
  const stops = Array.isArray(d.stops)
    ? (d.stops as unknown[]).filter(isUsableStop).map(toSharedStop)
    : undefined;
  return {
    day: typeof d.day === "number" ? d.day : 0,
    title: str(d.title) ?? "",
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(heroSubject !== undefined ? { heroSubject } : {}),
    morning: str(d.morning) ?? "",
    ...(morningPlace !== undefined ? { morningPlace } : {}),
    afternoon: str(d.afternoon) ?? "",
    ...(afternoonPlace !== undefined ? { afternoonPlace } : {}),
    evening: str(d.evening) ?? "",
    ...(eveningPlace !== undefined ? { eveningPlace } : {}),
    ...(tip !== undefined ? { tip } : {}),
    ...(localTip !== undefined ? { localTip } : {}),
    ...(stops !== undefined ? { stops } : {}),
  };
}

/** Rebuild the dining guide key-by-key. Mirrors normalizeDiningGuide's
 *  required/optional split (spots missing name/cuisine/price/area/why are
 *  dropped; knownFor defaults to ""), but this layer only guards shape —
 *  dedup/clamping belong to the write path. meals/days/price/crowd are
 *  checked against the canonical value sets from types/itinerary.ts. A
 *  guide with no surviving spots collapses to null, matching the
 *  write-time invariant that an empty guide is never stored. */
function toSharedDiningGuide(guide: DiningGuide | null): DiningGuide | null {
  if (guide === null) return null;

  const mustTry = guide.mustTry
    .map((m): MustTryDish | null => {
      if (!m || typeof m !== "object") return null;
      const mt = m as unknown as Record<string, unknown>;
      const dish = str(mt.dish);
      return dish !== undefined ? { dish, note: str(mt.note) ?? "" } : null;
    })
    .filter((m): m is MustTryDish => m !== null);

  const spots = guide.spots
    .map((s): DiningSpot | null => {
      if (!s || typeof s !== "object") return null;
      const sp = s as unknown as Record<string, unknown>;
      const name = str(sp.name);
      const cuisine = str(sp.cuisine);
      const price = oneOf(sp.price, PRICE_TIERS);
      const area = str(sp.area);
      const why = str(sp.why);
      if (
        name === undefined ||
        cuisine === undefined ||
        price === undefined ||
        area === undefined ||
        why === undefined
      ) {
        return null;
      }
      const crowd = oneOf(sp.crowd, CROWD_SIGNALS);
      const meals = Array.isArray(sp.meals)
        ? (sp.meals as unknown[]).filter(
            (m): m is MealTag => oneOf(m, MEAL_TAGS) !== undefined,
          )
        : [];
      const days = Array.isArray(sp.days)
        ? (sp.days as unknown[]).filter(
            (d): d is number => Number.isInteger(d) && (d as number) >= 1,
          )
        : [];
      const walkNote = str(sp.walkNote);
      return {
        name,
        cuisine,
        price,
        area,
        knownFor: str(sp.knownFor) ?? "",
        why,
        ...(crowd !== undefined ? { crowd } : {}),
        meals,
        ...(days.length > 0 ? { days } : {}),
        ...(sp.reserveAhead === true ? { reserveAhead: true } : {}),
        ...(walkNote !== undefined ? { walkNote } : {}),
      };
    })
    .filter((s): s is DiningSpot => s !== null);

  if (spots.length === 0) return null;
  return { intro: guide.intro, mustTry, spots };
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
    itinerary: parseItineraryDays(trip.itinerary).map(toSharedItineraryDay),
    diningGuide: toSharedDiningGuide(parseDiningGuide(trip.diningGuide)),
    localGuide: parseSharedLocalGuide(trip.localGuide),
    localEssentials: parseSharedLocalEssentials(trip.localEssentials),
  };
}

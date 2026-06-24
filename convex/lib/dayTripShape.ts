// convex/lib/dayTripShape.ts
//
// The shared shape for a single same-day-return destination in the
// per-home-country discovery cache. Kept in its own module that imports
// ONLY `v` from "convex/values" so `convex/schema.ts` can reuse the
// validator inline without an import cycle (schema → _generated → schema).
//
// Mirrors the `countryTipsCache` precedent: one validator definition shared
// between the table schema and the internal write mutation, so the stored
// shape can never drift from what the writer produces.
//
// CRITICAL: this shape is deliberately VISA-AGNOSTIC. Transport facts are
// the same for every traveller from a given home country, so they cache
// forever and are reused across all users. Visa is per-user and is computed
// at read time on the client via resolveCountry() — never stored here.

import { v, type Infer } from "convex/values";

/** Bump when the discovery prompt or shape changes so stale cache rows are
 *  regenerated instead of served. */
export const DAY_TRIP_MODEL_VERSION = "daytrip-v1";

export const dayTripModeValidator = v.union(
  v.literal("rail"),
  v.literal("flight"),
  v.literal("ferry"),
  v.literal("coach"),
  v.literal("road"),
);

export const dayTripDestinationValidator = v.object({
  /** alpha-2 country code of the destination. Equals the home code for
   *  domestic (in-country) day trips. */
  destCode: v.string(),
  /** Country name, e.g. "France". */
  destName: v.string(),
  /** The city/area you actually spend the day in, e.g. "Paris", "Bath". */
  destCity: v.string(),
  /** international = crosses a border (visa matters); domestic = in-country. */
  scope: v.union(v.literal("international"), v.literal("domestic")),
  transportMode: dayTripModeValidator,
  /** Compact human label, e.g. "Eurostar · 2h20". */
  transportLabel: v.string(),
  /** Typical local times — NOT booked. "07:01" etc. Departure/return in the
   *  home city's local time; arrival in the destination's local time. */
  outboundDepart: v.string(),
  outboundArrive: v.string(),
  /** The LAST realistic same-day return departure (destination local). */
  lastReturnDepart: v.string(),
  /** Arrival back home (home local) — may read past midnight; stored as-is. */
  returnArrive: v.string(),
  /** Usable hours at the destination between arrival and last return. */
  hoursOnGround: v.number(),
  /** "≈2h20 each way" style summary. */
  doorToDoorLabel: v.string(),
  /** Rough all-in cost of the day (transport + a meal + an activity), in
   *  `currency`. A single rounded estimate, never a quote. */
  costOfDay: v.number(),
  /** ISO currency code the cost is expressed in (the home country's). */
  currency: v.string(),
  /** 1-based month numbers when this trip is at its best (daylight, weather,
   *  ferry season). Empty = good year-round. */
  bestMonths: v.array(v.number()),
  seasonNote: v.optional(v.string()),
  /** comfortable = relaxed margins; tight = doable but a real time squeeze. */
  feasibility: v.union(v.literal("comfortable"), v.literal("tight")),
  /** Operator name for the verify-live-times deep link, e.g. "Eurostar". */
  operator: v.optional(v.string()),
  bookingUrl: v.optional(v.string()),
  /** One editorial sentence — the hook. "Lunch on the Grand-Place, home by dinner." */
  blurb: v.string(),
});

export type DayTripDestination = Infer<typeof dayTripDestinationValidator>;
export type DayTripMode = Infer<typeof dayTripModeValidator>;

const MODES: readonly DayTripMode[] = ["rail", "flight", "ferry", "coach", "road"];

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Coerce one raw LLM entry into a storable DayTripDestination, or null if a
 * required field is missing/wrong-typed. Same forgiving-but-strict discipline
 * as the country-tips write: drop a bad entry rather than poison the cache.
 * `homeCurrency` is the fallback when the model omits the currency code.
 */
export function normalizeDayTripDestination(
  raw: unknown,
  homeCurrency: string,
): DayTripDestination | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const destCode = str(r.destCode, 2).toUpperCase();
  const destName = str(r.destName, 60);
  const destCity = str(r.destCity, 60);
  const transportLabel = str(r.transportLabel, 40);
  const outboundDepart = str(r.outboundDepart, 8);
  const outboundArrive = str(r.outboundArrive, 8);
  const lastReturnDepart = str(r.lastReturnDepart, 8);
  const returnArrive = str(r.returnArrive, 8);
  const doorToDoorLabel = str(r.doorToDoorLabel, 40);
  const blurb = str(r.blurb, 200);

  const scope =
    r.scope === "international" || r.scope === "domestic" ? r.scope : null;
  const transportMode = MODES.includes(r.transportMode as DayTripMode)
    ? (r.transportMode as DayTripMode)
    : null;
  const feasibility =
    r.feasibility === "comfortable" || r.feasibility === "tight"
      ? r.feasibility
      : null;
  const hoursOnGround =
    typeof r.hoursOnGround === "number" && Number.isFinite(r.hoursOnGround)
      ? Math.max(0, Math.round(r.hoursOnGround * 2) / 2)
      : null;

  if (
    destCode.length !== 2 ||
    !destName ||
    !destCity ||
    !scope ||
    !transportMode ||
    !transportLabel ||
    !outboundDepart ||
    !lastReturnDepart ||
    !feasibility ||
    hoursOnGround === null ||
    !blurb
  ) {
    return null;
  }

  const costOfDay =
    typeof r.costOfDay === "number" && Number.isFinite(r.costOfDay)
      ? Math.max(0, Math.round(r.costOfDay))
      : 0;
  const currency = str(r.currency, 4) || homeCurrency;
  const bestMonths = Array.isArray(r.bestMonths)
    ? [
        ...new Set(
          (r.bestMonths as unknown[])
            .map((m) => Number(m))
            .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
        ),
      ].sort((a, b) => a - b)
    : [];
  const seasonNote = str(r.seasonNote, 120);
  const operator = str(r.operator, 40);
  const bookingUrl = str(r.bookingUrl, 200);

  return {
    destCode,
    destName,
    destCity,
    scope,
    transportMode,
    transportLabel,
    outboundDepart,
    outboundArrive: outboundArrive || outboundDepart,
    lastReturnDepart,
    returnArrive: returnArrive || lastReturnDepart,
    hoursOnGround,
    doorToDoorLabel: doorToDoorLabel || transportLabel,
    costOfDay,
    currency,
    bestMonths,
    feasibility,
    blurb,
    ...(seasonNote ? { seasonNote } : {}),
    ...(operator ? { operator } : {}),
    ...(bookingUrl && /^https?:\/\//i.test(bookingUrl) ? { bookingUrl } : {}),
  };
}

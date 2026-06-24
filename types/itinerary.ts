// types/itinerary.ts
//
// Single source of truth for the itinerary-day and dining-guide shapes.
// The LLM emits these (see convex/lib/anthropicStream.ts prompt builders);
// the trip doc stores them JSON-stringified in `trips.itinerary` and
// `trips.diningGuide`; every client surface parses through the helpers
// below. Previously ItineraryDay was duplicated across 6+ files — keep
// all consumers importing from here.
//
// Every post-2026-06 field is OPTIONAL: trips generated before the
// structured-stops/dining release lack them, and tweakDay round-trips
// whatever keys a day already has. Parse sites must never assume `stops`
// or a dining guide exist.

// ── Structured stops (per day) ───────────────────────────────────

export type StopSlot = 'morning' | 'afternoon' | 'evening';

export const STOP_KINDS = [
  'landmark',
  'museum',
  'gallery',
  'market',
  'nature',
  'walk',
  'neighborhood',
  'experience',
  'cafe',
  'viewpoint',
  'beach',
  'shopping',
  // Day-trip transport legs (the outbound/return bookends on a single-day
  // plan) render with a train/plane glyph on the timeline instead of a map
  // pin. Legacy multi-day trips never emit this.
  'transport',
] as const;
export type StopKind = (typeof STOP_KINDS)[number];

export interface ItineraryStop {
  slot: StopSlot;
  /** Real place name — also feeds the Apple Maps search deep link. */
  name: string;
  /** 1-2 sentences: the SPECIFIC thing to do here (a named dish/room/work,
   *  a viewpoint, a route) and why it earns its slot — never "explore". */
  note: string;
  kind?: StopKind;
  /** 24h local start time, e.g. "09:00". Plausible, not booked. */
  time?: string;
  /** Human-form dwell time, e.g. "1½ hrs". */
  duration?: string;
  /** Specific neighbourhood / street / micro-area, e.g.
   *  "Trastevere, by Piazza di Santa Maria". Sharpens the Maps search and
   *  reads as a real address hint, not a city name. */
  area?: string;
  /** ONE concrete, actionable tip — a named dish to order, the specific
   *  gate/entrance/platform, the exact viewpoint or trail, what to see
   *  first. The "Order the carbonara" pattern, mirrored from DiningSpot. */
  tip?: string;
  /** True when the stop needs a reservation / timed ticket booked ahead. */
  reserveAhead?: boolean;
}

export interface ItineraryDay {
  day: number;
  title: string;
  subtitle?: string;
  heroSubject?: string;
  /** 1-2 sentence connective narrative for the slot (legacy trips: 2-4). */
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip?: string;
  localTip?: string;
  /** Structured stops across the three slots. Absent on legacy trips —
   *  the day detail screen falls back to prose rendering per slot. */
  stops?: ItineraryStop[];
}

// ── Day trip (per trip) ──────────────────────────────────────────
//
// The transport spine of a same-day-return trip, chosen from the discovery
// cache when the user taps "Plan this day". Stored JSON-stringified in
// `trips.dayTrip` so the trip detail screen renders the outbound/return
// bookends and the "back home by" guarantee without re-deriving anything.
// Present only on day trips (trips.isDayTrip === true); absent on every
// multi-day trip.

export type DayTripMode = 'rail' | 'flight' | 'ferry' | 'coach' | 'road';
export const DAY_TRIP_MODES: readonly DayTripMode[] = ['rail', 'flight', 'ferry', 'coach', 'road'];

export interface DayTripMeta {
  /** alpha-2 home country the trip departs from. */
  homeCode: string;
  homeCity: string;
  /** The city/area the day is spent in. */
  destCity: string;
  scope: 'international' | 'domestic';
  transportMode: DayTripMode;
  /** "Eurostar · 2h20" */
  transportLabel: string;
  /** Typical local times — NOT booked. Confirmed live before travel. */
  outboundDepart: string;
  outboundArrive: string;
  lastReturnDepart: string;
  returnArrive: string;
  hoursOnGround: number;
  doorToDoorLabel: string;
  costOfDay: number;
  currency: string;
  operator?: string;
  bookingUrl?: string;
  /** True when the day crosses a real (non-Schengen-internal) border, so the
   *  "bring your passport" reminder fires. Domestic trips: false. */
  borderReminder: boolean;
  feasibility: 'comfortable' | 'tight';
}

/** Parse `trips.dayTrip`. Tolerates absence (every multi-day trip) and
 *  malformed JSON; a light shape guard, not a validator (the server wrote it
 *  from the validated discovery cache). */
export function parseDayTripMeta(raw: string | undefined | null): DayTripMeta | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const m = parsed as DayTripMeta;
    if (typeof m.destCity !== 'string' || typeof m.transportMode !== 'string') return null;
    return m;
  } catch {
    return null;
  }
}

// ── Dining guide (per trip) ──────────────────────────────────────

export type MealTag = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TAGS: readonly MealTag[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type PriceTier = '$' | '$$' | '$$$' | '$$$$';
export const PRICE_TIERS: readonly PriceTier[] = ['$', '$$', '$$$', '$$$$'];

/** Editorial trust signal — deliberately NOT a fabricated star rating.
 *  Real ratings/reviews live one tap away in Apple Maps. */
export type CrowdSignal = 'local-favorite' | 'institution' | 'tourist-classic' | 'new-wave';
export const CROWD_SIGNALS: readonly CrowdSignal[] = [
  'local-favorite',
  'institution',
  'tourist-classic',
  'new-wave',
];

export const CROWD_LABELS: Record<CrowdSignal, string> = {
  'local-favorite': 'Local favourite',
  institution: 'Institution',
  'tourist-classic': 'Classic',
  'new-wave': 'New wave',
};

export interface DiningSpot {
  name: string;
  /** e.g. "Roman trattoria", "Kaiseki" */
  cuisine: string;
  price: PriceTier;
  /** Neighborhood / area name. */
  area: string;
  /** Signature order — "Order the carbonara and the seasonal carciofi." */
  knownFor: string;
  /** One sentence tying the spot to THIS trip's vibe / party / budget. */
  why: string;
  crowd?: CrowdSignal;
  meals: MealTag[];
  /** 1-based day numbers whose plan passes nearby. */
  days?: number[];
  reserveAhead?: boolean;
  /** Optional proximity hook — "5-min walk from the Bocca della Verità". */
  walkNote?: string;
}

export interface MustTryDish {
  dish: string;
  note: string;
}

export interface DiningGuide {
  /** 2-3 editorial sentences on the destination's food scene. */
  intro: string;
  mustTry: MustTryDish[];
  spots: DiningSpot[];
}

// ── Parse helpers ────────────────────────────────────────────────

/** Parse `trips.itinerary`. Tolerates the empty string (pre-stream),
 *  malformed JSON, and null holes left by out-of-order day patches. */
export function parseItineraryDays(raw: string | undefined | null): ItineraryDay[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // filter(Boolean)-equivalent ONLY — every consumer (trip index, DayDeck,
    // the day route) must apply the SAME filter or their array indices
    // diverge and day navigation opens the wrong day. Do not tighten this
    // (e.g. requiring `title`) without changing every parse site at once;
    // renderers carry their own per-field fallbacks.
    return parsed.filter((d): d is ItineraryDay => !!d && typeof d === 'object');
  } catch {
    return [];
  }
}

/** The single definition of "renderable stop" — shared by every client
 *  surface AND the Convex pipeline (dining day-contexts, the stops
 *  backfill, day-tweak preservation). Server and client must never
 *  disagree on what counts as a usable stop. */
export function isUsableStop(s: unknown): s is ItineraryStop {
  if (!s || typeof s !== 'object') return false;
  const stop = s as ItineraryStop;
  return (
    (stop.slot === 'morning' || stop.slot === 'afternoon' || stop.slot === 'evening') &&
    typeof stop.name === 'string' &&
    stop.name.trim().length > 0 &&
    typeof stop.note === 'string'
  );
}
const isValidStop = isUsableStop;

/** Valid structured stops for one slot, in emitted order. Accepts any
 *  shape carrying `stops` (e.g. utils/dayPlaces' slot view of a day). */
export function stopsForSlot(
  day: Pick<ItineraryDay, 'stops'>,
  slot: StopSlot,
): ItineraryStop[] {
  if (!Array.isArray(day.stops)) return [];
  return day.stops.filter((s) => isValidStop(s) && s.slot === slot);
}

/** True when the day carries usable structured stops (≥1 valid entry). */
export function hasStructuredStops(day: Pick<ItineraryDay, 'stops'>): boolean {
  return Array.isArray(day.stops) && day.stops.some(isValidStop);
}

/** Parse `trips.diningGuide`. The server normalizes before writing, so the
 *  client check is a light shape guard, not a validator. */
export function parseDiningGuide(raw: string | undefined | null): DiningGuide | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const g = parsed as DiningGuide;
    if (typeof g.intro !== 'string' || !Array.isArray(g.spots)) return null;
    return {
      intro: g.intro,
      mustTry: Array.isArray(g.mustTry) ? g.mustTry : [],
      spots: g.spots,
    };
  } catch {
    return null;
  }
}

/** Spots recommended for a given 1-based day number and meal. */
export function spotsForDayMeal(
  guide: DiningGuide | null,
  dayNumber: number,
  meal: MealTag,
): DiningSpot[] {
  if (!guide) return [];
  return guide.spots.filter(
    (s) => (s.days ?? []).includes(dayNumber) && (s.meals ?? []).includes(meal),
  );
}

// ── Stop photos (per trip) ───────────────────────────────────────

/** One resolved photo of a real place — Google Places, resolved by the web
 *  repo's /api/stop-photos. `thumb` and `url` are the same 1200px file
 *  today (one media request per photo; expo-image downsamples for strips
 *  and the lightbox reuses the already-cached file). Both fields stay so
 *  the shape remains compatible with SharedImage and a future smaller
 *  thumb pipeline. */
export interface StopPhoto {
  url: string;
  thumb?: string;
  credit?: string;
  creditUrl?: string;
  source?: string;
}

/** Photos for one (day, stop-name) pair — `trips.stopPhotos` stores a
 *  JSON-stringified array of these. Lookups match by normalized place
 *  name, so a renamed/tweaked stop simply shows no photos rather than the
 *  wrong place's. */
export interface StopPhotoSet {
  day: number;
  stop: string;
  photos: StopPhoto[];
}

/** Case/whitespace-insensitive key for place-name lookups — server stop
 *  names and client stop names both pass through here. */
export function normalizePlaceName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Parse `trips.stopPhotos`. Tolerates absence (pre-feature trips, fetch
 *  still in flight), malformed JSON, and drops entries without a url. */
export function parseStopPhotos(raw: string | undefined | null): StopPhotoSet[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is StopPhotoSet => {
        if (!s || typeof s !== 'object') return false;
        const set = s as StopPhotoSet;
        return (
          typeof set.day === 'number' &&
          typeof set.stop === 'string' &&
          Array.isArray(set.photos)
        );
      })
      .map((set) => ({
        ...set,
        photos: set.photos.filter(
          (p): p is StopPhoto =>
            !!p &&
            typeof p === 'object' &&
            typeof (p as StopPhoto).url === 'string' &&
            (p as StopPhoto).url.length > 0,
        ),
      }));
  } catch {
    return [];
  }
}

/** Photos for one stop on one 1-based day (normalized name match). */
export function photosForStop(
  sets: StopPhotoSet[],
  dayNumber: number,
  stopName: string,
): StopPhoto[] {
  const key = normalizePlaceName(stopName);
  const set = sets.find(
    (s) => s.day === dayNumber && normalizePlaceName(s.stop) === key,
  );
  return set?.photos ?? [];
}

// ── Legacy prose fallback ────────────────────────────────────────

/**
 * Split a prose paragraph into readable chunks of at most `maxSentences`
 * sentences, for legacy days that have no structured stops. Manual scan
 * (no regex lookbehind — Hermes compatibility): a sentence ends at . ! ?
 * followed by whitespace and an uppercase/quote/paren opener.
 */
export function chunkProse(prose: string, maxSentences: number = 2): string[] {
  const text = (prose ?? '').trim();
  if (!text) return [];
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    // Consume trailing closers (quotes/parens) after the terminator.
    let j = i + 1;
    while (j < text.length && (text[j] === '"' || text[j] === '”' || text[j] === ')')) j++;
    // Sentence boundary only if followed by whitespace + an opener that
    // looks like a new sentence. Guards "St. Peter's" / "9 a.m. start".
    if (j >= text.length) {
      sentences.push(text.slice(start, j).trim());
      start = j;
    } else if (/\s/.test(text[j])) {
      let k = j;
      while (k < text.length && /\s/.test(text[k])) k++;
      const next = text[k];
      const prevWord = text.slice(start, i).split(/\s+/).pop() ?? '';
      // Abbreviation = a 1-2 letter word starting with a capital ("St.",
      // "Mt.", "Dr.", initials) — titlecase included, not just ALL-CAPS.
      const isAbbrev = ch === '.' && /^[A-Z][A-Za-z]?$/.test(prevWord);
      if (next && /[A-Z“"(‘']/.test(next) && !isAbbrev) {
        sentences.push(text.slice(start, j).trim());
        start = k;
        i = k - 1;
      }
    }
  }
  if (start < text.length) {
    const tail = text.slice(start).trim();
    if (tail) sentences.push(tail);
  }
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += maxSentences) {
    chunks.push(sentences.slice(i, i + maxSentences).join(' '));
  }
  return chunks;
}

// ── Proposal merging (chat / external rewrites) ──────────────────

const SLOT_PROSE_KEYS: readonly [StopSlot, keyof ItineraryDay][] = [
  ['morning', 'morning'],
  ['afternoon', 'afternoon'],
  ['evening', 'evening'],
];

/**
 * Carry structured stops across an itinerary rewrite that doesn't know
 * about them. The trip-chat endpoint (and any older rewriter) emits the
 * legacy day shape — writing its proposal verbatim would silently wipe
 * every day's stops. For each proposed day that lacks usable stops while
 * the current day has them, carry the current stops over per slot,
 * dropping only slots whose prose actually changed (the same staleness
 * rule EditDaySheet applies to manual edits). Proposals that DO carry
 * their own usable stops are trusted as-is.
 */
export function mergeStopsIntoProposal(
  current: ItineraryDay[],
  proposal: ItineraryDay[],
): ItineraryDay[] {
  return proposal.map((proposed, idx) => {
    if (!proposed || typeof proposed !== 'object') return proposed;
    if (hasStructuredStops(proposed)) return proposed;
    const match =
      current.find((c) => c?.day != null && proposed.day != null && c.day === proposed.day) ??
      current[idx];
    if (!match || !hasStructuredStops(match)) return proposed;
    const keptStops = (match.stops ?? []).filter((s) => {
      if (!isUsableStop(s)) return false;
      const proseKey = SLOT_PROSE_KEYS.find(([slot]) => slot === s.slot)?.[1];
      if (!proseKey) return false;
      const before = String(match[proseKey] ?? '').trim();
      const after = String(proposed[proseKey] ?? '').trim();
      return before === after;
    });
    if (keptStops.length === 0) return proposed;
    return { ...proposed, stops: keptStops };
  });
}

/**
 * Normalize a chat/refinement proposal into the FULL ordered itinerary.
 *
 * The trip-chat endpoint returns either the complete new plan (`replaceAll`
 * — used when the day count or order changed) or ONLY the days it edited
 * (`replaceAll === false` — the common "tweak day 2 / add an evening
 * activity" case, kept small so the model emits a fraction of the tokens and
 * the reply lands fast). Both normalize here into one ItineraryDay[] the
 * rest of the apply path (diff card, mergeStopsIntoProposal, updateTripField)
 * treats uniformly. A partial proposal replaces the matching `day` number and
 * leaves every other day untouched; a proposed day whose number doesn't exist
 * yet is appended in order. Without this, a partial proposal would read as
 * "every other day removed" to the diff card.
 */
export function mergeDayUpdates(
  current: ItineraryDay[],
  proposed: ItineraryDay[],
  replaceAll: boolean,
): ItineraryDay[] {
  if (replaceAll) return proposed;
  if (proposed.length === 0) return current;

  const proposedByDay = new Map<number, ItineraryDay>();
  for (const d of proposed) {
    if (d && typeof d.day === 'number') proposedByDay.set(d.day, d);
  }

  const merged: ItineraryDay[] = current.map((d) =>
    d && typeof d.day === 'number' && proposedByDay.has(d.day)
      ? (proposedByDay.get(d.day) as ItineraryDay)
      : d,
  );

  // Tolerate (don't lose) a day the model added through the partial channel,
  // even though replaceAll is the intended path for structural changes.
  const currentDayNums = new Set(
    current.map((d) => d?.day).filter((n): n is number => typeof n === 'number'),
  );
  const added = proposed
    .filter((d) => typeof d?.day === 'number' && !currentDayNums.has(d.day))
    .sort((a, b) => a.day - b.day);

  return added.length > 0 ? [...merged, ...added] : merged;
}

// ── Server-side dining normalization ─────────────────────────────

const clampStr = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/**
 * Normalize raw LLM dining output into a storable DiningGuide. Strict on
 * required fields (name/cuisine/price/area/why), forgiving on optional
 * ones (dropped or defaulted). Returns null when nothing usable survives —
 * the caller should mark the section failed rather than store an empty
 * guide. `duration` bounds the valid `days` range.
 */
export function normalizeDiningGuide(parsed: unknown, duration: number): DiningGuide | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;

  const intro = clampStr(raw.intro, 600);

  const mustTry: MustTryDish[] = Array.isArray(raw.mustTry)
    ? (raw.mustTry as unknown[])
        .map((m) => {
          if (!m || typeof m !== 'object') return null;
          const mt = m as Record<string, unknown>;
          const dish = clampStr(mt.dish, 80);
          const note = clampStr(mt.note, 200);
          return dish ? { dish, note } : null;
        })
        .filter((m): m is MustTryDish => m !== null)
        .slice(0, 8)
    : [];

  const spots: DiningSpot[] = Array.isArray(raw.spots)
    ? (raw.spots as unknown[])
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const sp = s as Record<string, unknown>;
          const name = clampStr(sp.name, 80);
          const cuisine = clampStr(sp.cuisine, 60);
          const area = clampStr(sp.area, 60);
          const why = clampStr(sp.why, 240);
          const price = PRICE_TIERS.includes(sp.price as PriceTier)
            ? (sp.price as PriceTier)
            : null;
          if (!name || !cuisine || !area || !why || !price) return null;
          // Dedup like `days` below — the LLM controls this array verbatim
          // and a duplicated tag would render duplicate day chips with
          // colliding React keys.
          const meals = Array.isArray(sp.meals)
            ? [
                ...new Set(
                  (sp.meals as unknown[]).filter((m): m is MealTag =>
                    MEAL_TAGS.includes(m as MealTag),
                  ),
                ),
              ]
            : [];
          const days = Array.isArray(sp.days)
            ? [
                ...new Set(
                  (sp.days as unknown[])
                    .map((d) => Number(d))
                    .filter((d) => Number.isInteger(d) && d >= 1 && d <= duration),
                ),
              ].sort((a, b) => a - b)
            : [];
          const crowd = CROWD_SIGNALS.includes(sp.crowd as CrowdSignal)
            ? (sp.crowd as CrowdSignal)
            : undefined;
          const knownFor = clampStr(sp.knownFor, 160);
          const walkNote = clampStr(sp.walkNote, 120);
          const spot: DiningSpot = {
            name,
            cuisine,
            price,
            area,
            knownFor,
            why,
            meals,
            ...(crowd ? { crowd } : {}),
            ...(days.length ? { days } : {}),
            ...(sp.reserveAhead === true ? { reserveAhead: true } : {}),
            ...(walkNote ? { walkNote } : {}),
          };
          return spot;
        })
        .filter((s): s is DiningSpot => s !== null)
        .slice(0, 24)
    : [];

  if (!intro && spots.length === 0) return null;
  if (spots.length === 0) return null;
  return { intro, mustTry, spots };
}

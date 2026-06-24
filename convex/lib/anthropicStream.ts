// convex/lib/anthropicStream.ts

import { captureAIGeneration, type AnthropicUsage } from "./posthog";

interface GenerateInput {
  countryCode: string;
  countryName: string;
  capital: string;
  duration: number;
  vibe: string;
  budget: string;
  interests: string;
  activityStyles: string[];
  travelParty: string;
  heldVisas: string[];
  /** ISO country codes of the traveler's passport(s), from onboarding.
   * Optional for back-compat with originalInputs saved before this field
   * existed — the prompts state assumptions explicitly when absent. */
  passports?: string[];
  startDate?: string;
  endDate?: string;
  companions?: string;
  /**
   * Free-text brief from the user — original text plus any refinement
   * answers merged in. Optional; absent or whitespace-only means no extra
   * context for the LLM.
   */
  userNotes?: string;
  /** True when this is a same-day-return day trip (duration is forced to 1).
   *  Routes itinerary generation through buildDayTripItineraryPrompt. */
  isDayTrip?: boolean;
  /** The chosen transport spine for a day trip — the hard timing anchors the
   *  single-day itinerary plans within. Present only when isDayTrip. */
  dayTrip?: {
    homeCity: string;
    destCity: string;
    transportMode: string;
    transportLabel: string;
    outboundDepart: string;
    outboundArrive: string;
    lastReturnDepart: string;
    returnArrive: string;
  };
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

/**
 * The shared system prompt prefix. Wrapped in a `cache_control: { type:
 * "ephemeral" }` block on each request so calls 2-5 read the cache at
 * 90% off input cost. 5-min TTL is well within our ~30s generation
 * window.
 */
export function buildSystemPrompt(input: GenerateInput): string {
  const trimmedNotes = input.userNotes?.trim();
  const userNotesBlock =
    trimmedNotes && trimmedNotes.length > 0
      ? `\n\nThe user has shared specific requests in their own words:\n"${trimmedNotes}"\n\nHonor these requests where they don't conflict with the structured fields above. The structured fields are the source of truth — country, duration, travel party, and dates are non-negotiable. The user's requests can refine scope (focus on specific cities), pace, interests, must-sees, and must-avoids. Where their requests are silent or ambiguous, use your judgment.`
      : "";

  return `You are a meticulous travel planner writing for a premium iOS app called Visa Atlas.

The user's trip:
- Destination: ${input.countryName} (${input.countryCode})
- Capital / primary city: ${input.capital}
- Duration: ${input.duration} days
- Travel party: ${input.travelParty}${input.companions ? ` (${input.companions})` : ""}
- Budget tier: ${input.budget}
- Vibe / pace: ${input.vibe}
- Interests: ${input.interests}
- Activity styles: ${input.activityStyles.join(", ") || "none specified"}
- Passport(s) held (ISO codes): ${input.passports?.length ? input.passports.join(", ") : "not specified"}
- Visas already held: ${input.heldVisas.join(", ") || "none"}
${input.startDate && input.endDate ? `- Dates: ${input.startDate} → ${input.endDate}` : "- Dates: flexible (\"dreaming\" mode)"}

Tone: editorial, specific, never generic. Recommend real places by name. Be concrete and actionable — name the specific dish, room, gate, street, or viewpoint, never the generic category. A reader should be able to act on every recommendation without a second search. Avoid clichés ("hidden gem", "must-see", "off the beaten path") and never write "explore", "wander", or "discover the area". Write the way the New York Times Travel section does — confident, particular, warm.${userNotesBlock}

Output: emit ONLY valid JSON for the requested section, no preamble, no markdown fences, no explanation. Match the schema exactly.`;
}

// ── Per-section instruction prompts ──────────────────────────────

export function buildItineraryUserPrompt(input: GenerateInput): string {
  const trimmedNotes = input.userNotes?.trim();
  const userNotesReminder =
    trimmedNotes && trimmedNotes.length > 0
      ? `\n\nRemember the user's specific requests as you plan each day:\n"${trimmedNotes}"`
      : "";

  return `Generate the day-by-day itinerary as a JSON array with exactly ${input.duration} elements. Each element matches:

{
  "title": "Editorial title — short, evocative, specific to the day's character",
  "subtitle": "ALL CAPS · KICKER · UNDER 5 WORDS",
  "heroSubject": "The single most photogenic place/landmark for this day, used to fetch the hero image",
  "morning": "1-2 sentences. The connective narrative for the morning — how the stops hang together, what the slot feels like. Do NOT repeat the stop notes verbatim.",
  "morningPlace": "The primary place name for morning",
  "afternoon": "1-2 sentences.",
  "afternoonPlace": "...",
  "evening": "1-2 sentences.",
  "eveningPlace": "...",
  "tip": "Optional one-sentence local tip. May be omitted.",
  "stops": [
    {
      "slot": "morning" | "afternoon" | "evening",
      "time": "09:00",
      "name": "Real place name — exact enough to find in Apple Maps",
      "note": "1-2 sentences naming what specifically to do here (a named dish, a named room/work, a specific viewpoint or route) — never generic 'explore the area'.",
      "kind": "landmark" | "museum" | "gallery" | "market" | "nature" | "walk" | "neighborhood" | "experience" | "cafe" | "viewpoint" | "beach" | "shopping",
      "duration": "1½ hrs",
      "area": "Specific neighbourhood or street, e.g. 'Trastevere, by Piazza di Santa Maria'",
      "tip": "Optional ONE concrete action — a named dish to order, the specific gate/entrance/platform, the exact viewpoint or trail, or what to see first. Omit if you have nothing concrete to add.",
      "reserveAhead": true
    }
  ]
}

Rules for "stops": 4-7 per day spread across the three slots (each slot gets at least one). Times are plausible 24h local starts in chronological order. Every stop is a real, currently-operating, NAMED place — never a category or a vague area. Set "area" to a specific micro-neighbourhood or street, not the city name. Use "tip" to name the signature thing to do (the dish to order, the room/work to see, the exact viewpoint, the gate to enter). Set "reserveAhead": true for anything needing a reservation or timed ticket. The morning/afternoon/evening prose must narrate the same plan the stops describe.

Emit ONLY the JSON array. No surrounding object, no preamble.${userNotesReminder}`;
}

/**
 * One compact line per day, fed into the dining prompt so restaurant
 * picks anchor to where the traveler actually is each day. Built from
 * the FINAL streamed itinerary (dining generation runs after the
 * itinerary settles).
 */
export interface DiningDayContext {
  day: number;
  title: string;
  places: string[];
}

export function buildDiningUserPrompt(
  input: GenerateInput,
  dayContexts: DiningDayContext[],
): string {
  const spotTarget = Math.min(Math.max(input.duration * 2, 8), 22);
  const dayLines = dayContexts
    .map((d) => `Day ${d.day} — ${d.title}: ${d.places.join(", ") || "city centre"}`)
    .join("\n");

  return `Curate the dining guide for this trip. Here is the traveler's day-by-day plan (the areas they'll actually be in):

${dayLines}

Output a JSON object with this exact shape:

{
  "intro": "2-3 editorial sentences on ${input.countryName}'s food scene, tuned to this traveler.",
  "mustTry": [
    { "dish": "Dish name", "note": "One sentence — what it is and where it shines." }
  ],
  "spots": [
    {
      "name": "Real restaurant name — exact enough to find in Apple Maps",
      "cuisine": "Short cuisine label, e.g. 'Roman trattoria'",
      "price": "$" | "$$" | "$$$" | "$$$$",
      "area": "Neighborhood / area name",
      "knownFor": "The signature order — 'Order the X.' One sentence.",
      "why": "One sentence tying it to THIS trip's vibe, party and budget.",
      "crowd": "local-favorite" | "institution" | "tourist-classic" | "new-wave",
      "meals": ["breakfast" | "lunch" | "dinner" | "snack", ...],
      "days": [2, 5],
      "reserveAhead": true,
      "walkNote": "Optional: '5-min walk from the Alcázar' — only when genuinely near a listed stop."
    }
  ]
}

Rules:
- "mustTry": 4-6 dishes.
- "spots": about ${spotTarget} entries. Real, well-established, currently-operating restaurants ONLY — when unsure a place still exists, pick a safer well-known one. NEVER invent ratings, review counts, or scores.
- "days" holds the 1-based day numbers (1-${input.duration}) whose plan puts the traveler near that spot. Every day of the trip must be covered by at least one lunch option and one dinner option. A spot may serve several days.
- Spread across price points around the ${input.budget} tier, mix crowd types, include at least one breakfast/cafe pick.
- "reserveAhead" only where booking genuinely matters; omit otherwise.

Output ONLY the JSON object. No preamble, no markdown fences.`;
}

export function buildVisaUserPrompt(input: GenerateInput): string {
  return `Generate visa information as a JSON object with this shape:

{
  "visaCategory": "visa-free" | "visa-on-arrival" | "e-visa" | "embassy" | "varies",
  "visaNotes": "1-2 sentences plain English summary",
  "visaChecklist": "[\\"Passport valid 6mo\\", \\"Onward ticket\\", ...]"  // JSON-stringified array of bullet items
}

${
  input.passports?.length
    ? `For holders of these passport(s) (ISO codes): ${input.passports.join(", ")} — adjusted for any held visas.`
    : `The traveler's passport is unknown — state your nationality assumption explicitly in visaNotes (e.g. "For most Western passports…").`
} Be concrete; cite typical durations and what's required at the border. Output ONLY the JSON object.`;
}

export function buildBudgetUserPrompt(input: GenerateInput): string {
  return `Generate budget information as a JSON object:

{
  "dailyBudget": "~$XXX/person/day for ${input.budget} tier",
  "budgetBreakdown": "[\\"Lodging: $X-Y/night\\", \\"Food: $X-Y/day\\", \\"Transit: $X-Y/day\\", \\"Activities: $X-Y/day\\"]"  // JSON-stringified array
}

Use real, current-ish prices for ${input.countryName} at the ${input.budget} tier. Output ONLY the JSON object.`;
}

export function buildHighlightsUserPrompt(input: GenerateInput): string {
  return `Generate the trip highlights — 4 to 6 short evocative pills the user will see at the top of their trip overview.

Output a JSON-stringified array of strings, each 2-5 words, each a specific named place or moment (not a category):

["Shibuya at dusk", "Fushimi Inari", "Tsukiji breakfast", "Onsen night"]

Output ONLY the JSON array.`;
}

export function buildTipsBundleUserPrompt(input: GenerateInput): string {
  return `Generate three sections at once as a JSON object:

{
  "packingSuggestions": "[\\"Item 1 with a short reason\\", \\"Item 2 ...\\", ...]"  // JSON-stringified array of 6-10 items
  "accommodationTips": "1-2 paragraphs. Where to stay by neighbourhood, what to look for, what to avoid.",
  "localEssentials": "[\\"Tip 1\\", \\"Tip 2\\", ...]"  // JSON-stringified array of 5-8 short tips
}

All content tailored to ${input.countryName}, ${input.budget} budget, ${input.travelParty} travel party. Output ONLY the JSON object.`;
}

/**
 * Generate country-level tips matching the LocalInfo shape from
 * data/localInfo.ts. Used to populate `countryTipsCache` for any
 * country not already in the handwritten static table.
 *
 * Country-level (NOT trip-level) — the shape is identical across
 * users so the result can be cached forever and reused. No
 * per-trip context is fed into the prompt; only the country itself.
 */
export function buildCountryTipsPrompt(
  countryCode: string,
  countryName: string,
): string {
  return `You are populating a country-level tips card for travellers visiting ${countryName} (${countryCode}). The shape below is the exact field layout the app expects — every field is required unless explicitly marked optional.

Output ONLY a JSON object with this shape (no preamble, no markdown fences):

{
  "emergencyNumber": "string — the all-purpose emergency number",
  "policeNumber": "string",
  "ambulanceNumber": "string",
  "fireNumber": "string",
  "ukEmbassy": {                                  // optional — omit the whole field if no UK embassy exists in-country
    "city": "string",
    "phone": "string",
    "address": "string",
    "website": "string — full URL"
  },
  "essentialApps": [                              // 3-5 entries — local ride-hailing, payments, transit, food delivery
    { "name": "string", "purpose": "string — one short phrase" }
  ],
  "tippingCulture": "string — 1-2 sentences on whether/how much to tip",
  "dressCode": "string — optional, only if there's a notable cultural / religious / climate consideration",
  "scamWarnings": [                               // optional — 2-4 short concrete warnings, omit the field if no notable scams
    "string"
  ],
  "localCustoms": [                               // optional — 2-4 short editorial customs worth knowing
    "string"
  ],
  "tapWater": "safe" | "unsafe" | "varies",
  "plugType": "string — letter(s), e.g. 'Type C/F (European)' or 'Type G (UK 3-pin)'",
  "simCard": "string — 1-2 sentences on best provider / where to buy",
  "currencyTip": "string — optional, only if there's a useful note (cash culture, exchange tips, ATM gotchas)"
}

Tone: factual, current, specific. Real numbers and real provider names. Editorial voice (NYT Travel). No clichés. Output ONLY the JSON object.`;
}

// ── Day trips: discovery + single-day itinerary ──────────────────

/** The home country anchor for day-trip discovery. */
export interface DayTripHome {
  /** Country name, e.g. "United Kingdom". */
  name: string;
  /** The realistic departure city, e.g. "London". */
  city: string;
  /** ISO currency code the cost-of-day is expressed in, e.g. "GBP". */
  currencyCode: string;
}

/** One Stage-1 candidate handed to the model (see utils/dayTripReach.ts). */
export interface DayTripCandidatePrompt {
  name: string;
  capital: string;
  km: number;
}

/**
 * System prompt for day-trip discovery. Country-level and identical across
 * users, so it's cacheable and the result is cached forever per home country.
 * The model is a transport-logistics authority — NOT a visa authority (visa
 * is computed by us, never the model).
 */
export function buildDayTripDiscoverySystemPrompt(): string {
  return `You are a meticulous travel-logistics expert for a premium iOS app called Visa Atlas. You know real scheduled-transport patterns cold — high-speed rail (Eurostar, TGV, Thalys/Eurostar, ICE, Frecciarossa, Shinkansen), short-haul flights (the typical first/last daily waves on easyJet/Ryanair/etc.), fast ferries (Dover–Calais, Holyhead–Dublin), and intercity coaches.

Your job: given a home city, decide where a traveller can realistically go for ONE DAY and be back home the SAME calendar day (leave in the morning, home before roughly midnight).

Hard rules:
- Be CONSERVATIVE and HONEST. If a same-day round trip is not genuinely realistic, OMIT it. A wrong "last train" could strand someone.
- NEVER invent exact train/flight numbers. Give realistic TYPICAL timings for that corridor (e.g. "first fast train ~06:50, last sensible return ~21:15"). These are estimates the user will confirm before booking.
- Exclude anything that leaves under ~4 usable hours at the destination — it isn't worth the day.
- Mark feasibility "tight" when margins are real (very early start, or the last return is the squeeze); "comfortable" otherwise.
- Do NOT mention visas, passports, borders, or entry requirements anywhere. Entry rules are computed separately. Stick to transport, timing, cost, season, and what to do.

Tone for the one-line "blurb": editorial, specific, warm — NYT Travel voice. Name the actual thing you'd do ("Lunch on the Grand-Place and home by dinner"), never clichés ("hidden gem", "explore").

Output: ONLY valid JSON, no preamble, no markdown fences. Match the requested schema exactly.`;
}

/**
 * User prompt for day-trip discovery. Asks for BOTH cross-border options
 * (drawn from the Stage-1 candidate shortlist) AND domestic day trips within
 * the home country itself (which the capital-distance pre-filter can't
 * surface). Returns a visa-agnostic array matching dayTripDestinationValidator
 * (minus visa, which we overlay per-user).
 */
export function buildDayTripDiscoveryUserPrompt(
  home: DayTripHome,
  candidates: DayTripCandidatePrompt[],
): string {
  const candidateLines = candidates.length
    ? candidates
        .map((c) => `- ${c.name} (nearest major city ${c.capital || "—"}, ~${c.km}km away)`)
        .join("\n")
    : "(none within same-day reach — focus on domestic options)";

  return `Home city: ${home.city}, ${home.name}.

Nearby foreign countries within same-day-return range (great-circle distance from the home capital — a coarse gate, you decide what's genuinely reachable):
${candidateLines}

Return a JSON array of the BEST same-day-return day trips from ${home.city}, each matching EXACTLY this shape:

{
  "destCode": "ISO 3166-1 alpha-2 code of the destination country, e.g. 'FR' (use the HOME country's code for domestic trips)",
  "destName": "Country name",
  "destCity": "The specific city/area you spend the day in, e.g. 'Paris' or 'Bath'",
  "scope": "international" | "domestic",
  "transportMode": "rail" | "flight" | "ferry" | "coach" | "road",
  "transportLabel": "Compact label, e.g. 'Eurostar · 2h20'",
  "outboundDepart": "Typical first sensible departure, home-city local 24h time, e.g. '06:50'",
  "outboundArrive": "Typical arrival, destination local 24h time",
  "lastReturnDepart": "The LAST realistic same-day return departure, destination local 24h time",
  "returnArrive": "Typical arrival back home, home-city local 24h time (may read after midnight)",
  "hoursOnGround": 8.5,
  "doorToDoorLabel": "e.g. '≈2h20 each way'",
  "costOfDay": 180,
  "currency": "${home.currencyCode}",
  "bestMonths": [4,5,6,9,10],
  "seasonNote": "Optional — only if season really matters, e.g. 'Ferry is rough Nov–Feb'",
  "feasibility": "comfortable" | "tight",
  "operator": "Optional main operator, e.g. 'Eurostar'",
  "bookingUrl": "Optional operator booking site, e.g. 'https://www.eurostar.com'",
  "blurb": "ONE editorial sentence — the specific hook for the day"
}

Rules:
- Include the genuinely same-day-returnable CROSS-BORDER options from the list above (omit the rest), AND 2-5 excellent DOMESTIC day trips within ${home.name} itself (scope "domestic", destCode = the home country's alpha-2 code, a real reachable city/area — NOT ${home.city} itself).
- "costOfDay" is a single rounded all-in per-person estimate in ${home.currencyCode}: return transport + a meal + one paid sight.
- "bestMonths" lists 1-12 month numbers when the trip is at its best; use [] if it's good year-round.
- Order BEST first (appeal vs effort; put "comfortable" ahead of "tight").
- Return 6-14 entries for a well-connected home; for a remote one return mostly or only domestic. If there is genuinely NO same-day foreign option, return domestic only — never pad with unrealistic ones.

Output ONLY the JSON array. No preamble, no markdown fences.`;
}

/**
 * Single-day itinerary prompt for a committed day trip. Emits a ONE-element
 * array in the standard ItineraryDay shape (so makeItineraryStreamParser and
 * the DayDeck render it unchanged), but bounded by the real transport spine:
 * it opens with a "transport" outbound stop, fills the on-ground window with
 * tightly-clustered stops, and closes with a "transport" return stop so the
 * plan can never strand the traveller past the last return.
 */
export function buildDayTripItineraryPrompt(input: GenerateInput): string {
  const dt = input.dayTrip;
  const trimmedNotes = input.userNotes?.trim();
  const notesReminder =
    trimmedNotes && trimmedNotes.length > 0
      ? `\n\nThe traveller asked specifically for:\n"${trimmedNotes}"\nHonour this where it fits the day.`
      : "";

  // Fallback anchors if meta is somehow absent (keeps generation robust).
  const homeCity = dt?.homeCity ?? "home";
  const destCity = dt?.destCity ?? input.capital;
  const arrive = dt?.outboundArrive ?? "10:00";
  const depart = dt?.outboundDepart ?? "07:00";
  const lastReturn = dt?.lastReturnDepart ?? "20:00";
  const returnArrive = dt?.returnArrive ?? "22:30";
  const modeLabel = dt?.transportLabel ?? "transport";

  return `Plan a SINGLE-DAY day trip from ${homeCity} to ${destCity}. The traveller leaves ${homeCity} and returns the SAME day.

Fixed transport spine (treat as hard constraints — do NOT plan anything outside this window):
- Depart ${homeCity}: ~${depart} (${modeLabel})
- Arrive ${destCity}: ~${arrive}
- LAST return from ${destCity}: ~${lastReturn} — the traveller MUST be heading back by then
- Arrive back ${homeCity}: ~${returnArrive}

Output a JSON array with EXACTLY ONE element matching:

{
  "title": "Editorial title for the day — evocative, specific to ${destCity}",
  "subtitle": "ALL CAPS · KICKER · UNDER 5 WORDS",
  "heroSubject": "The single most photogenic place in ${destCity} for the hero image",
  "morning": "1-2 sentences narrating the arrival + first stops.",
  "morningPlace": "Primary morning place",
  "afternoon": "1-2 sentences.",
  "afternoonPlace": "...",
  "evening": "1-2 sentences narrating the last bites/sight and heading back.",
  "eveningPlace": "...",
  "tip": "Optional one-sentence local tip for a day visit.",
  "stops": [
    {
      "slot": "morning" | "afternoon" | "evening",
      "time": "HH:MM",
      "name": "Real, named place — exact enough for Apple Maps",
      "note": "1-2 sentences: the SPECIFIC thing to do here and why it earns a slot on a short day.",
      "kind": "transport" | "landmark" | "museum" | "gallery" | "market" | "nature" | "walk" | "neighborhood" | "experience" | "cafe" | "viewpoint" | "shopping",
      "duration": "1 hr",
      "area": "Specific neighbourhood/street",
      "tip": "Optional ONE concrete action (a dish to order, the gate to use).",
      "reserveAhead": true
    }
  ]
}

Rules for "stops" (this is a tight day — make every hour count):
- The FIRST stop is the outbound leg: slot "morning", kind "transport", time "${depart}", name "${homeCity} → ${destCity}", note the mode + journey, area "${homeCity}".
- The LAST stop is the return leg: slot "evening", kind "transport", time "${lastReturn}", name "${destCity} → ${homeCity}", note "Head back for the last realistic return — home by ~${returnArrive}.", area "${destCity}".
- Between them, 4-6 real, NAMED stops, ALL within easy walking or a short metro/tram hop of the arrival point (no stop more than ~20 min from the centre — there is no time to range far). Times strictly chronological and inside ${arrive}–${lastReturn}.
- Include exactly one lunch stop (a real, named, currently-operating spot near the route) and, if time allows, a coffee/snack. Fold food into the stops — there is no separate dining guide for a day trip.
- Every stop concrete and currently-operating; name the specific thing to do, never "explore".

Emit ONLY the JSON array (one element). No preamble, no markdown fences.${notesReminder}`;
}

// ── SSE streaming over fetch ─────────────────────────────────────

interface StreamOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  /**
   * Optional PostHog LLM-analytics context. When present, the completion path
   * (success OR error) emits one `$ai_generation` event with the usage
   * accumulated off the SSE stream. Purely additive — never affects streaming
   * behavior (the capture is internally guarded and wrapped here too).
   */
  analytics?: {
    distinctId?: string;
    traceId: string;
    purpose: string;
    tripId?: string;
    planId?: string;
  };
}

interface StreamCallbacks {
  /** Fired for each text delta token. */
  onDelta: (text: string) => void;
  /** Fired once at end-of-stream regardless of success. */
  onComplete: () => void;
  /** Fired on transport / API errors. */
  onError: (err: Error) => void;
}

// Abort the stream if no bytes arrive for this long — a stalled SSE
// connection would otherwise hang the action until the platform kills it
// at the 10-minute cap, leaving the trip wedged in 'generating'.
const STREAM_STALL_TIMEOUT_MS = 90_000;
// Hard ceiling on any single stream, kept under Convex's 10-minute action
// limit so our own error path (mark section failed, settle) always runs.
const STREAM_TOTAL_TIMEOUT_MS = 8 * 60_000;

/**
 * Open a streaming POST to the Anthropic Messages API. Parses SSE,
 * extracts text deltas, and invokes onDelta as tokens arrive.
 *
 * The shared system prompt is wrapped in cache_control so subsequent
 * parallel calls within 5 minutes hit the cache at 90% input discount.
 */
export async function streamAnthropic(
  opts: StreamOptions,
  cb: StreamCallbacks,
): Promise<void> {
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), STREAM_STALL_TIMEOUT_MS);
  };
  const totalTimer = setTimeout(
    () => controller.abort(),
    STREAM_TOTAL_TIMEOUT_MS,
  );

  // ── Analytics accumulation (Task 1) ──────────────────────────────
  // Anthropic's streaming SSE carries token usage we'd otherwise discard:
  //   • message_start.message.usage → input/cache tokens + initial output
  //   • message_delta.usage.output_tokens → CUMULATIVE output (keep overwriting;
  //     the last value before stream end is the final total)
  // We track wall-clock latency from before the fetch and the HTTP status, then
  // emit ONE $ai_generation in the completion path (success or error). Capture
  // is best-effort: it never throws and is wrapped so it can't affect the stream.
  const startedAt = Date.now();
  const usage: AnthropicUsage = { inputTokens: 0, outputTokens: 0 };
  let httpStatus: number | undefined;
  let isError = false;
  let errorMessage: string | undefined;
  const reportAnalytics = async () => {
    if (!opts.analytics) return;
    try {
      await captureAIGeneration({
        ...opts.analytics,
        model: MODEL,
        usage,
        latencySeconds: (Date.now() - startedAt) / 1000,
        httpStatus,
        maxTokens: opts.maxTokens ?? 4096,
        isError,
        error: errorMessage,
      });
    } catch (err) {
      // Analytics must NEVER affect the stream's behavior.
      console.warn("[anthropicStream] analytics capture failed", String(err));
    }
  };

  try {
    armStallTimer();
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        system: [
          {
            type: "text",
            text: opts.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: opts.userPrompt }],
      }),
      signal: controller.signal,
    });

    httpStatus = response.status;

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "<no body>");
      throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      armStallTimer();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines
      let lineEnd: number;
      while ((lineEnd = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const json = dataLine.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta" &&
            typeof parsed.delta.text === "string"
          ) {
            cb.onDelta(parsed.delta.text);
          } else if (parsed.type === "message_start") {
            // Input + cache tokens are final at message_start; the initial
            // output_tokens is a placeholder that message_delta supersedes.
            // Guard every access — a malformed usage block must never throw.
            const u = parsed.message?.usage;
            if (u && typeof u === "object") {
              if (typeof u.input_tokens === "number") usage.inputTokens = u.input_tokens;
              if (typeof u.cache_creation_input_tokens === "number")
                usage.cacheCreationTokens = u.cache_creation_input_tokens;
              if (typeof u.cache_read_input_tokens === "number")
                usage.cacheReadTokens = u.cache_read_input_tokens;
              if (typeof u.output_tokens === "number") usage.outputTokens = u.output_tokens;
            }
          } else if (parsed.type === "message_delta") {
            // output_tokens here is CUMULATIVE — overwrite each time so the
            // last value before stream end is the final total.
            const u = parsed.usage;
            if (u && typeof u === "object" && typeof u.output_tokens === "number") {
              usage.outputTokens = u.output_tokens;
            }
          }
        } catch {
          // Malformed event line — skip
        }
      }
    }
    cb.onComplete();
  } catch (err) {
    isError = true;
    errorMessage = err instanceof Error ? err.message : String(err);
    cb.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
    clearTimeout(totalTimer);
    // Emit the single $ai_generation event AFTER the stream settles — both the
    // success (onComplete) and error (onError) paths land here. Awaited so the
    // event is sent before the action returns; never throws.
    await reportAnalytics();
  }
}

// ── Section parsers (consume token deltas, emit completed sections) ──

/**
 * Buffer all tokens; on completion, return the full trimmed string.
 * Used for visa, budget, highlights, tips-bundle — sections that don't
 * benefit from progressive emission (their content is short and JSON-
 * structured).
 */
export function makeWholeSectionBuffer(
  onDone: (full: string) => void,
  onErr: (err: Error) => void,
): StreamCallbacks {
  let buffer = "";
  return {
    onDelta: (text) => {
      buffer += text;
    },
    onComplete: () => onDone(buffer.trim()),
    onError: (err) => onErr(err),
  };
}

/**
 * Streaming parser for the itinerary array. Tracks bracket depth to
 * know when each top-level array element (one Day) closes, and emits
 * that day's JSON on completion.
 *
 * Why bracket counting and not a streaming JSON parser library? Keep
 * the dependency footprint tiny in Convex; the day shape is simple
 * enough that depth-tracking is reliable. We additionally validate via
 * JSON.parse before emission — a malformed slice never reaches the
 * patch mutation.
 */
export function makeItineraryStreamParser(
  onDayComplete: (dayIndex: number, dayJson: string) => void,
  onErr: (err: Error) => void,
): StreamCallbacks {
  let buffer = "";
  let inArray = false;
  let depth = 0; // depth WITHIN the array (objects/arrays nested in a day)
  let inString = false;
  let escapeNext = false;
  let dayStart = -1;
  let dayIndex = 0;

  return {
    onDelta: (text) => {
      for (const char of text) {
        const idx = buffer.length;
        buffer += char;

        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === "\\" && inString) {
          escapeNext = true;
          continue;
        }
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (!inArray) {
          if (char === "[") {
            inArray = true;
          }
          continue;
        }
        // we're in the array
        if (char === "{") {
          if (depth === 0) dayStart = idx;
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0 && dayStart !== -1) {
            const slice = buffer.slice(dayStart, idx + 1);
            try {
              JSON.parse(slice); // validate
              onDayComplete(dayIndex, slice);
            } catch (err) {
              onErr(new Error(`Malformed day ${dayIndex}: ${(err as Error).message}`));
            } finally {
              // Always advance — without this, every day after a malformed
              // one lands one index early and gets mislabeled with the
              // previous day's number.
              dayIndex++;
            }
            dayStart = -1;
          }
        }
      }
    },
    onComplete: () => {
      // No-op; per-day emission already happened. If the stream closed
      // mid-day, that day is silently dropped (will show up as missing
      // in the final array).
    },
    onError: (err) => onErr(err),
  };
}

// convex/lib/anthropicStream.ts

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
  startDate?: string;
  endDate?: string;
  companions?: string;
  /**
   * Free-text brief from the user — original text plus any refinement
   * answers merged in. Optional; absent or whitespace-only means no extra
   * context for the LLM.
   */
  userNotes?: string;
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
- Visas already held: ${input.heldVisas.join(", ") || "none"}
${input.startDate && input.endDate ? `- Dates: ${input.startDate} → ${input.endDate}` : "- Dates: flexible (\"dreaming\" mode)"}

Tone: editorial, specific, never generic. Recommend real places by name. Avoid clichés ("hidden gem", "must-see", "off the beaten path"). Write the way the New York Times Travel section does — confident, particular, warm.${userNotesBlock}

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
  "morning": "2-4 sentences. Specific recommendations with named places. Editorial tone.",
  "morningPlace": "The primary place name for morning",
  "afternoon": "2-4 sentences.",
  "afternoonPlace": "...",
  "evening": "2-4 sentences.",
  "eveningPlace": "...",
  "tip": "Optional one-sentence local tip. May be omitted."
}

Emit ONLY the JSON array. No surrounding object, no preamble.${userNotesReminder}`;
}

export function buildVisaUserPrompt(input: GenerateInput): string {
  return `Generate visa information as a JSON object with this shape:

{
  "visaCategory": "visa-free" | "visa-on-arrival" | "e-visa" | "embassy" | "varies",
  "visaNotes": "1-2 sentences plain English summary",
  "visaChecklist": "[\\"Passport valid 6mo\\", \\"Onward ticket\\", ...]"  // JSON-stringified array of bullet items
}

For US passport holders unless held visas suggest otherwise. Be concrete; cite typical durations and what's required at the border. Output ONLY the JSON object.`;
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

// ── SSE streaming over fetch ─────────────────────────────────────

interface StreamOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

interface StreamCallbacks {
  /** Fired for each text delta token. */
  onDelta: (text: string) => void;
  /** Fired once at end-of-stream regardless of success. */
  onComplete: () => void;
  /** Fired on transport / API errors. */
  onError: (err: Error) => void;
}

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
  try {
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
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "<no body>");
      throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
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
          }
        } catch {
          // Malformed event line — skip
        }
      }
    }
    cb.onComplete();
  } catch (err) {
    cb.onError(err instanceof Error ? err : new Error(String(err)));
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
              dayIndex++;
            } catch (err) {
              onErr(new Error(`Malformed day ${dayIndex}: ${(err as Error).message}`));
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

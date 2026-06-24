// convex/lib/dayPlanLLM.ts
//
// The LIVE WEB-GROUNDED generation step for the day planner. Unlike the trip
// generator (LLM-only editorial), this asks Claude to actually search the web
// (Reddit / TikTok mentions / blogs / "best of 2026" lists) for what people
// genuinely recommend near the user's start point, then return a routed,
// time-blocked day of REAL places — each carrying the source that recommends
// it. Coordinates are resolved separately by the geocoder (convex/lib/geo.ts);
// the LLM's job is the picks + the day shape, not the map facts.

import { captureAIGeneration, type AnthropicUsage } from "./posthog";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

export interface DayPlanInput {
  start: { lat: number; lng: number; label: string };
  transport: "car" | "transit" | "walk" | "cycle";
  reachMinutes: number;
  interests: string[];
  notes?: string;
  startTime?: string;
  date?: string;
}

const TRANSPORT_PHRASE: Record<DayPlanInput["transport"], string> = {
  car: "by car (they have a car)",
  transit: "by train / public transport",
  walk: "on foot",
  cycle: "by bike",
};

function reachPhrase(min: number): string {
  if (min < 45) return `up to about ${min} minutes`;
  const h = Math.round((min / 60) * 10) / 10;
  return `up to about ${h % 1 === 0 ? h : h.toFixed(1)} hour${h >= 2 ? "s" : ""} of travel each way`;
}

export function buildDayPlanSystem(): string {
  return `You are a meticulous local day planner for a premium iOS travel app. You plan a single brilliant DAY OUT from a specific starting point, grounded in what real people currently recommend.

How you work:
- USE WEB SEARCH to find what people actually rave about right now — pull from Reddit threads, TikTok/Instagram-famous spots, "best day trips/things to do 2026" lists, Time Out, local blogs, Michelin/Good Food guides. Prefer places confirmed by 2+ sources or a strong editorial source. Recency matters — favour 2025-2026.
- Plan a REAL routed day: a sensible geographic flow from morning to evening, paced for the chosen transport, ending back at the start. Cluster stops so travel between them is short. Include a proper lunch (and a coffee/snack or a drink to end) as real named places.
- Every place MUST be real and currently operating, named exactly enough to find on a map, and MUST carry a source URL from your searches. Never invent a place, an event, or opening hours. If you're not sure a place is still open, pick a safer well-known one.
- Be specific and editorial (NYT/Time Out voice): name the dish, the room, the view, the trail — never "explore" or "wander".

Output: when done searching, emit ONLY one JSON object (no preamble, no markdown fences) with this exact shape:
{
  "title": "Editorial title for the day, e.g. 'Oysters and big skies in Whitstable'",
  "summary": "1-2 sentences on the shape of the day.",
  "destArea": "The main town/area the day centres on (or the home city if it stays local), e.g. 'Whitstable'",
  "stops": [
    {
      "name": "Exact place name, findable on a map",
      "area": "Town / neighbourhood the place is in (helps map lookup)",
      "kind": "landmark | museum | gallery | market | nature | walk | viewpoint | beach | cafe | restaurant | pub | shopping | experience",
      "time": "HH:MM local arrival",
      "durationMin": 90,
      "why": "1-2 sentences: the SPECIFIC thing to do here and why it's worth it.",
      "source": { "label": "Time Out | r/london | Michelin | …", "url": "https://…" },
      "bookingNote": "Optional: reserve ahead / book timed entry, only if it genuinely matters",
      "approxLat": 51.36,
      "approxLng": 1.02
    }
  ]
}
Provide approxLat/approxLng as your best estimate (used only to disambiguate the map lookup). 5-7 stops for a full day; fewer if travel is long.`;
}

export function buildDayPlanUser(input: DayPlanInput): string {
  const interests = input.interests.length ? input.interests.join(", ") : "a great all-round day";
  const notes = input.notes?.trim();
  return `Plan a day out starting from: ${input.start.label} (lat ${input.start.lat.toFixed(4)}, lng ${input.start.lng.toFixed(4)}).
Getting around: ${TRANSPORT_PHRASE[input.transport]}.
How far they'll go: ${reachPhrase(input.reachMinutes)} — so the day can stay local or head out, as long as it's within that travel budget and they're home by evening.
The kind of day they want: ${interests}.
Day starts around: ${input.startTime ?? "09:00"}.${notes ? `\nIn their words: "${notes}"` : ""}

Search the web for what people genuinely recommend for this, then return the JSON day plan. Remember: every stop needs a real source URL, and the day must be realistically reachable and paced for ${TRANSPORT_PHRASE[input.transport]} within their travel budget.`;
}

export interface RawPlanStop {
  name: string;
  area?: string;
  kind?: string;
  time?: string;
  durationMin?: number;
  why?: string;
  source?: { label?: string; url?: string };
  bookingNote?: string;
  approxLat?: number;
  approxLng?: number;
}
export interface RawPlan {
  title?: string;
  summary?: string;
  destArea?: string;
  stops?: RawPlanStop[];
}

/** Pull the last balanced JSON object out of a blob of model text (web_search
 *  emits commentary before the final JSON). */
function extractLastJsonObject(text: string): string | null {
  const end = text.lastIndexOf("}");
  if (end === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = end; i >= 0; i--) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "}") depth++;
    else if (c === "{") {
      depth--;
      if (depth === 0) return text.slice(i, end + 1);
    }
  }
  return null;
}

/**
 * Run the web-grounded generation. Calls the Anthropic Messages API with the
 * native web_search tool, looping on `pause_turn`, and returns the parsed raw
 * plan. Throws on transport/parse failure (caller marks the plan failed).
 */
export async function generateGroundedPlan(
  apiKey: string,
  input: DayPlanInput,
  // Optional PostHog LLM-analytics context. The grounded plan can span several
  // `pause_turn` fetches; we sum usage across all of them into ONE event.
  analytics?: { distinctId?: string; traceId: string; purpose: string; planId?: string },
): Promise<RawPlan> {
  const system = buildDayPlanSystem();
  const userLoc = {
    type: "approximate" as const,
    city: input.start.label.split(",").slice(-2, -1)[0]?.trim() || undefined,
    country: "GB",
  };
  // Conversation we extend if the model pauses mid-search.
  const messages: Array<{ role: string; content: unknown }> = [
    { role: "user", content: buildDayPlanUser(input) },
  ];

  // Accumulate usage ACROSS every pause_turn fetch — each turn is a separate
  // billed Messages call, so the day plan's true cost is their sum (tokens add;
  // web_search_requests add). One $ai_generation reflects the whole plan.
  const startedAt = Date.now();
  const usage: AnthropicUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    webSearches: 0,
  };
  let httpStatus: number | undefined;

  let finalText = "";
  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 6,
            user_location: userLoc,
          },
        ],
        messages,
      }),
    });
    httpStatus = res.status;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      stop_reason?: string;
      content?: Array<Record<string, unknown>>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
        server_tool_use?: { web_search_requests?: number };
      };
    };
    // Sum this turn's usage into the running totals — guard every field so a
    // missing/odd usage block can never throw and break the plan.
    const u = json.usage;
    if (u && typeof u === "object") {
      if (typeof u.input_tokens === "number") usage.inputTokens += u.input_tokens;
      if (typeof u.output_tokens === "number") usage.outputTokens += u.output_tokens;
      if (typeof u.cache_read_input_tokens === "number")
        usage.cacheReadTokens = (usage.cacheReadTokens ?? 0) + u.cache_read_input_tokens;
      if (typeof u.cache_creation_input_tokens === "number")
        usage.cacheCreationTokens =
          (usage.cacheCreationTokens ?? 0) + u.cache_creation_input_tokens;
      const ws = u.server_tool_use?.web_search_requests;
      if (typeof ws === "number") usage.webSearches = (usage.webSearches ?? 0) + ws;
    }
    const blocks = json.content ?? [];
    finalText = blocks
      .filter((b) => b.type === "text")
      .map((b) => String((b as { text?: string }).text ?? ""))
      .join("\n");
    if (json.stop_reason === "pause_turn") {
      // Continue the turn: feed the assistant's partial content back.
      messages.push({ role: "assistant", content: blocks });
      continue;
    }
    break;
  }

  // Emit the single $ai_generation for the whole grounded plan. Internally
  // guarded / never throws — placed before parsing so usage reports even when
  // the model output turns out to be unparseable below.
  if (analytics) {
    await captureAIGeneration({
      ...analytics,
      model: MODEL,
      usage,
      latencySeconds: (Date.now() - startedAt) / 1000,
      httpStatus,
      maxTokens: 4096,
    });
  }

  const jsonStr = extractLastJsonObject(finalText);
  if (!jsonStr) throw new Error("Day plan: no JSON object in model output");
  const parsed = JSON.parse(jsonStr) as RawPlan;
  if (!parsed.stops?.length) throw new Error("Day plan: no stops produced");
  return parsed;
}

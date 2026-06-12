import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";
import type { Id } from "./_generated/dataModel";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

const QUESTION_CAP = 3;
// Hard ceiling on the Anthropic round-trip. Anything slower is treated as a
// failure and retried once; the client additionally has its own watchdog
// that surfaces the "generate without questions" fallback.
const FETCH_TIMEOUT_MS = 30_000;

export type RefinementQuestion = {
  id: string;
  prompt: string;
  type: "choice" | "text";
  options?: string[];
  multiSelect?: boolean;
  placeholder?: string;
  summarizePattern: string;
};

// Mirrors RefinementQuestion (and the `refinementSessions.questions` shape
// in schema.ts) so the internal action can hand validated questions to the
// finishing mutation.
const refinementQuestionValidator = v.object({
  id: v.string(),
  prompt: v.string(),
  type: v.union(v.literal("choice"), v.literal("text")),
  options: v.optional(v.array(v.string())),
  multiSelect: v.optional(v.boolean()),
  placeholder: v.optional(v.string()),
  summarizePattern: v.string(),
});

// Shared by `startAnalysis` (public mutation) and `runAnalysis` (internal
// action) — the mutation forwards its args verbatim to the scheduled action.
const analyzeArgs = {
  countryCode: v.string(),
  countryName: v.string(),
  duration: v.number(),
  vibes: v.array(v.string()),
  userNotes: v.string(),
};

const buildAnalyzeSystemPrompt = (args: {
  countryName: string;
  duration: number;
  vibes: string[];
  userNotes: string;
}) => `You are a thoughtful travel-planning assistant analyzing a user's trip brief to decide whether you need clarifying questions before generating their itinerary.

The user is planning a trip:
- Destination: ${args.countryName}
- Duration: ${args.duration} days
- Vibes selected: ${args.vibes.length > 0 ? args.vibes.join(", ") : "none"}

The user wrote this in their own words:
"${args.userNotes}"

YOUR JOB: decide whether to ask 0–3 clarifying questions.

ASK when:
- The brief mentions a category without specifics (e.g., "I like nature" — but what KIND of nature?).
- A preference has multiple plausible interpretations (active vs. relaxed; mountains vs. beaches; deep-dive vs. broad sampler).
- The user mentions something specific that you need a detail on to honor it well (e.g., "must include a special anniversary dinner" — what kind?).

DO NOT ASK when:
- The brief is already specific enough to plan a great trip on.
- The information is already covered by the structured fields above. NEVER ask about country, duration, party size, or dates.
- Asking would feel redundant or perfunctory.

CAP: ${QUESTION_CAP} questions max. Fewer is better. Each question must materially affect the itinerary. Rank highest-impact first — the client trims past ${QUESTION_CAP} if you exceed.

QUESTION FORMAT — pick per question based on what's natural:
- 'choice' for things with discrete answers (active vs. relaxed; nature types). Provide 2–5 options as standalone descriptive phrases — never "Yes"/"No". Set multiSelect: true if the user could reasonably want multiple.
- 'text' for things that benefit from prose (must-include places, special occasions, deal-breakers).

For each question, provide a summarizePattern:
- A short template that turns the answer into a brief lowercase fragment starting with a verb or preposition.
- {answer} placeholder is replaced with the lowercased option text (or typed text for 'text' questions). Proper nouns the user typed are preserved.
- For multi-select, {answer} expands to "X and Y" (2 picks) or "X, Y, and Z" (3+, Oxford comma).
- The pattern + options must read as natural English when interpolated. Pick options and pattern together so the merged prose flows.

Examples:
  Q: "What kind of nature draws you most?" (multi-select)
  options: ["mountains and hiking", "beaches and coast", "forests and wildlife"]
  pattern: "drawn to {answer}"

  Q: "Active or relaxed pace?" (single)
  options: ["an active pace", "a relaxed pace"]
  pattern: "preferring {answer}"

  Q: "Anything specific you want to include?" (text)
  pattern: "must include {answer}"

OUTPUT:
Return ONLY a JSON object matching this exact shape — no preamble, no markdown fences, no commentary:

{
  "questions": [
    {
      "id": "string",
      "prompt": "string",
      "type": "choice" | "text",
      "options": ["..."],            // present iff type==='choice'
      "multiSelect": true | false,   // present iff type==='choice'
      "placeholder": "string",       // present iff type==='text'
      "summarizePattern": "..."
    }
  ]
}

If no questions are warranted, return { "questions": [] }.`;

/**
 * Public entry point for the clarifying-questions flow.
 *
 * This is a MUTATION that schedules the LLM call — deliberately NOT an
 * action called from the client. The Convex client auto-retries mutations
 * across websocket reconnects, and the result lands in a `refinementSessions`
 * row the client subscribes to, so a token refresh / network blip / redeploy
 * mid-analysis can no longer kill the flow with "Connection lost while
 * action was in flight".
 */
export const startAnalysis = mutation({
  args: analyzeArgs,
  handler: async (ctx, args): Promise<Id<"refinementSessions">> => {
    const userId = await requireAuth(ctx);

    // A user only ever has one live analysis — drop stale rows so
    // dismiss-and-retry loops don't accumulate orphans.
    const stale = await ctx.db
      .query("refinementSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of stale) {
      await ctx.db.delete(doc._id);
    }

    const trimmed = args.userNotes.trim();
    if (trimmed.length === 0) {
      // Defensive: client shouldn't call with empty notes — resolve
      // immediately with zero questions instead of burning an LLM call.
      return await ctx.db.insert("refinementSessions", {
        userId,
        status: "ready",
        questions: [],
      });
    }
    // Same cap as generateTrip's stub handler — defense in depth against
    // unbounded LLM spend (the client caps the field at 500 chars).
    if (trimmed.length > 2000) {
      throw new Error("userNotes exceeds 2000 character limit");
    }

    // After the empty-notes early return (which burns no LLM call) and the
    // validation throw, so only real analyses count against the window.
    await checkRateLimit(ctx, userId, "startAnalysis", 10, HOUR_MS);

    const sessionId = await ctx.db.insert("refinementSessions", {
      userId,
      status: "pending",
    });
    await ctx.scheduler.runAfter(0, internal.tripRefinement.runAnalysis, {
      sessionId,
      countryCode: args.countryCode,
      countryName: args.countryName,
      duration: args.duration,
      vibes: args.vibes,
      userNotes: trimmed,
    });
    return sessionId;
  },
});

/**
 * Reactive readout for a refinement session. Returns null when the row no
 * longer exists (superseded by a newer `startAnalysis`) — the client treats
 * that the same as still-pending.
 */
export const getSession = query({
  args: { sessionId: v.id("refinementSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId !== userId) {
      throw new Error("Not authorized");
    }
    return {
      status: session.status,
      questions: session.questions,
      errorMessage: session.errorMessage,
    };
  },
});

/** Scheduled LLM call. Always settles the session row — success or error. */
export const runAnalysis = internalAction({
  args: { sessionId: v.id("refinementSessions"), ...analyzeArgs },
  handler: async (ctx, { sessionId, ...args }) => {
    try {
      const questions = await fetchQuestionsWithRetry(args);
      await ctx.runMutation(internal.tripRefinement.finishAnalysis, {
        sessionId,
        status: "ready",
        questions,
      });
    } catch (err) {
      await ctx.runMutation(internal.tripRefinement.finishAnalysis, {
        sessionId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

export const finishAnalysis = internalMutation({
  args: {
    sessionId: v.id("refinementSessions"),
    status: v.union(v.literal("ready"), v.literal("error")),
    questions: v.optional(v.array(refinementQuestionValidator)),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, status, questions, errorMessage }) => {
    const session = await ctx.db.get(sessionId);
    // Row deleted by a newer startAnalysis — this result is stale, drop it.
    if (!session) return;
    await ctx.db.patch(sessionId, { status, questions, errorMessage });
  },
});

// ── Anthropic call ───────────────────────────────────────────────

async function fetchQuestionsWithRetry(args: {
  countryName: string;
  duration: number;
  vibes: string[];
  userNotes: string;
}): Promise<RefinementQuestion[]> {
  try {
    return await fetchQuestions(args);
  } catch {
    // One retry covers transient blips (429/5xx/timeout). A second failure
    // settles the session as error, where the client offers "generate
    // without questions".
    return await fetchQuestions(args);
  }
}

async function fetchQuestions(args: {
  countryName: string;
  duration: number;
  vibes: string[];
  userNotes: string;
}): Promise<RefinementQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const systemPrompt = buildAnalyzeSystemPrompt(args);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `User notes: "${args.userNotes}". Analyze and return your questions JSON now.`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Anthropic API error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = body.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  return parseQuestionsResponse(text).slice(0, QUESTION_CAP);
}

function parseQuestionsResponse(raw: string): RefinementQuestion[] {
  const trimmed = raw.trim();
  // Strip optional code fences in case the model adds them despite instructions
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // If the model returned something we can't parse, treat as no questions
    // — the client falls through to direct generation.
    return [];
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("questions" in parsed)
  ) {
    return [];
  }
  const questions = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(questions)) return [];

  return questions.filter(isRefinementQuestion);
}

function isRefinementQuestion(value: unknown): value is RefinementQuestion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  if (typeof v.prompt !== "string") return false;
  if (v.type !== "choice" && v.type !== "text") return false;
  if (typeof v.summarizePattern !== "string") return false;
  if (v.type === "choice") {
    if (!Array.isArray(v.options)) return false;
    if (!v.options.every((o) => typeof o === "string")) return false;
  }
  return true;
}

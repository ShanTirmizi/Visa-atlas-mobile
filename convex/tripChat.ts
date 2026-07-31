// convex/tripChat.ts
//
// Durable trip-copilot replies. The worst offender of the aiProxy set:
// /api/trip-chat measured 111.3s against production for an itinerary rewrite
// (18.6 KB response). Holding a client websocket open for nearly two minutes,
// on a surface people background constantly, is a guaranteed hang — if the
// socket drops the action promise never settles, so neither .catch nor
// `finally { setIsSending(false) }` ever runs.
//
// Shape (matches comparisons.ts / aiJobs.ts, and the RAG branch's plan for
// visaGuideMessages):
//
//   sendMessage (mutation)      → insert the user turn AND an assistant row
//                                 marked "thinking" in ONE transaction, then
//                                 schedule. A user message with no reply slot
//                                 is unrepresentable.
//   runTripChat (internalAction)→ call the endpoint, fill the assistant row in
//   existing getMessages query  → the client already subscribes to it
//
// The client reads `status` off the assistant row instead of holding local
// isSending state, so a dropped socket costs a re-subscribe, not a dead thread.
//
// aiProxy.tripChat stays until builds 1.0 / 1.0.1 / 1.0.2 leave user devices.

import { v } from "convex/values";
import {
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { checkTripPermission } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";
import { AI_WATCHDOG_MS } from "./lib/aiFetch";
import { captureAIGeneration } from "./lib/posthog";

// Anthropic direct — same constants tripRefinement/tripGeneration already use.
// The old path went client → Convex → visa-atlas.vercel.app → Anthropic. That
// middle hop is what broke: /api/trip-chat regenerates the whole itinerary on
// every turn and never returned for a real trip, dying at Vercel's own 300s
// gateway limit. Going straight to Anthropic removes the hop, the extra
// latency, and that gateway ceiling.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_TIMEOUT_MS = 120_000;

const UPSTREAM_ERROR_MESSAGE =
  "Couldn't reach the copilot just now — tap retry.";

/** How much history the endpoint gets. Matches the previous client-side
 *  `.slice(-10)` so replies keep the same context window. */
const HISTORY_LIMIT = 10;

/**
 * Drop `stops` from each day before sending the itinerary upstream.
 *
 * Not an optimization — a correctness fix. Measured on a real 8-day trip:
 *
 *   full itinerary  24,628 chars → HTTP 504 after 300s (never returns)
 *   stops stripped   8,173 chars → HTTP 200 in 114s
 *
 * `stops` is 67% of the payload and is per-stop detail the chat endpoint
 * doesn't reason over — it works on the morning/afternoon/evening prose, all
 * of which is preserved here. Dropping it is what takes trip chat from
 * permanently broken on real trips to working.
 *
 * Safe because the client already re-attaches stops: applyItineraryUpdate runs
 * mergeStopsIntoProposal (types/itinerary.ts), which copies stops back from the
 * current itinerary for any day whose slot prose is unchanged. The endpoint has
 * always been free to return days without stops; this just stops us paying to
 * send them in the first place.
 */
function compactItinerary(raw: string | undefined): string {
  if (!raw) return "[]";
  try {
    const days: unknown = JSON.parse(raw);
    if (!Array.isArray(days)) return raw;
    return JSON.stringify(
      days.map((d) => {
        if (!d || typeof d !== "object") return d;
        const { stops: _stops, ...rest } = d as Record<string, unknown>;
        return rest;
      }),
    );
  } catch {
    // Unparseable itinerary — forward it untouched rather than losing context.
    return raw;
  }
}

// ── Public mutation ──────────────────────────────────────────────

export const sendMessage = mutation({
  args: {
    tripId: v.id("trips"),
    content: v.string(),
    sessionId: v.optional(v.id("tripChatSessions")),
    passports: v.array(v.string()),
    residence: v.union(v.string(), v.null()),
  },
  returns: v.id("tripMessages"),
  handler: async (ctx, args): Promise<Id<"tripMessages">> => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");
    await checkRateLimit(ctx, userId, "aiProxy:tripChat", 30, HOUR_MS);

    const user = await ctx.db.get(userId);

    // Only honour a sessionId that actually belongs to this trip.
    let sessionId = args.sessionId;
    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.tripId !== args.tripId) sessionId = undefined;
    }

    const now = Date.now();

    await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      sessionId,
      role: "user",
      content: args.content,
      timestamp: now,
      userId,
      userName: user?.name ?? undefined,
      status: "ready",
    });

    // The reply slot, created in the same transaction as the prompt.
    const assistantMessageId = await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      sessionId,
      role: "assistant",
      content: "",
      // +1 so ordering by timestamp always puts the reply after its prompt.
      timestamp: now + 1,
      status: "thinking",
    });

    // Session bookkeeping — mirrors trips.addMessage: freshness drives history
    // ordering, the first user turn titles the thread, and the count is
    // denormalized. Counts both rows, since both are real messages.
    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      if (session) {
        const patch: {
          lastMessageAt: number;
          title?: string;
          messageCount: number;
        } = {
          lastMessageAt: now,
          messageCount: (session.messageCount ?? 0) + 2,
        };
        if (!session.title) patch.title = args.content.trim().slice(0, 80);
        await ctx.db.patch(sessionId, patch);
      }
    }

    await ctx.scheduler.runAfter(0, internal.tripChat.runTripChat, {
      tripId: args.tripId,
      assistantMessageId,
      userMessage: args.content,
      passports: args.passports,
      residence: args.residence,
    });

    // Backstop. If the action is killed outright — runtime timeout, a deploy
    // mid-flight, an unhandled crash — its catch never runs and the row would
    // sit on "thinking" forever. This sweeps it to "failed" so the client can
    // offer a retry instead of spinning.
    await ctx.scheduler.runAfter(AI_WATCHDOG_MS, internal.tripChat._watchdog, {
      messageId: assistantMessageId,
    });

    return assistantMessageId;
  },
});

/** Clears a stuck or failed reply so the thread isn't left with a dead row.
 *  The client calls this before re-sending on retry. */
export const discardMessage = mutation({
  args: { messageId: v.id("tripMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const row = await ctx.db.get(messageId);
    if (!row) return null;
    await checkTripPermission(ctx, row.tripId, "viewer");
    // Only ever remove an unfinished assistant row — never a real reply.
    if (row.role !== "assistant" || row.status === "ready") return null;

    // Also drop the prompt this reply belonged to. Retry re-sends that text,
    // so leaving it behind renders the user's message twice in the thread.
    const preceding = await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", row.tripId))
      .order("desc")
      .take(20);
    const orphanPrompt = preceding.find(
      (m) =>
        m.role === "user" &&
        m.sessionId === row.sessionId &&
        m.timestamp < row.timestamp,
    );

    await ctx.db.delete(messageId);
    if (orphanPrompt) await ctx.db.delete(orphanPrompt._id);
    return null;
  },
});

// ── Internal plumbing ────────────────────────────────────────────

export const _getChatContext = internalQuery({
  args: {
    tripId: v.id("trips"),
    assistantMessageId: v.id("tripMessages"),
  },
  handler: async (ctx, { tripId, assistantMessageId }) => {
    const trip = await ctx.db.get(tripId);
    const assistant = await ctx.db.get(assistantMessageId);
    if (!trip || !assistant) return null;

    // History from the same thread, excluding the empty placeholder we're
    // about to fill (an empty assistant turn would confuse the model).
    const recent = await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .order("desc")
      .take(HISTORY_LIMIT + 5);

    const history = recent
      .filter(
        (m) =>
          m._id !== assistantMessageId &&
          m.sessionId === assistant.sessionId &&
          m.content.length > 0,
      )
      .reverse()
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));

    return { trip, history };
  },
});

export const _completeMessage = internalMutation({
  args: {
    messageId: v.id("tripMessages"),
    content: v.string(),
    itineraryUpdate: v.optional(v.string()),
    replaceAll: v.optional(v.boolean()),
  },
  handler: async (ctx, { messageId, content, itineraryUpdate, replaceAll }) => {
    await ctx.db.patch(messageId, {
      content,
      status: "ready",
      itineraryUpdate,
      replaceAll,
    });
  },
});

/** No-op unless the row is still unfinished past the deadline. */
export const _watchdog = internalMutation({
  args: { messageId: v.id("tripMessages") },
  handler: async (ctx, { messageId }) => {
    const row = await ctx.db.get(messageId);
    if (!row || row.status !== "thinking") return;
    console.error(`tripChat watchdog: ${messageId} never finished`);
    await ctx.db.patch(messageId, {
      status: "failed",
      errorMessage: UPSTREAM_ERROR_MESSAGE,
    });
  },
});

export const _failMessage = internalMutation({
  args: { messageId: v.id("tripMessages"), errorMessage: v.string() },
  handler: async (ctx, { messageId, errorMessage }) => {
    await ctx.db.patch(messageId, { status: "failed", errorMessage });
  },
});

// ── The action ───────────────────────────────────────────────────

export const runTripChat = internalAction({
  args: {
    tripId: v.id("trips"),
    assistantMessageId: v.id("tripMessages"),
    userMessage: v.string(),
    passports: v.array(v.string()),
    residence: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  // Explicit return types: this handler references `internal.tripChat` — its
  // own module — which otherwise makes inference circular (TS7022/TS7023).
  handler: async (ctx, args): Promise<null> => {
    const fail = async (logDetail: string): Promise<null> => {
      console.error(`runTripChat ${args.assistantMessageId}: ${logDetail}`);
      await ctx.runMutation(internal.tripChat._failMessage, {
        messageId: args.assistantMessageId,
        errorMessage: UPSTREAM_ERROR_MESSAGE,
      });
      return null;
    };

    try {
      const ctxData: {
        trip: Doc<"trips">;
        history: { role: string; content: string }[];
      } | null = await ctx.runQuery(internal.tripChat._getChatContext, {
        tripId: args.tripId,
        assistantMessageId: args.assistantMessageId,
      });
      if (!ctxData) return fail("trip or message row missing");

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return fail("ANTHROPIC_API_KEY env var is not set");

      const { trip, history } = ctxData;

      // Edit-only contract. The old Vercel route regenerated the whole
      // itinerary on every turn — that is why a one-line weather question came
      // back as 18.9 KB and why it timed out. Here the model is told to answer
      // in prose and touch the itinerary ONLY when asked, returning just the
      // days it changed. replaceAll:false makes the client merge by day number
      // (mergeDayUpdates), so untouched days keep their existing content.
      const system = [
        "You are the trip copilot inside Visa Atlas, editing a saved itinerary.",
        "",
        `TRIP: ${trip.countryName ?? ""} · ${trip.duration ?? 0} days · base ${trip.capital ?? ""}`,
        `Budget ${trip.dailyBudget ?? "n/a"} · currency ${trip.currency ?? "n/a"} · visa ${trip.visaCategory ?? "n/a"}`,
        trip.companions ? `Travelling: ${trip.companions}` : "",
        args.passports.length ? `Passports: ${args.passports.join(", ")}` : "",
        args.residence ? `Resident in: ${args.residence}` : "",
        "",
        "CURRENT ITINERARY (JSON, one object per day):",
        compactItinerary(trip.itinerary),
        "",
        "Reply with ONE JSON object and nothing else:",
        '{"reply": string, "itineraryUpdate": array|null, "replaceAll": false}',
        "",
        "- `reply`: your answer, 1-3 short paragraphs, warm and specific. Always required.",
        "- `itineraryUpdate`: ONLY when the user asked you to change the plan.",
        "  Otherwise null. Never rewrite days you were not asked about.",
        "  Include ONLY the day objects you changed, each keeping its `day`",
        "  number and the same field names as above.",
        "- `replaceAll`: always false.",
        "",
        "A question about weather, cost, or advice is NOT an edit request —",
        "answer it in `reply` and set `itineraryUpdate` to null.",
      ]
        .filter(Boolean)
        .join("\n");

      const messages = [
        ...history.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        { role: "user", content: args.userMessage },
      ];

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 4096,
            system,
            messages,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        return fail(`anthropic fetch failed: ${String(err)}`);
      } finally {
        clearTimeout(timer);
      }

      const text = await res.text();
      if (!res.ok) return fail(`anthropic ${res.status}: ${text.slice(0, 300)}`);

      let payload: {
        content?: { type: string; text?: string }[];
        usage?: Record<string, number | undefined>;
      };
      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {
        return fail(`non-JSON anthropic response: ${text.slice(0, 300)}`);
      }

      // Cost telemetry, same as every other LLM call in this codebase.
      await captureAIGeneration({
        traceId: String(args.assistantMessageId),
        purpose: "trip-chat",
        model: MODEL,
        usage: {
          inputTokens: payload.usage?.input_tokens ?? 0,
          outputTokens: payload.usage?.output_tokens ?? 0,
          cacheReadTokens: payload.usage?.cache_read_input_tokens,
          cacheCreationTokens: payload.usage?.cache_creation_input_tokens,
        },
      }).catch(() => {});

      const raw = (payload.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("")
        .trim();

      // Tolerate a ```json fence or stray prose around the object.
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      let data: {
        reply?: string;
        itineraryUpdate?: unknown;
        replaceAll?: boolean;
      } = {};
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
          data = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as typeof data;
        } catch {
          // Fall through — treat the whole thing as a plain-text reply.
        }
      }
      if (!data.reply) data.reply = raw;

      if (!data.reply) return fail("empty reply");

      // itineraryUpdate arrives as a parsed array — the client expects the
      // JSON string form it always got from the proxy.
      const itineraryUpdate =
        Array.isArray(data.itineraryUpdate) && data.itineraryUpdate.length > 0
          ? JSON.stringify(data.itineraryUpdate)
          : undefined;

      await ctx.runMutation(internal.tripChat._completeMessage, {
        messageId: args.assistantMessageId,
        content: data.reply,
        itineraryUpdate,
        // Always a partial day set now, so the client merges by day number
        // instead of replacing the whole plan.
        replaceAll: itineraryUpdate ? false : undefined,
      });
      return null;
    } catch (err) {
      return fail(`unhandled: ${String(err)}`);
    }
  },
});

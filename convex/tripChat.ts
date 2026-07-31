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
import { aiFetch, AI_WATCHDOG_MS } from "./lib/aiFetch";

const API_BASE = "https://visa-atlas.vercel.app";

const UPSTREAM_ERROR_MESSAGE =
  "Couldn't reach the copilot just now — tap retry.";

/** How much history the endpoint gets. Matches the previous client-side
 *  `.slice(-10)` so replies keep the same context window. */
const HISTORY_LIMIT = 10;

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

      const secret = process.env.AI_PROXY_SECRET;
      if (!secret) return fail("AI_PROXY_SECRET env var is not set");

      const { trip, history } = ctxData;
      const body = JSON.stringify({
        message: args.userMessage,
        tripContext: {
          countryName: trip.countryName ?? "",
          duration: trip.duration ?? 0,
          region: trip.region ?? "",
          capital: trip.capital ?? "",
          currency: trip.currency ?? "",
          dailyBudget: trip.dailyBudget ?? "",
          visaCategory: trip.visaCategory ?? "",
          companions: trip.companions ?? undefined,
        },
        currentItinerary: trip.itinerary ?? "[]",
        chatHistory: history,
        passports: args.passports,
        residence: args.residence,
      });

      let res: Response;
      try {
        res = await aiFetch(`${API_BASE}/api/trip-chat`, secret, body);
      } catch (err) {
        // Includes AiFetchTimeout. Without the deadline the Convex runtime
        // would kill this action at 5 minutes and `fail` would never run.
        return fail(`fetch failed: ${String(err)}`);
      }

      const text = await res.text();
      if (!res.ok) return fail(`upstream ${res.status}: ${text.slice(0, 300)}`);

      let data: {
        reply?: string;
        itineraryUpdate?: string | null;
        replaceAll?: boolean;
      };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        return fail(`non-JSON response: ${text.slice(0, 300)}`);
      }
      if (!data.reply) return fail("empty reply");

      await ctx.runMutation(internal.tripChat._completeMessage, {
        messageId: args.assistantMessageId,
        content: data.reply,
        itineraryUpdate: data.itineraryUpdate ?? undefined,
        replaceAll: data.replaceAll,
      });
      return null;
    } catch (err) {
      return fail(`unhandled: ${String(err)}`);
    }
  },
});

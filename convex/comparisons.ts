// convex/comparisons.ts
//
// Country comparison generation, on the canonical durable path:
//
//   generateComparison (mutation)  → insert a `generating` row, schedule the
//                                    action, return the id immediately
//   runComparison (internalAction) → forward to the Vercel /api/compare route,
//                                    write the result back
//   getComparison (query)          → what the client actually subscribes to
//
// Why not `useAction(api.aiProxy.compare)` (the previous shape): the compare
// endpoint takes ~25s, and a client-called Convex action rides the websocket
// for its whole duration. Background the app, lock the screen, or hand off
// between wifi and cellular inside that window and the promise NEVER settles —
// neither resolve nor reject — so the caller's loading flag sticks forever.
// That was the "GENERATING COMPARISON" spinner that never finished.
//
// Here the client's only round trip is a fast mutation. The 25s of work happens
// server-side, and the result arrives through a reactive query that re-subscribes
// on its own after any reconnect. Same pattern as trip generation and dayPlanner
// (see CLAUDE.md: mutation → scheduler → reactive query, never client useAction).

import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";
import { aiFetch, AI_WATCHDOG_MS } from "./lib/aiFetch";

const API_BASE = "https://visa-atlas.vercel.app";

// Generic, user-safe copy — upstream detail is logged, never surfaced.
const UPSTREAM_ERROR_MESSAGE =
  "The travel service is briefly unavailable — please try again.";

/** How long a finished comparison stays reusable. Re-opening the same pair
 *  inside this window is instant and costs no LLM credits. */
const REUSE_MS = 24 * 60 * 60 * 1000;

/** A row stuck in `generating` past this is treated as dead, not in-flight, so
 *  a crashed action can't wedge the pair forever. */
const STALE_GENERATING_MS = 3 * 60 * 1000;

// ── Public mutation ──────────────────────────────────────────────

export const generateComparison = mutation({
  args: {
    codeA: v.string(),
    codeB: v.string(),
    /** Raw JSON body forwarded to the Vercel route byte-for-byte, so that
     *  endpoint needs no request-shape change. */
    payload: v.string(),
    /** Set by the retry affordance — skips reuse and forces a fresh call. */
    force: v.optional(v.boolean()),
  },
  returns: v.id("comparisons"),
  handler: async (ctx, { codeA, codeB, payload, force }) => {
    const userId = await requireAuth(ctx);

    if (!force) {
      const existing = await ctx.db
        .query("comparisons")
        .withIndex("by_user_and_pair", (q) =>
          q.eq("userId", userId).eq("codeA", codeA).eq("codeB", codeB),
        )
        .order("desc")
        .first();

      if (existing) {
        const age = Date.now() - existing.createdAt;
        // Match on the payload, not just the country pair — passports and
        // residence feed the prompt, so a profile change must not be served
        // a stale answer.
        const samePayload = existing.payload === payload;
        if (existing.status === "ready" && samePayload && age < REUSE_MS) {
          return existing._id;
        }
        // Coalesce duplicate in-flight requests (React strict-mode double
        // effects, a fast A/B swap and swap back) onto one generation.
        if (
          existing.status === "generating" &&
          samePayload &&
          age < STALE_GENERATING_MS
        ) {
          return existing._id;
        }
      }
    }

    // Only metered when we're actually going to call the LLM — a reused
    // result shouldn't spend the user's hourly budget.
    await checkRateLimit(ctx, userId, "aiProxy:compare", 20, HOUR_MS);

    const comparisonId = await ctx.db.insert("comparisons", {
      userId,
      codeA,
      codeB,
      status: "generating",
      payload,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.comparisons.runComparison, {
      comparisonId,
    });
    // Backstop for an action killed outright — see convex/lib/aiFetch.ts.
    await ctx.scheduler.runAfter(
      AI_WATCHDOG_MS,
      internal.comparisons._watchdog,
      { comparisonId },
    );
    return comparisonId;
  },
});

// ── Reactive read ────────────────────────────────────────────────

export const getComparison = query({
  args: { comparisonId: v.id("comparisons") },
  handler: async (ctx, { comparisonId }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(comparisonId);
    if (!row || row.userId !== userId) return null;
    // Deliberately not returning the whole doc — `payload` is request echo the
    // client already has and would only bloat every subscription update.
    return {
      _id: row._id,
      status: row.status,
      result: row.result,
      errorMessage: row.errorMessage,
    };
  },
});

// ── Internal plumbing ────────────────────────────────────────────

export const _getComparison = internalQuery({
  args: { comparisonId: v.id("comparisons") },
  handler: async (ctx, { comparisonId }) => ctx.db.get(comparisonId),
});

export const _writeComparison = internalMutation({
  args: { comparisonId: v.id("comparisons"), result: v.string() },
  handler: async (ctx, { comparisonId, result }) => {
    await ctx.db.patch(comparisonId, { status: "ready", result });
  },
});

/** No-op unless the comparison is still unfinished past the deadline. */
export const _watchdog = internalMutation({
  args: { comparisonId: v.id("comparisons") },
  handler: async (ctx, { comparisonId }) => {
    const row = await ctx.db.get(comparisonId);
    if (!row || row.status !== "generating") return;
    console.error(`comparisons watchdog: ${comparisonId} never finished`);
    await ctx.db.patch(comparisonId, {
      status: "failed",
      errorMessage: UPSTREAM_ERROR_MESSAGE,
    });
  },
});

export const _failComparison = internalMutation({
  args: { comparisonId: v.id("comparisons"), errorMessage: v.string() },
  handler: async (ctx, { comparisonId, errorMessage }) => {
    await ctx.db.patch(comparisonId, { status: "failed", errorMessage });
  },
});

// ── The action ───────────────────────────────────────────────────

export const runComparison = internalAction({
  args: { comparisonId: v.id("comparisons") },
  handler: async (ctx, { comparisonId }) => {
    const fail = async (logDetail: string) => {
      console.error(`runComparison ${comparisonId}: ${logDetail}`);
      await ctx.runMutation(internal.comparisons._failComparison, {
        comparisonId,
        errorMessage: UPSTREAM_ERROR_MESSAGE,
      });
    };

    try {
      const row = await ctx.runQuery(internal.comparisons._getComparison, {
        comparisonId,
      });
      if (!row) return;

      const secret = process.env.AI_PROXY_SECRET;
      if (!secret) return fail("AI_PROXY_SECRET env var is not set");

      let res: Response;
      try {
        res = await aiFetch(`${API_BASE}/api/compare`, secret, row.payload);
      } catch (err) {
        // Includes AiFetchTimeout — without it the runtime would kill this
        // action at 5 minutes and leave the row stuck on "generating".
        return fail(`fetch failed: ${String(err)}`);
      }

      const text = await res.text();
      if (!res.ok) {
        return fail(`upstream ${res.status}: ${text.slice(0, 300)}`);
      }

      // Parse to validate before storing — a malformed body should surface as
      // a failed comparison, not as a client-side JSON.parse crash later.
      try {
        JSON.parse(text);
      } catch {
        return fail(`non-JSON response: ${text.slice(0, 300)}`);
      }

      await ctx.runMutation(internal.comparisons._writeComparison, {
        comparisonId,
        result: text,
      });
    } catch (err) {
      await fail(`unhandled: ${String(err)}`);
    }
  },
});

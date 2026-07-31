// convex/aiJobs.ts
//
// Durable one-shot AI generations. Same shape as convex/comparisons.ts —
// mutation → scheduler → reactive query — but generic over `kind`, because
// Surprise Me and visa-guide generation are structurally identical: one
// request, one result, consumed once.
//
// Why this exists: these were called with useAction(api.aiProxy.*), which
// holds the websocket open for the whole request. Measured against production:
//
//   visa-guide  57.7s
//   surprise     3.0s
//
// A client-called action that never settles — the app is backgrounded, the
// screen locks, wifi hands off to cellular — leaves the caller's promise
// dangling forever. Neither .then nor .catch runs, so a `finally { setLoading
// (false) }` never fires either. That is the bug that stranded the Compare tab
// on "GENERATING COMPARISON", and at ~58s visa-guide is more exposed than
// compare was at 25s.
//
// Here the client's only round trip is a fast mutation. The wait happens
// server-side and the result arrives over a subscription that re-establishes
// itself after any reconnect.
//
// aiProxy.ts stays in place: builds 1.0 / 1.0.1 are on user devices and still
// call it. It can go once those are gone.

import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";

const API_BASE = "https://visa-atlas.vercel.app";

const UPSTREAM_ERROR_MESSAGE =
  "The travel service is briefly unavailable — please try again.";

const kindValidator = v.union(v.literal("surprise"), v.literal("visaGuide"));

/** Route + hourly budget per kind. Mirrors LIMITS in convex/aiProxy.ts so the
 *  two paths meter identically while both are live. */
const KINDS = {
  surprise: { route: "surprise", key: "aiProxy:surprise", max: 10 },
  visaGuide: { route: "visa-guide", key: "aiProxy:visaGuide", max: 5 },
} as const;

type Kind = keyof typeof KINDS;

/** A job stuck in `generating` past this is treated as dead rather than
 *  in-flight, so a crashed action can't wedge a retry. Generous — visa-guide
 *  legitimately runs about a minute. */
const STALE_GENERATING_MS = 5 * 60 * 1000;

// ── Public mutation ──────────────────────────────────────────────

export const startJob = mutation({
  args: { kind: kindValidator, payload: v.string() },
  returns: v.id("aiJobs"),
  handler: async (ctx, { kind, payload }) => {
    const userId = await requireAuth(ctx);

    // Coalesce a duplicate in-flight request for the same inputs — a double
    // tap on "Surprise me" shouldn't spend two of the ten hourly calls.
    const existing = await ctx.db
      .query("aiJobs")
      .withIndex("by_user_and_kind", (q) =>
        q.eq("userId", userId).eq("kind", kind),
      )
      .order("desc")
      .first();
    if (
      existing &&
      existing.status === "generating" &&
      existing.payload === payload &&
      Date.now() - existing.createdAt < STALE_GENERATING_MS
    ) {
      return existing._id;
    }

    // Deliberately NOT caching ready results the way comparisons does:
    // "Surprise me" returning the same destination twice would defeat the
    // feature, and a visa guide is generated once then persisted as its own
    // visaGuides row anyway.
    const limit = KINDS[kind as Kind];
    await checkRateLimit(ctx, userId, limit.key, limit.max, HOUR_MS);

    const jobId = await ctx.db.insert("aiJobs", {
      userId,
      kind,
      status: "generating",
      payload,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.aiJobs.runJob, { jobId });
    return jobId;
  },
});

// ── Reactive read ────────────────────────────────────────────────

export const getJob = query({
  args: { jobId: v.id("aiJobs") },
  handler: async (ctx, { jobId }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(jobId);
    if (!row || row.userId !== userId) return null;
    // `payload` is request echo the client already holds — omitted so it
    // doesn't ride along on every subscription update.
    return {
      _id: row._id,
      kind: row.kind,
      status: row.status,
      result: row.result,
      errorMessage: row.errorMessage,
    };
  },
});

// ── Internal plumbing ────────────────────────────────────────────

export const _getJob = internalQuery({
  args: { jobId: v.id("aiJobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});

export const _completeJob = internalMutation({
  args: { jobId: v.id("aiJobs"), result: v.string() },
  handler: async (ctx, { jobId, result }) => {
    await ctx.db.patch(jobId, { status: "ready", result });
  },
});

export const _failJob = internalMutation({
  args: { jobId: v.id("aiJobs"), errorMessage: v.string() },
  handler: async (ctx, { jobId, errorMessage }) => {
    await ctx.db.patch(jobId, { status: "failed", errorMessage });
  },
});

// ── The action ───────────────────────────────────────────────────

export const runJob = internalAction({
  args: { jobId: v.id("aiJobs") },
  returns: v.null(),
  // Return types are annotated explicitly because this handler references
  // `internal.aiJobs` — its own module — which otherwise makes inference
  // circular (TS7022/TS7023).
  handler: async (ctx, { jobId }): Promise<null> => {
    const fail = async (logDetail: string): Promise<null> => {
      console.error(`runJob ${jobId}: ${logDetail}`);
      await ctx.runMutation(internal.aiJobs._failJob, {
        jobId,
        errorMessage: UPSTREAM_ERROR_MESSAGE,
      });
      return null;
    };

    try {
      const row: Doc<"aiJobs"> | null = await ctx.runQuery(
        internal.aiJobs._getJob,
        { jobId },
      );
      if (!row) return null;

      const secret = process.env.AI_PROXY_SECRET;
      if (!secret) return fail("AI_PROXY_SECRET env var is not set");

      const route = KINDS[row.kind as Kind]?.route;
      if (!route) return fail(`unknown kind: ${row.kind}`);

      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/${route}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-atlas-proxy-secret": secret,
          },
          body: row.payload,
        });
      } catch (err) {
        return fail(`fetch failed: ${String(err)}`);
      }

      const text = await res.text();
      if (!res.ok) return fail(`upstream ${res.status}: ${text.slice(0, 300)}`);

      // Validate before storing so a malformed body surfaces as a failed job
      // rather than a JSON.parse crash on the client later.
      try {
        JSON.parse(text);
      } catch {
        return fail(`non-JSON response: ${text.slice(0, 300)}`);
      }

      await ctx.runMutation(internal.aiJobs._completeJob, {
        jobId,
        result: text,
      });
      return null;
    } catch (err) {
      return fail(`unhandled: ${String(err)}`);
    }
  },
});

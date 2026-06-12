import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** One hour — the window every current limit uses. */
export const HOUR_MS = 60 * 60 * 1000;

/**
 * Fixed-window per-user rate limiter for LLM-triggering endpoints —
 * unbounded Anthropic spend is the failure mode this guards against.
 * Mirrors the cooldown style of emailVerification._storeCode: counters
 * live in their own table, the check runs inside the calling mutation's
 * transaction, and the user sees one clean sentence, never internals.
 *
 * Throws when the caller has already performed `max` actions for `key`
 * inside the current window; otherwise increments and returns. Because
 * mutations are transactions, a later validation throw in the caller
 * rolls the increment back — failed requests never burn quota.
 */
export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_and_key", (q) => q.eq("userId", userId).eq("key", key))
    .unique();

  if (!row) {
    await ctx.db.insert("rateLimits", { userId, key, windowStart: now, count: 1 });
    return;
  }
  if (now - row.windowStart >= windowMs) {
    // Window lapsed — start a fresh one.
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return;
  }
  if (row.count >= max) {
    // Clean, user-facing copy — Convex surfaces thrown messages verbatim.
    throw new Error("You're doing that too fast — try again in a minute.");
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

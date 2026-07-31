// convex/featureFlags.ts
//
// Remote kill switches. One row per flag; the client subscribes to `getFlags`,
// so flipping a value in the Convex dashboard turns a feature on or off in
// every running app within a second — no rebuild, no TestFlight round trip.
//
// Toggling from the backend:
//   Dashboard → Data → featureFlags → tick / untick the row's `enabled` box.
//   CLI:  npx convex run featureFlags:setFlag '{"key":"dayTrips","enabled":true}'
//
// These are release switches, not an experiment framework — flags are global,
// not per-user, and every signed-in client resolves the same values.
//
// Adding a flag: add the key to FLAG_DEFAULTS here, mirror it in
// constants/featureFlags.ts (REMOTE_FLAG_DEFAULTS) so the client has an
// offline default, then run `npx convex run featureFlags:seedFlags` to
// materialise the row for dashboard editing.

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireAuth } from "./lib/auth";

/**
 * Every remote-controllable flag, with the value used when no row exists yet.
 * Defaults are the SAFE state: a flag whose row is missing (fresh deployment,
 * seed not run) resolves to the value here, so shipping a new flag defaulted
 * to `false` keeps the feature dark until it's deliberately enabled.
 */
export const FLAG_DEFAULTS = {
  /** "Plan my day" — day-trip planner entry card, routes, and generator. */
  dayTrips: false,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];

// ── Resolution ───────────────────────────────────────────────────

/**
 * Server-side single-flag read for the functions a flag guards. Use this in
 * any mutation/action the feature can reach — the client gate is cosmetic, a
 * stale build or a replayed request would otherwise sail straight past it.
 */
export async function isFeatureEnabled(
  ctx: QueryCtx | MutationCtx,
  key: FlagKey,
): Promise<boolean> {
  const row = await ctx.db
    .query("featureFlags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.enabled ?? FLAG_DEFAULTS[key];
}

/** Throws a user-facing error when `key` is off. */
export async function requireFeatureEnabled(
  ctx: QueryCtx | MutationCtx,
  key: FlagKey,
  message: string,
): Promise<void> {
  if (!(await isFeatureEnabled(ctx, key))) {
    throw new Error(message);
  }
}

// ── Public read ──────────────────────────────────────────────────

/**
 * The whole flag set as a plain object, defaults overlaid with stored rows.
 * Unknown rows (a flag removed from the code but still in the table) are
 * dropped so the client's typed record never gains stray keys.
 */
export const getFlags = query({
  args: {},
  returns: v.record(v.string(), v.boolean()),
  handler: async (ctx) => {
    // Flags aren't user-scoped, but the requireAuth-everywhere rule still
    // applies (CLAUDE.md) — every surface a flag gates sits behind sign-in.
    await requireAuth(ctx);

    const resolved: Record<string, boolean> = { ...FLAG_DEFAULTS };
    const rows = await ctx.db.query("featureFlags").collect();
    for (const row of rows) {
      if (row.key in resolved) resolved[row.key] = row.enabled;
    }
    return resolved;
  },
});

// ── Backend-only writes ──────────────────────────────────────────

/**
 * Upsert one flag. Internal so no client can flip its own kill switch —
 * reachable from the dashboard's function runner and `npx convex run`.
 */
export const setFlag = internalMutation({
  args: { key: v.string(), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, enabled }) => {
    if (!FLAG_KEYS.includes(key as FlagKey)) {
      throw new Error(
        `Unknown flag "${key}". Known flags: ${FLAG_KEYS.join(", ")}`,
      );
    }
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("featureFlags", { key, enabled, updatedAt: Date.now() });
    }
    return null;
  },
});

/**
 * Materialise a row for every known flag at its default, leaving existing
 * rows untouched. Run once per deployment after adding a flag so it shows up
 * as an editable row in the dashboard's Data tab.
 */
export const seedFlags = internalMutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const created: string[] = [];
    for (const key of FLAG_KEYS) {
      const existing = await ctx.db
        .query("featureFlags")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) continue;
      await ctx.db.insert("featureFlags", {
        key,
        enabled: FLAG_DEFAULTS[key],
        updatedAt: Date.now(),
      });
      created.push(key);
    }
    return created;
  },
});

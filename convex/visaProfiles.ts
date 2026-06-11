import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// ── Visa profile sync ───────────────────────────────────────────────────
// The onboarding output (passports / held visas / residence / generated
// visa map) historically lived only in AsyncStorage, while the `onboarded`
// flag is server-truth on userProfiles. That mismatch meant a fresh install
// (or post-sign-out sign-in) of an onboarded account reached the tabs with
// an empty atlas. These two functions close the gap: the client upserts
// after onboarding/edits, and rehydrates from here when its local cache is
// empty. See contexts/visa-context.tsx for the hydration rules.

/** The signed-in user's visa profile, or null if never saved. */
export const getMyVisaProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("visaProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

/** Upsert the signed-in user's visa profile. Whole-document semantics —
 *  the client always sends its complete current state, never a patch. */
export const saveVisaProfile = mutation({
  args: {
    passports: v.array(v.string()),
    heldVisas: v.array(v.string()),
    residence: v.union(v.string(), v.null()),
    // JSON-encoded CountryVisa[].
    visaMap: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("visaProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("visaProfiles", {
      ...args,
      userId,
      updatedAt: Date.now(),
    });
  },
});

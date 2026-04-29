import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Returns the current viewer's user-profile doc, or null when no profile
// exists yet (the very first time we see this user). The visa context
// uses this as the source of truth for whether onboarding has been
// completed — that way it's tied to the user, not to AsyncStorage on a
// shared device.
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    return {
      _id: profile._id,
      userId: profile.userId,
      onboarded: profile.onboarded,
      onboardedAt: profile.onboardedAt ?? null,
    };
  },
});

// Marks the current user as onboarded. Idempotent — safe to call multiple
// times. Used at the end of the onboarding /building screen once the
// visa map has been generated.
export const markOnboarded = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        onboarded: true,
        onboardedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("userProfiles", {
      userId,
      onboarded: true,
      onboardedAt: Date.now(),
    });
  },
});

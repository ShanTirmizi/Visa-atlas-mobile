import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

const PRESENCE_TIMEOUT_MS = 60_000;

export const getPresence = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");

    const presenceDocs = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
    const active = presenceDocs.filter((p) => p.lastSeen >= cutoff);

    const enriched = await Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          ...p,
          name: user?.name ?? null,
          image: user?.image ?? null,
        };
      }),
    );

    return enriched;
  },
});

export const heartbeat = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");

    const existing = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();

    const now = Date.now();

    if (existing !== null) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("tripPresence", {
        tripId: args.tripId,
        userId,
        lastSeen: now,
      });
    }
  },
});

export const leave = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const existing = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();

    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

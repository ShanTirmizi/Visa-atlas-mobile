import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { checkTripPermission } from "./lib/auth";

export const getVotesForTrip = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");

    return await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const toggleVote = mutation({
  args: {
    tripId: v.id("trips"),
    activityId: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");

    const votes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) =>
        q.eq("tripId", args.tripId).eq("activityId", args.activityId),
      )
      .collect();

    const existing = votes.find((v) => v.userId === userId);

    if (existing !== undefined) {
      if (existing.vote === args.vote) {
        // Same vote — toggle off
        await ctx.db.delete(existing._id);
        return null;
      } else {
        // Different vote — update
        await ctx.db.patch(existing._id, { vote: args.vote });
        return existing._id;
      }
    } else {
      // No existing vote — insert
      const id = await ctx.db.insert("tripVotes", {
        tripId: args.tripId,
        activityId: args.activityId,
        userId,
        vote: args.vote,
      });
      return id;
    }
  },
});

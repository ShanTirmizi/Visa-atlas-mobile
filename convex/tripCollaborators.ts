import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

export const updateRole = mutation({
  args: {
    tripId: v.id("trips"),
    userId: v.id("users"),
    newRole: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "owner");

    const collaborator = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", args.userId),
      )
      .unique();

    if (collaborator === null) throw new Error("Collaborator not found");
    if (collaborator.role === "owner") throw new Error("Cannot change the owner's role");

    await ctx.db.patch(collaborator._id, { role: args.newRole });
  },
});

export const removeCollaborator = mutation({
  args: {
    tripId: v.id("trips"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "owner");

    const collaborator = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", args.userId),
      )
      .unique();

    if (collaborator === null) throw new Error("Collaborator not found");
    if (collaborator.role === "owner") throw new Error("Cannot remove the trip owner");

    await ctx.db.delete(collaborator._id);
  },
});

export const leaveTrip = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const { userId, role } = await checkTripPermission(ctx, args.tripId, "viewer");

    if (role === "owner") throw new Error("Trip owner cannot leave the trip");

    const collaborator = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", userId),
      )
      .unique();

    if (collaborator === null) throw new Error("Collaborator record not found");

    await ctx.db.delete(collaborator._id);
  },
});

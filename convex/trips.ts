import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, checkTripPermission } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

// ===== Queries =====

export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Find all collaborator rows for this user
    const collaboratorRows = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fetch each trip and append _role
    const trips: (Doc<"trips"> & { _role: string })[] = [];
    for (const collab of collaboratorRows) {
      const trip = await ctx.db.get(collab.tripId);
      if (trip !== null) {
        trips.push({ ...trip, _role: collab.role });
      }
    }

    // Sort descending by creation time
    trips.sort((a, b) => b._creationTime - a._creationTime);
    return trips;
  },
});

export const getTrip = query({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "viewer");
    return await ctx.db.get(args.id);
  },
});

export const getCollaborators = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");

    const collaborators = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    const enriched = await Promise.all(
      collaborators.map(async (collab) => {
        const user = await ctx.db.get(collab.userId);
        return {
          ...collab,
          userName: user?.name ?? null,
          userImage: user?.image ?? null,
          userEmail: user?.email ?? null,
        };
      }),
    );

    return enriched;
  },
});

// ===== Mutations =====

export const createTrip = mutation({
  args: {
    countryCode: v.string(),
    countryName: v.string(),
    status: v.union(v.literal("planned"), v.literal("completed")),
    duration: v.number(),
    region: v.string(),
    costLevel: v.number(),
    dailyBudget: v.string(),
    flightHours: v.number(),
    iataCode: v.string(),
    currency: v.string(),
    language: v.string(),
    timezone: v.string(),
    capital: v.string(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    surpriseMe: v.optional(v.boolean()),
    vibeTag: v.optional(v.string()),
    companions: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    dayImages: v.optional(v.string()),
    activityImages: v.optional(v.string()),
    itinerary: v.string(),
    budgetBreakdown: v.string(),
    packingSuggestions: v.string(),
    visaChecklist: v.string(),
    highlights: v.string(),
    accommodationTips: v.string(),
    localEssentials: v.optional(v.string()),
    localGuide: v.optional(v.string()),
    carRental: v.optional(v.string()),
    seasonalGuide: v.optional(v.string()),
    isMultiCountry: v.optional(v.boolean()),
    routeTitle: v.optional(v.string()),
    legs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const tripId = await ctx.db.insert("trips", { ...args, userId });

    // Create owner collaborator row
    await ctx.db.insert("tripCollaborators", {
      tripId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });

    return tripId;
  },
});

export const updateTripStatus = mutation({
  args: {
    id: v.id("trips"),
    status: v.union(v.literal("planned"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updateTripField = mutation({
  args: {
    id: v.id("trips"),
    field: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");

    const allowedFields = [
      "itinerary",
      "budgetBreakdown",
      "packingSuggestions",
      "visaChecklist",
      "highlights",
      "accommodationTips",
      "heroImage",
      "dayImages",
      "localEssentials",
      "localGuide",
      "carRental",
      "seasonalGuide",
      "companions",
    ];

    if (!allowedFields.includes(args.field)) {
      throw new Error(`Cannot update field: ${args.field}`);
    }

    await ctx.db.patch(args.id, { [args.field]: args.value });
  },
});

export const updateTripMeta = mutation({
  args: {
    id: v.id("trips"),
    duration: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined),
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const deleteTrip = mutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "owner");

    // Cascade: delete tripMessages
    const messages = await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // Cascade: delete tripCollaborators
    const collaborators = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const collab of collaborators) {
      await ctx.db.delete(collab._id);
    }

    // Cascade: delete tripInvites
    const invites = await ctx.db
      .query("tripInvites")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    // Cascade: delete tripVotes (prefix query on by_trip_and_activity)
    const votes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) => q.eq("tripId", args.id))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    // Cascade: delete tripPresence
    const presence = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const p of presence) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.id);
  },
});

// ===== Current User =====

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      image: user.image ?? null,
      email: user.email ?? null,
    };
  },
});

// ===== Chat Messages =====

export const getMessages = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    return await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    tripId: v.id("trips"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For user-role messages, verify viewer permission
    if (args.role === "user") {
      await checkTripPermission(ctx, args.tripId, "viewer");
    }

    return await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      userId: args.userId,
      userName: args.userName,
    });
  },
});

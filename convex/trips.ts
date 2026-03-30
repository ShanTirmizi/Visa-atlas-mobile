import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("trips").order("desc").collect();
  },
});

export const getTrip = query({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

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
    return await ctx.db.insert("trips", args);
  },
});

export const updateTripStatus = mutation({
  args: {
    id: v.id("trips"),
    status: v.union(v.literal("planned"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Update specific trip fields (itinerary, budget, etc.)
export const updateTripField = mutation({
  args: {
    id: v.id("trips"),
    field: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedFields = [
      "itinerary",
      "budgetBreakdown",
      "packingSuggestions",
      "visaChecklist",
      "highlights",
      "accommodationTips",
      "companions",
      "heroImage",
      "dayImages",
      "localEssentials",
      "localGuide",
      "carRental",
      "seasonalGuide",
    ];
    if (!allowedFields.includes(args.field)) {
      throw new Error(`Cannot update field: ${args.field}`);
    }
    await ctx.db.patch(args.id, { [args.field]: args.value });
  },
});

// Update trip metadata (duration, dates)
export const updateTripMeta = mutation({
  args: {
    id: v.id("trips"),
    duration: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const deleteTrip = mutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    // Delete associated messages
    const messages = await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ===== Chat Messages =====
export const getMessages = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    });
  },
});

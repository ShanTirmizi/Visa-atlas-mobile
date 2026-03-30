import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Shared validators for repeated unions
const bookingTypeValidator = v.union(
  v.literal("flight"),
  v.literal("hotel"),
  v.literal("experience"),
  v.literal("car_rental"),
  v.literal("insurance"),
  v.literal("restaurant")
);

const bookingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("calendar"),
  v.literal("api")
);

const bookingStatusValidator = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled")
);

// ===== Queries =====

export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bookings").order("desc").collect();
  },
});

export const listBookingsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const listUnassignedBookings = query({
  args: {},
  handler: async (ctx) => {
    const allBookings = await ctx.db.query("bookings").collect();
    return allBookings.filter((b) => b.tripId === undefined);
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ===== Mutations =====

export const createBooking = mutation({
  args: {
    type: bookingTypeValidator,
    source: bookingSourceValidator,
    provider: v.string(),
    status: bookingStatusValidator,
    title: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    confirmationNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Type-specific details (JSON strings)
    flightDetails: v.optional(v.string()),
    hotelDetails: v.optional(v.string()),
    experienceDetails: v.optional(v.string()),
    carDetails: v.optional(v.string()),
    insuranceDetails: v.optional(v.string()),
    restaurantDetails: v.optional(v.string()),
    // Trip association
    tripId: v.optional(v.id("trips")),
    autoMatched: v.optional(v.boolean()),
    // Calendar integration
    calendarEventId: v.optional(v.string()),
    calendarSource: v.optional(v.union(v.literal("google"), v.literal("apple"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookings", args);
  },
});

export const updateBooking = mutation({
  args: {
    id: v.id("bookings"),
    title: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    confirmationNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(bookingStatusValidator),
    // Type-specific details (JSON strings)
    flightDetails: v.optional(v.string()),
    hotelDetails: v.optional(v.string()),
    experienceDetails: v.optional(v.string()),
    carDetails: v.optional(v.string()),
    insuranceDetails: v.optional(v.string()),
    restaurantDetails: v.optional(v.string()),
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

export const linkBookingToTrip = mutation({
  args: {
    id: v.id("bookings"),
    tripId: v.id("trips"),
    autoMatched: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, tripId, autoMatched } = args;
    const updates: Record<string, unknown> = { tripId };
    if (autoMatched !== undefined) {
      updates.autoMatched = autoMatched;
    }
    await ctx.db.patch(id, updates);
  },
});

export const unlinkBookingFromTrip = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { tripId: undefined, autoMatched: false });
  },
});

export const deleteBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

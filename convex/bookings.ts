import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, checkTripPermission } from "./lib/auth";

// Shared validators for repeated unions
const bookingTypeValidator = v.union(
  v.literal("flight"),
  v.literal("hotel"),
  v.literal("experience"),
  v.literal("car_rental"),
  v.literal("insurance"),
  v.literal("restaurant"),
);

const bookingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("calendar"),
  v.literal("api"),
  v.literal("email"),
);

const bookingStatusValidator = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
);

// ===== Queries =====

export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const listBookingsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    return await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const listUnassignedBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const userBookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return userBookings.filter((b) => b.tripId === undefined);
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (booking === null) return null;
    if (booking.userId !== userId) {
      throw new Error("You don't have access to this booking");
    }
    return booking;
  },
});

// ===== Mutations =====

export const createBooking = mutation({
  args: {
    type: bookingTypeValidator,
    source: bookingSourceValidator,
    provider: v.optional(v.string()),
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
    calendarSource: v.optional(
      v.union(v.literal("google"), v.literal("apple")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // If associating with a trip, verify editor permission
    if (args.tripId !== undefined) {
      await checkTripPermission(ctx, args.tripId, "editor");
    }

    return await ctx.db.insert("bookings", { ...args, userId });
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
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (booking === null) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You don't have access to this booking");
    }

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined),
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
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (booking === null) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You don't have access to this booking");
    }

    // Also verify editor permission on the target trip
    await checkTripPermission(ctx, args.tripId, "editor");

    const updates: Record<string, unknown> = { tripId: args.tripId };
    if (args.autoMatched !== undefined) {
      updates.autoMatched = args.autoMatched;
    }
    await ctx.db.patch(args.id, updates);
  },
});

export const unlinkBookingFromTrip = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (booking === null) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You don't have access to this booking");
    }

    await ctx.db.patch(args.id, { tripId: undefined, autoMatched: false });
  },
});

export const deleteBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (booking === null) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You don't have access to this booking");
    }

    await ctx.db.delete(args.id);
  },
});

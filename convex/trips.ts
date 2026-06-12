import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, checkTripPermission } from "./lib/auth";
import { cascadeDeleteTrip } from "./lib/tripCascade";
import type { Doc } from "./_generated/dataModel";

// How long a soft-deleted trip stays recoverable before the scheduled hard
// delete cascades it away. The client's Undo toast lasts 6s — comfortably
// inside this window.
const HARD_DELETE_DELAY_MS = 10_000;

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

    // Fetch each trip and append _role. Soft-deleted trips (deletedAt set,
    // awaiting their scheduled hard delete) read as gone everywhere.
    const trips: (Doc<"trips"> & { _role: string })[] = [];
    for (const collab of collaboratorRows) {
      const trip = await ctx.db.get(collab.tripId);
      if (trip !== null && trip.deletedAt === undefined) {
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
    const { role } = await checkTripPermission(ctx, args.id, "viewer");
    const trip = await ctx.db.get(args.id);
    // Soft-deleted trips read as missing — the trip screen already renders
    // its not-found state for null, which is exactly what a viewer should
    // see during the undo window.
    if (trip === null || trip.deletedAt !== undefined) return null;
    // _role mirrors listTrips: the client gates write affordances (Curate
    // dining, retry cards) on it so viewers never see CTAs that can only
    // throw "Requires editor role" server-side.
    return { ...trip, _role: role };
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

/**
 * @deprecated Use the streaming `tripGeneration.generateTrip` action instead,
 * which inserts a stub and streams content into it. This synchronous mutation
 * remains for legacy compatibility and direct seeding from tests.
 */
export const createTrip = mutation({
  args: {
    countryCode: v.string(),
    countryName: v.string(),
    status: v.union(
      v.literal("planned"),
      v.literal("completed"),
      v.literal("generating"),
      v.literal("failed"),
    ),
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
    visaCost: v.optional(v.string()),
    visaProcessingTime: v.optional(v.string()),
    visaForms: v.optional(v.string()),
    visaPassportValidity: v.optional(v.string()),
    visaEntries: v.optional(v.string()),
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
    // Optional dates — when omitted the trip lands in "Dreaming". When set
    // it shows up in Upcoming or Past based on whether the start is past.
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
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

/** Pin or un-pin a trip via the heart button on the trip detail header. */
export const setTripStarred = mutation({
  args: {
    id: v.id("trips"),
    starred: v.boolean(),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");
    await ctx.db.patch(args.id, { starred: args.starred });
  },
});

/**
 * Toggle one pre-flight checklist item on the trip's Visa tab. Progress is
 * keyed by the item's text — `checklistProgress` stores the checked strings —
 * so state survives as long as the rendered list is stable (Apple Reminders
 * keys completion the same way for templated lists).
 */
export const toggleChecklistItem = mutation({
  args: {
    id: v.id("trips"),
    item: v.string(),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");

    const trip = await ctx.db.get(args.id);
    // Soft-deleted trips read as gone everywhere (matches getTrip).
    if (trip === null || trip.deletedAt !== undefined) {
      throw new Error("Trip not found");
    }

    const progress = trip.checklistProgress ?? [];
    const next = progress.includes(args.item)
      ? progress.filter((entry) => entry !== args.item)
      : [...progress, args.item];

    await ctx.db.patch(args.id, { checklistProgress: next });
  },
});

export const updateTripStatus = mutation({
  args: {
    id: v.id("trips"),
    // Only the user-facing statuses are client-settable. 'generating' and
    // 'failed' are generation-lifecycle states owned by the internal
    // tripGeneration mutations — letting a client set them would wedge the
    // trip in the skeleton/failed screen with no stream running to recover it.
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
      "activityImages",
      "localEssentials",
      "localGuide",
      "carRental",
      "seasonalGuide",
      "companions",
      "visaCost",
      "visaProcessingTime",
      "visaForms",
      "visaPassportValidity",
      "visaEntries",
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

/**
 * Soft delete + scheduled hard delete (Apple Notes / Mail "instant action
 * with Undo" pattern — no confirmation dialog). The trip is marked with
 * `deletedAt` so every read treats it as gone immediately, then a scheduled
 * job finalizes the cascade after the undo window closes.
 *
 * Undo works by clearing `deletedAt` — the scheduled job re-checks the flag
 * and no-ops. That's simpler and more robust than `scheduler.cancel`: no job
 * id bookkeeping, and a double-delete just refreshes the timestamp and
 * schedules another guard-protected job (harmless).
 */
export const deleteTrip = mutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "owner");

    await ctx.db.patch(args.id, { deletedAt: Date.now() });
    await ctx.scheduler.runAfter(
      HARD_DELETE_DELAY_MS,
      internal.trips.hardDeleteTrip,
      { id: args.id },
    );
  },
});

/**
 * Restores a soft-deleted trip during the undo window. The scheduled
 * `hardDeleteTrip` then no-ops via its `deletedAt` guard.
 */
export const undoDeleteTrip = mutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Undo pressed after the window closed: the hard delete already
    // cascaded the trip (and its collaborator rows) away. Nothing to
    // restore — exit silently rather than throw into the client's
    // fire-and-forget call.
    const trip = await ctx.db.get(args.id);
    if (trip === null) return;

    await checkTripPermission(ctx, args.id, "owner");

    if (trip.deletedAt === undefined) return; // not deleted — nothing to undo

    // Patching a field to undefined clears it from the document.
    await ctx.db.patch(args.id, { deletedAt: undefined });
  },
});

/**
 * Finalizes a soft delete: cascades all trip-linked rows, then removes the
 * trip itself. Scheduled by `deleteTrip`; aborts silently if the trip is
 * already gone (double-delete raced) or the user undid the delete.
 *
 * The cascade itself lives in lib/tripCascade — the single implementation
 * shared with account.deleteAccount, so the two paths can't diverge on
 * what dies with a trip.
 */
export const hardDeleteTrip = internalMutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.id);
    if (trip === null || trip.deletedAt === undefined) return;
    await cascadeDeleteTrip(ctx, args.id);
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
      // null until the user verifies their email; settings reads this to
      // show a "Verify your email" affordance.
      emailVerificationTime: user.emailVerificationTime ?? null,
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
  },
  handler: async (ctx, args) => {
    // Both roles require viewer access: assistant replies are inserted by
    // the authenticated participant whose prompt produced them. Attribution
    // is derived server-side — a client-supplied userId/userName would be
    // spoofable.
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");
    const user = args.role === "user" ? await ctx.db.get(userId) : null;

    return await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      userId: args.role === "user" ? userId : undefined,
      userName: args.role === "user" ? (user?.name ?? undefined) : undefined,
    });
  },
});

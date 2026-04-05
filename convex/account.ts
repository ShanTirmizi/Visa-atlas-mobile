import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ===== Helpers =====

async function cascadeDeleteTrip(
  ctx: MutationCtx,
  tripId: Id<"trips">,
): Promise<void> {
  // Delete tripMessages
  const messages = await ctx.db
    .query("tripMessages")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const msg of messages) {
    await ctx.db.delete(msg._id);
  }

  // Delete tripCollaborators
  const collaborators = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const collab of collaborators) {
    await ctx.db.delete(collab._id);
  }

  // Delete tripInvites
  const invites = await ctx.db
    .query("tripInvites")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const invite of invites) {
    await ctx.db.delete(invite._id);
  }

  // Delete tripVotes
  const votes = await ctx.db
    .query("tripVotes")
    .withIndex("by_trip_and_activity", (q) => q.eq("tripId", tripId))
    .collect();
  for (const vote of votes) {
    await ctx.db.delete(vote._id);
  }

  // Delete tripPresence
  const presence = await ctx.db
    .query("tripPresence")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const p of presence) {
    await ctx.db.delete(p._id);
  }

  await ctx.db.delete(tripId);
}

// ===== Mutations =====

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // 1. Find all tripCollaborators for this user
    const collabRows = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 2. For owner rows: cascade delete the trip; for non-owner rows: just delete the collaborator
    for (const collab of collabRows) {
      if (collab.role === "owner") {
        await cascadeDeleteTrip(ctx, collab.tripId);
      } else {
        await ctx.db.delete(collab._id);
      }
    }

    // 3. Delete all bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const booking of bookings) {
      await ctx.db.delete(booking._id);
    }

    // 4. Delete all visaGuides
    const visaGuides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const guide of visaGuides) {
      await ctx.db.delete(guide._id);
    }

    // 5. Delete all emailAccounts
    const emailAccounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const account of emailAccounts) {
      await ctx.db.delete(account._id);
    }

    // 6. Delete the user document
    await ctx.db.delete(userId);

    // 7. Delete auth-related records (no custom index, use filter)
    const authSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }
  },
});

// ===== Queries =====

export const exportUserData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const user = await ctx.db.get(userId);

    // Trips the user collaborates on
    const collabRows = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const trips: (Record<string, unknown> & { _role: string })[] = [];
    for (const collab of collabRows) {
      const trip = await ctx.db.get(collab.tripId);
      if (trip !== null) {
        trips.push({ ...trip, _role: collab.role });
      }
    }

    // Bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Visa guides
    const visaGuides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Email accounts — sanitized, no tokens
    const emailAccountRows = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const emailAccounts = emailAccountRows.map((ea) => ({
      provider: ea.provider,
      email: ea.email,
      isConnected: ea.isConnected,
      lastScanTime: ea.lastScanTime ?? null,
    }));

    return {
      exportDate: new Date().toISOString(),
      user: {
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
      },
      trips,
      bookings,
      visaGuides,
      emailAccounts,
    };
  },
});

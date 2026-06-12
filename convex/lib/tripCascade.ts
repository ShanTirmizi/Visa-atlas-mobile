import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Cascade-delete a trip and EVERY row that hangs off it, then the trip doc
 * itself. The single source of truth for "what dies with a trip" — shared
 * by trips.hardDeleteTrip (the soft-delete finalizer) and
 * account.deleteAccount (owner account erasure), which previously carried
 * two divergent copies: the account-deletion copy skipped trip-linked
 * bookings, stranding collaborators' bookings with dangling tripIds.
 *
 * Deletes: tripMessages, tripCollaborators, tripInvites, tripVotes,
 * tripPresence, tripShares, bookings (linked via by_trip — regardless of
 * which collaborator created them), and finally the trip document.
 */
export async function cascadeDeleteTrip(
  ctx: MutationCtx,
  tripId: Id<"trips">,
): Promise<void> {
  const messages = await ctx.db
    .query("tripMessages")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const msg of messages) {
    await ctx.db.delete(msg._id);
  }

  const collaborators = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const collab of collaborators) {
    await ctx.db.delete(collab._id);
  }

  const invites = await ctx.db
    .query("tripInvites")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const invite of invites) {
    await ctx.db.delete(invite._id);
  }

  // Prefix query on by_trip_and_activity — tripVotes has no plain by_trip.
  const votes = await ctx.db
    .query("tripVotes")
    .withIndex("by_trip_and_activity", (q) => q.eq("tripId", tripId))
    .collect();
  for (const vote of votes) {
    await ctx.db.delete(vote._id);
  }

  const presence = await ctx.db
    .query("tripPresence")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const p of presence) {
    await ctx.db.delete(p._id);
  }

  // Public share links — requireShareToken already refuses tokens whose
  // trip is gone, so surviving rows would be pure dangling weight with
  // tripId references into nothing. Active and revoked alike die here.
  const shares = await ctx.db
    .query("tripShares")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const share of shares) {
    await ctx.db.delete(share._id);
  }

  // Bookings linked to this trip — the delete flow's copy has always
  // promised "this will also delete its bookings"; leaving them behind
  // strands dangling tripId references.
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  for (const booking of bookings) {
    await ctx.db.delete(booking._id);
  }

  await ctx.db.delete(tripId);
}

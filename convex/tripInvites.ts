import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAuthUser, checkTripPermission } from "./lib/auth";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Invite codes are bearer credentials (anyone holding one can join the trip),
// so they must come from a CSPRNG — Math.random's state is reconstructable
// from observed outputs. Same RandomReader + generateRandomString pattern as
// convex/ResendOTP.ts; the alphabet omits visually ambiguous chars (I/O/l/o/0/1).
const INVITE_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateInviteCode(): string {
  const random: RandomReader = {
    read(bytes: Uint8Array) {
      crypto.getRandomValues(bytes);
    },
  };
  return generateRandomString(random, INVITE_CODE_ALPHABET, 12);
}

export const createInvite = mutation({
  args: {
    tripId: v.id("trips"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    invitedEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "editor");

    const inviteCode = generateInviteCode();
    const expiresAt = Date.now() + INVITE_EXPIRY_MS;

    const inviteId = await ctx.db.insert("tripInvites", {
      tripId: args.tripId,
      inviteCode,
      role: args.role,
      createdBy: userId,
      expiresAt,
      status: "pending",
      ...(args.invitedEmail !== undefined
        ? { invitedEmail: args.invitedEmail }
        : {}),
    });

    return { inviteId, inviteCode };
  },
});

export const getInviteByCode = query({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    // The invite-accept screen is only reachable behind the app's auth gate
    // (app/_layout.tsx redirects signed-out users to /sign-in before this
    // query mounts), so requiring auth here doesn't break the deep-link flow.
    await requireAuth(ctx);

    const invite = await ctx.db
      .query("tripInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (invite === null) return null;
    if (invite.status !== "pending") return null;
    if (invite.expiresAt < Date.now()) return null;

    const trip = await ctx.db.get(invite.tripId);
    // A soft-deleted trip (pending hard delete) reads as gone — its invites
    // are no longer redeemable previews.
    if (trip !== null && trip.deletedAt !== undefined) return null;
    const countryName = trip?.countryName ?? null;

    // Redacted preview shape — never return createdBy or invitedEmail (PII)
    // to whoever happens to hold the code. The accept screen only needs
    // role + countryName for the card and tripId for post-accept navigation.
    return {
      tripId: invite.tripId,
      role: invite.role,
      expiresAt: invite.expiresAt,
      countryName,
    };
  },
});

export const acceptInvite = mutation({
  args: {
    inviteCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const invite = await ctx.db
      .query("tripInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (invite === null) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite is no longer valid");
    if (invite.expiresAt < Date.now()) throw new Error("Invite has expired");

    // Email-targeted invites are bound to the recipient: a forwarded or
    // leaked code must not let someone else redeem the role (and flip the
    // invite to 'accepted', locking out the intended recipient).
    if (invite.invitedEmail !== undefined) {
      const user = await ctx.db.get(userId);
      const userEmail = user?.email?.trim().toLowerCase();
      if (!userEmail || userEmail !== invite.invitedEmail.trim().toLowerCase()) {
        throw new Error("This invite was sent to a different email address");
      }
    }

    const existing = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", invite.tripId).eq("userId", userId),
      )
      .unique();

    if (existing !== null) throw new Error("You are already a collaborator on this trip");

    await ctx.db.insert("tripCollaborators", {
      tripId: invite.tripId,
      userId,
      role: invite.role,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(invite._id, { status: "accepted" });

    return invite.tripId;
  },
});

export const listTripInvites = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "editor");

    return await ctx.db
      .query("tripInvites")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const getPendingInvitesForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);
    const email = user.email;

    if (!email) return [];

    const invites = await ctx.db
      .query("tripInvites")
      .withIndex("by_email", (q) => q.eq("invitedEmail", email))
      .collect();

    const now = Date.now();
    const pending = invites.filter(
      (inv) => inv.status === "pending" && inv.expiresAt >= now,
    );

    const enriched = await Promise.all(
      pending.map(async (inv) => {
        const trip = await ctx.db.get(inv.tripId);
        // Soft-deleted trips (pending hard delete) read as gone — drop
        // their invites from the user's pending list.
        if (trip !== null && trip.deletedAt !== undefined) return null;
        return { ...inv, countryName: trip?.countryName ?? null };
      }),
    );

    return enriched.filter((inv) => inv !== null);
  },
});

export const revokeInvite = mutation({
  args: {
    id: v.id("tripInvites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.id);
    if (invite === null) throw new Error("Invite not found");

    await checkTripPermission(ctx, invite.tripId, "owner");

    await ctx.db.delete(args.id);
  },
});

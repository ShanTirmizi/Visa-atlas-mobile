import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAuthUser, checkTripPermission } from "./lib/auth";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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
    const invite = await ctx.db
      .query("tripInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (invite === null) return null;
    if (invite.status !== "pending") return null;
    if (invite.expiresAt < Date.now()) return null;

    const trip = await ctx.db.get(invite.tripId);
    const countryName = trip?.countryName ?? null;

    return { ...invite, countryName };
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
        return { ...inv, countryName: trip?.countryName ?? null };
      }),
    );

    return enriched;
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

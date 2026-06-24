import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, checkTripPermission } from "./lib/auth";

// ── User-safety moderation ──────────────────────────────────────
//
// App Store UGC requirements: any surface that shows user-generated content
// (the shared trip copilot threads) must let a user report objectionable
// content and block another participant. Both actor ids are derived
// server-side via requireAuth — never accepted as arguments (spoofable).

/**
 * Report a trip message. The reporter must share the trip (viewer access).
 * Stores a row for review; does not mutate the message itself.
 */
export const reportMessage = mutation({
  args: {
    messageId: v.id("tripMessages"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, reason }) => {
    const reporterId = await requireAuth(ctx);

    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    // Ensure the reporter actually shares the trip the message lives on.
    await checkTripPermission(ctx, message.tripId, "viewer");

    await ctx.db.insert("messageReports", {
      reporterId,
      messageId,
      tripId: message.tripId,
      reportedUserId: message.userId,
      reason,
      createdAt: Date.now(),
    });
  },
});

/**
 * Block another user. Idempotent — blocking an already-blocked user is a
 * no-op. Their messages are filtered out of shared threads (see
 * trips.getMessages).
 */
export const blockUser = mutation({
  args: { blockedId: v.id("users") },
  handler: async (ctx, { blockedId }) => {
    const blockerId = await requireAuth(ctx);
    if (blockerId === blockedId) throw new Error("Cannot block yourself");

    const existing = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", blockerId).eq("blockedId", blockedId),
      )
      .unique();
    if (existing) return;

    await ctx.db.insert("blockedUsers", {
      blockerId,
      blockedId,
      createdAt: Date.now(),
    });
  },
});

/** Unblock a previously-blocked user. No-op if no block row exists. */
export const unblockUser = mutation({
  args: { blockedId: v.id("users") },
  handler: async (ctx, { blockedId }) => {
    const blockerId = await requireAuth(ctx);

    const existing = await ctx.db
      .query("blockedUsers")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", blockerId).eq("blockedId", blockedId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { checkTripPermission, requireShareToken } from "./lib/auth";
import { buildSharedTripPayload } from "./lib/sharePayload";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

// Share tokens are bearer credentials like invite codes (anyone holding
// one can read the shared trip), so CSPRNG only — same RandomReader +
// generateRandomString pattern as convex/tripInvites.ts. Share links are
// LONG-LIVED capability URLs (no expiry, revocation is manual), so they
// get a larger entropy budget than 7-day invite codes: 20 chars over the
// 57-char alphabet ≈ 116 bits. Alphabet omits visually ambiguous chars
// (I/l/O/0/1) — these tokens live in URLs people read aloud.
const SHARE_TOKEN_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateShareToken(): string {
  const random: RandomReader = {
    read(bytes: Uint8Array) {
      crypto.getRandomValues(bytes);
    },
  };
  return generateRandomString(random, SHARE_TOKEN_ALPHABET, 20);
}

/**
 * The trip's currently-active (non-revoked) share, or null. A trip has at
 * most one active share at a time — createShareLink is idempotent against
 * it, revokeShareLink retires it.
 */
async function activeShareForTrip(
  ctx: QueryCtx | MutationCtx,
  tripId: Id<"trips">,
): Promise<Doc<"tripShares"> | null> {
  const shares = await ctx.db
    .query("tripShares")
    .withIndex("by_trip", (q) => q.eq("tripId", tripId))
    .collect();
  return shares.find((s) => s.revokedAt === undefined) ?? null;
}

/**
 * Create (or return the existing) public share link for a trip.
 * Idempotent while a share is active; after a revoke, the next call mints
 * a FRESH token — that's the mechanism that kills leaked old links.
 */
export const createShareLink = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "editor");

    const existing = await activeShareForTrip(ctx, args.tripId);
    if (existing !== null) return { token: existing.token };

    const token = generateShareToken();
    await ctx.db.insert("tripShares", {
      tripId: args.tripId,
      token,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return { token };
  },
});

/**
 * Revoke the trip's active share link. The token dies immediately —
 * getSharedTrip resolves it to null from the next read. No-op when no
 * share is active.
 */
export const revokeShareLink = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "editor");

    const existing = await activeShareForTrip(ctx, args.tripId);
    if (existing === null) return;

    await ctx.db.patch(existing._id, { revokedAt: Date.now() });
  },
});

/**
 * The trip's active share for the share-sheet UI: token (to rebuild the
 * URL), view count, and when it was created. Null when sharing is off.
 */
export const getShareStatus = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");

    const existing = await activeShareForTrip(ctx, args.tripId);
    if (existing === null) return null;

    return {
      token: existing.token,
      viewCount: existing.viewCount ?? 0,
      createdAt: existing.createdAt,
    };
  },
});

/**
 * PUBLIC (token-gated) — the documented exception to the requireAuth rule
 * (CLAUDE.md "Convex Security Guidelines"). The unguessable token is the
 * authorization; requireShareToken resolves it to an active share + live
 * trip or null. Returns ONLY the buildSharedTripPayload allowlist — never
 * the raw doc.
 */
export const getSharedTrip = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const res = await requireShareToken(ctx, args.token);
    if (res === null) return null;
    return buildSharedTripPayload(res.trip);
  },
});

/**
 * PUBLIC (token-gated) — same exception as getSharedTrip. Bumps the
 * share's view counter; the web share page fires this once per page load.
 * Touches nothing but the tripShares row itself.
 */
export const recordShareView = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const res = await requireShareToken(ctx, args.token);
    if (res === null) return;
    await ctx.db.patch(res.share._id, {
      viewCount: (res.share.viewCount ?? 0) + 1,
    });
  },
});

/**
 * CLI/testing only — internal functions are not publicly callable. Lets
 * end-to-end verification drive shares via
 * `npx convex run tripShares:internalCreateShare '{"tripId": "..."}'`.
 * Same insert path as createShareLink, attributed to the trip owner.
 */
export const internalCreateShare = internalMutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (trip === null) throw new Error("Trip not found");

    const existing = await activeShareForTrip(ctx, args.tripId);
    if (existing !== null) return { token: existing.token };

    const token = generateShareToken();
    await ctx.db.insert("tripShares", {
      tripId: args.tripId,
      token,
      createdBy: trip.userId,
      createdAt: Date.now(),
    });

    return { token };
  },
});

/**
 * CLI/testing only — revokes the trip's active share, mirroring
 * revokeShareLink without auth. Not publicly callable.
 */
export const internalRevokeShare = internalMutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const existing = await activeShareForTrip(ctx, args.tripId);
    if (existing === null) return;

    await ctx.db.patch(existing._id, { revokedAt: Date.now() });
  },
});

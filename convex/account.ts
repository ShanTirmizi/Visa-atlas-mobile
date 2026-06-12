import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { cascadeDeleteTrip } from "./lib/tripCascade";

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

    // 2. For owner rows: cascade delete the trip (the SAME shared cascade
    // trips.hardDeleteTrip uses — including trip-linked bookings, so
    // collaborators' bookings aren't stranded); for non-owner rows: just
    // remove this user's collaborator membership.
    for (const collab of collabRows) {
      if (collab.role === "owner") {
        await cascadeDeleteTrip(ctx, collab.tripId);
      } else {
        await ctx.db.delete(collab._id);
      }
    }

    // 3. Delete all bookings the user created (covers bookings linked to
    // OTHER people's trips too — the trip cascade above only reaches the
    // trips this user owned).
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const booking of bookings) {
      await ctx.db.delete(booking._id);
    }

    // 4. Delete all visaGuides AND their chat messages — the guide chat
    // holds the user's own immigration questions, squarely PII.
    const visaGuides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const guide of visaGuides) {
      const guideMessages = await ctx.db
        .query("visaGuideMessages")
        .withIndex("by_guide", (q) => q.eq("guideId", guide._id))
        .collect();
      for (const msg of guideMessages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(guide._id);
    }

    // 5. Delete all emailAccounts — these hold Gmail OAuth access/refresh
    // tokens; leaving them behind is a live credential leak.
    const emailAccounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const account of emailAccounts) {
      await ctx.db.delete(account._id);
    }

    // 6. Delete the visa profile (passports, held visas, residence — the
    // most sensitive document the app stores).
    const visaProfiles = await ctx.db
      .query("visaProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const profile of visaProfiles) {
      await ctx.db.delete(profile._id);
    }

    // 7. Delete the user profile (includes the Expo push token — without
    // this, scheduled notifications could still target the device).
    const userProfiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const profile of userProfiles) {
      await ctx.db.delete(profile._id);
    }

    // 8. Delete refinement sessions (the user's trip-brief analyses).
    const refinementSessions = await ctx.db
      .query("refinementSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const session of refinementSessions) {
      await ctx.db.delete(session._id);
    }

    // 9. Delete pending email verification codes.
    const verificationCodes = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const code of verificationCodes) {
      await ctx.db.delete(code._id);
    }

    // 10. Delete rate-limit counters (prefix query on by_user_and_key).
    const rateLimits = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_and_key", (q) => q.eq("userId", userId))
      .collect();
    for (const row of rateLimits) {
      await ctx.db.delete(row._id);
    }

    // 11. Delete the user document
    await ctx.db.delete(userId);

    // 12. Delete auth-related records. @convex-dev/auth's authTables ship
    // with the indexes we need (authSessions."userId",
    // authAccounts."userIdAndProvider", authRefreshTokens."sessionId") —
    // .filter() here would table-scan every user's sessions/accounts.
    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of authSessions) {
      // Refresh tokens hang off the session — delete them first so they
      // aren't orphaned once the session row is gone.
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of refreshTokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
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
      // Skip soft-deleted trips (deletedAt set) — they're pending hard
      // delete and read as gone everywhere user-facing.
      if (trip !== null && trip.deletedAt === undefined) {
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

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const wipeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["trips", "tripMessages", "bookings", "visaGuides"] as const;
    for (const table of tables) {
      const docs = await ctx.db.query(table).take(1000);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});

/** Nuke an orphaned auth account by email. Use after a `users` doc has been
 *  deleted manually (or by a half-migration) but the matching `authAccounts`
 *  row remained — Convex Auth can't sign back in because the account
 *  references a user ID that no longer exists.
 *
 *  Run from CLI:
 *    npx convex run wipeTestData:wipeAuthAccountByEmail '{"email":"x@y.com"}'
 */
export const wipeAuthAccountByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const lower = email.trim().toLowerCase();

    // Find authAccounts rows tied to this email — providerAccountId is the
    // email for the password / resend-otp providers.
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("providerAccountId"), lower))
      .collect()
      .catch(() => []);

    let userId: string | null = null;
    let removedAccounts = 0;
    for (const account of accounts) {
      if (!userId && (account as { userId?: string }).userId) {
        userId = (account as { userId: string }).userId;
      }
      await ctx.db.delete(account._id);
      removedAccounts++;
    }

    // Wipe sessions + refresh tokens that point at this user.
    let removedSessions = 0;
    let removedRefresh = 0;
    if (userId) {
      const sessions = await ctx.db
        .query("authSessions")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect()
        .catch(() => []);
      for (const s of sessions) {
        const refresh = await ctx.db
          .query("authRefreshTokens")
          .filter((q) => q.eq(q.field("sessionId"), s._id))
          .collect()
          .catch(() => []);
        for (const r of refresh) {
          await ctx.db.delete(r._id);
          removedRefresh++;
        }
        await ctx.db.delete(s._id);
        removedSessions++;
      }

      // Remove the user doc itself if it still exists.
      const stillThere = await ctx.db.get(userId as never);
      if (stillThere) await ctx.db.delete(userId as never);
    }

    return { email: lower, removedAccounts, removedSessions, removedRefresh };
  },
});

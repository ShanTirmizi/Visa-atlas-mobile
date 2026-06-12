import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Deletes EVERY user's trips/messages/bookings/guides. Internal-only (not
 *  in the client API), and the confirm literal makes a dashboard/CLI
 *  mis-click impossible — you must type the magic string to run it:
 *    npx convex run wipeTestData:wipeAll '{"confirm":"WIPE_EVERYTHING"}'
 */
export const wipeAll = internalMutation({
  args: { confirm: v.literal("WIPE_EVERYTHING") },
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

/** Diagnostic — list all authAccounts + whether their userId still exists. */
export const inspectAuthAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    const result: Array<{
      _id: string;
      provider: string;
      providerAccountId: string;
      userId: string | null;
      userExists: boolean;
      userEmail: string | null;
    }> = [];
    for (const a of accounts) {
      const acc = a as {
        _id: string;
        provider: string;
        providerAccountId: string;
        userId?: string;
      };
      let userExists = false;
      let userEmail: string | null = null;
      if (acc.userId) {
        const u = await ctx.db.get(acc.userId as never);
        userExists = !!u;
        if (u && (u as { email?: string }).email) {
          userEmail = (u as { email: string }).email;
        }
      }
      result.push({
        _id: acc._id,
        provider: acc.provider,
        providerAccountId: acc.providerAccountId,
        userId: acc.userId ?? null,
        userExists,
        userEmail,
      });
    }
    return result;
  },
});

/** Wipes EVERY orphan account in one shot. Safe — only deletes accounts whose
 *  user doc is missing. */
export const wipeAllOrphanAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    let removed = 0;
    for (const a of accounts) {
      const acc = a as { _id: string; userId?: string };
      if (!acc.userId) continue;
      const user = await ctx.db.get(acc.userId as never);
      if (!user) {
        await ctx.db.delete(acc._id as never);
        removed++;
      }
    }
    return { removed };
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

      const stillThere = await ctx.db.get(userId as never);
      if (stillThere) await ctx.db.delete(userId as never);
    }

    return { email: lower, removedAccounts, removedSessions, removedRefresh };
  },
});

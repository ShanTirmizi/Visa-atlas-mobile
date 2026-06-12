import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";

/**
 * Client-safe projection of an email account. The OAuth access/refresh
 * tokens (full Gmail read credentials) must NEVER ship to the client —
 * only the internal functions below may read them; everything public
 * returns this sanitized shape.
 */
function sanitizeAccount(account: Doc<"emailAccounts">) {
  return {
    _id: account._id,
    _creationTime: account._creationTime,
    provider: account.provider,
    email: account.email,
    isConnected: account.isConnected,
    lastScanTime: account.lastScanTime ?? null,
    lastScanMessageId: account.lastScanMessageId ?? null,
  };
}

export const getByProvider = query({
  args: { provider: v.union(v.literal("gmail"), v.literal("outlook")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider),
      )
      .unique();
    return account ? sanitizeAccount(account) : null;
  },
});

export const listConnected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return accounts.filter((a) => a.isConnected).map(sanitizeAccount);
  },
});

/** Internal — the FULL account row including OAuth tokens, for the email
 *  scan action only. Auth context propagates through ctx.runQuery from the
 *  client-called action, so requireAuth still scopes this to the caller. */
export const _getAccountWithTokens = internalQuery({
  args: { provider: v.union(v.literal("gmail"), v.literal("outlook")) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider),
      )
      .unique();
    return account ?? null;
  },
});

export const upsertAccount = mutation({
  args: {
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_user_and_provider", (q) =>
        q.eq("userId", userId).eq("provider", args.provider),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiry: args.tokenExpiry,
        isConnected: true,
      });
      return existing._id;
    }
    return await ctx.db.insert("emailAccounts", {
      ...args,
      isConnected: true,
      userId,
    });
  },
});

/** Internal — refreshed-token writeback from the scan action. Was a public
 *  mutation; nothing client-side ever called it, and token plumbing should
 *  not be public API surface. Ownership still verified via the propagated
 *  auth context. */
export const _updateTokens = internalMutation({
  args: {
    id: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    await ctx.db.patch(args.id, {
      accessToken: args.accessToken,
      tokenExpiry: args.tokenExpiry,
    });
  },
});

export const updateScanState = mutation({
  args: {
    id: v.id("emailAccounts"),
    lastScanTime: v.number(),
    lastScanMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const disconnect = mutation({
  args: { id: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const account = await ctx.db.get(args.id);
    if (account === null) throw new Error("Email account not found");
    if (account.userId !== userId) {
      throw new Error("You don't have access to this email account");
    }
    await ctx.db.delete(args.id);
  },
});

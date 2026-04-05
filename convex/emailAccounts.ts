import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

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
    return account ?? null;
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
    return accounts.filter((a) => a.isConnected);
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

export const updateTokens = mutation({
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

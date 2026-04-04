import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const getByProvider = query({
  args: { provider: v.union(v.literal("gmail"), v.literal("outlook")) },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .collect();
    return accounts[0] ?? null;
  },
});

export const listConnected = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("emailAccounts").collect();
    return all.filter((a) => a.isConnected);
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
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();
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
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("emailAccounts", { ...args, isConnected: true, userId });
  },
});

export const updateTokens = mutation({
  args: {
    id: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
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
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const disconnect = mutation({
  args: { id: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

// ===== Queries =====

export const listGuides = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getGuide = query({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (guide === null) return null;
    if (guide.userId !== userId) {
      throw new Error("You don't have access to this guide");
    }
    return guide;
  },
});

export const getGuideByCountry = query({
  args: { countryCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return guides.find((g) => g.countryCode === args.countryCode) ?? null;
  },
});

// ===== Mutations =====

export const createGuide = mutation({
  args: {
    countryCode: v.string(),
    countryName: v.string(),
    visaType: v.string(),
    userProfile: v.string(),
    guide: v.string(),
    checklist: v.string(),
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("visaGuides", { ...args, userId });
  },
});

export const updateChecklist = mutation({
  args: {
    id: v.id("visaGuides"),
    checklist: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (guide === null) throw new Error("Guide not found");
    if (guide.userId !== userId) {
      throw new Error("You don't have access to this guide");
    }
    await ctx.db.patch(args.id, { checklist: args.checklist });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("visaGuides"),
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (guide === null) throw new Error("Guide not found");
    if (guide.userId !== userId) {
      throw new Error("You don't have access to this guide");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteGuide = mutation({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (guide === null) throw new Error("Guide not found");
    if (guide.userId !== userId) {
      throw new Error("You don't have access to this guide");
    }
    await ctx.db.delete(args.id);
  },
});

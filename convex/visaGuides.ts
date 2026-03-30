import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listGuides = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("visaGuides").order("desc").collect();
  },
});

export const getGuide = query({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getGuideByCountry = query({
  args: { countryCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("visaGuides")
      .withIndex("by_country", (q) => q.eq("countryCode", args.countryCode))
      .first();
  },
});

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
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("visaGuides", args);
  },
});

export const updateChecklist = mutation({
  args: {
    id: v.id("visaGuides"),
    checklist: v.string(),
  },
  handler: async (ctx, args) => {
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
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteGuide = mutation({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// Shared validators — kept here so both the public query result and
// the internal write mutation use the exact same shape.
const ukEmbassyValidator = v.object({
  city: v.string(),
  phone: v.string(),
  address: v.string(),
  website: v.string(),
});

const essentialAppValidator = v.object({
  name: v.string(),
  purpose: v.string(),
});

const tapWaterValidator = v.union(
  v.literal("safe"),
  v.literal("unsafe"),
  v.literal("varies"),
);

/**
 * Look up cached country tips by ISO 3166-1 alpha-3 code (e.g. `"MUS"`).
 *
 * Public so the trip detail and country detail screens can subscribe —
 * once a previous user has triggered LLM generation for an uncovered
 * country, this query auto-pushes the cached row to every open client.
 *
 * Returns the cached row or `null` if no row exists yet (caller should
 * fall back to the handwritten `data/localInfo.ts` table or an empty
 * state).
 */
export const getCountryTips = query({
  args: { countryCode: v.string() },
  handler: async (ctx, { countryCode }) => {
    const upper = countryCode.toUpperCase();
    const row = await ctx.db
      .query("countryTipsCache")
      .withIndex("by_country", (q) => q.eq("countryCode", upper))
      .first();
    return row;
  },
});

/**
 * Write (or upsert) a generated country-tips row. Internal — only
 * called from the streaming generation action after the LLM completes.
 *
 * Two users hitting the same uncovered country simultaneously would
 * both miss the cache and both call this. The second write replaces
 * the first; the wasted ~$0.01 of duplicate generation is acceptable
 * (it happens once per country across all-time traffic).
 */
export const _writeCountryTips = internalMutation({
  args: {
    countryCode: v.string(),
    emergencyNumber: v.string(),
    policeNumber: v.string(),
    ambulanceNumber: v.string(),
    fireNumber: v.string(),
    ukEmbassy: v.optional(ukEmbassyValidator),
    essentialApps: v.array(essentialAppValidator),
    tippingCulture: v.string(),
    dressCode: v.optional(v.string()),
    scamWarnings: v.optional(v.array(v.string())),
    localCustoms: v.optional(v.array(v.string())),
    tapWater: tapWaterValidator,
    plugType: v.string(),
    simCard: v.string(),
    currencyTip: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const upper = args.countryCode.toUpperCase();
    const existing = await ctx.db
      .query("countryTipsCache")
      .withIndex("by_country", (q) => q.eq("countryCode", upper))
      .first();
    const payload = { ...args, countryCode: upper, generatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("countryTipsCache", payload);
    }
  },
});

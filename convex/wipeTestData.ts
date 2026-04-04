import { internalMutation } from "./_generated/server";

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

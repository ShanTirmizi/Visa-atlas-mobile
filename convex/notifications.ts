import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Expo's push gateway — delivers to APNs/FCM using the stored Expo push
// token. No SDK needed; a plain POST is the documented integration:
// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Trip owner's push token + display fields, or null when the trip is gone
 * or the owner never registered for notifications. */
export const _getTripReadyPayload = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    // Treat soft-deleted trips (deletedAt set, pending hard delete) the same
    // as gone — never push "trip ready" for a trip the user just deleted.
    if (!trip || trip.deletedAt !== undefined) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", trip.userId))
      .unique();
    if (!profile?.pushToken) return null;
    return {
      pushToken: profile.pushToken,
      countryName: trip.countryName,
      duration: trip.duration,
    };
  },
});

/**
 * Fires the "trip ready" push once generation settles to 'planned'.
 * Scheduled by completeGeneration. Best-effort: a missing token, an
 * uninstalled app, or an Expo gateway error must never affect the trip —
 * failures are logged and swallowed.
 */
export const sendTripReady = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const payload = await ctx.runQuery(
      internal.notifications._getTripReadyPayload,
      { tripId },
    );
    if (!payload) return;

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: payload.pushToken,
          title: `Your ${payload.countryName} trip is ready ✈️`,
          body: `${payload.duration} days planned — come take a look.`,
          data: { tripId },
          sound: "default",
        }),
      });
      if (!res.ok) {
        console.error(
          `Trip-ready push failed (${res.status}):`,
          (await res.text()).slice(0, 300),
        );
      }
    } catch (err) {
      console.error("Trip-ready push errored:", err);
    }
  },
});

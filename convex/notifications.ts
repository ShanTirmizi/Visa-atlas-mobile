import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { deriveVisaDeadline } from "../utils/visaDeadline";
import { visaData } from "../data/visaData";

// Expo's push gateway — delivers to APNs/FCM using the stored Expo push
// token. No SDK needed; a plain POST is the documented integration:
// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * True when the visa category requires the traveler to act ahead of the
 * trip — the only categories worth a deadline reminder. Tolerant matching:
 * the streamed vocabulary is 'e-visa'/'embassy', the static table uses
 * 'evisa'/'visa-required'.
 *
 * The streamed category is passport-aware (the generation prompt receives
 * the traveler's passports), so it's trusted for everyone. The static
 * data/visaData.ts table is an INDIAN-passport baseline — its category is
 * only consulted when `allowStaticFallback` is true (i.e. the user's visa
 * profile says they actually hold an IND passport). For anyone else, an
 * empty streamed category means "we don't know" → not actionable → no
 * reminder, rather than a reminder built on the wrong passport's rules.
 */
export function isActionableVisaCategory(
  streamed: string | undefined,
  countryCode: string,
  allowStaticFallback: boolean,
): boolean {
  const cat =
    streamed && streamed.length > 0
      ? streamed
      : allowStaticFallback
        ? (visaData.find((c) => c.code === countryCode)?.category ?? "")
        : "";
  const c = cat.toLowerCase();
  return (
    c === "embassy" ||
    c.includes("required") ||
    c.includes("evisa") ||
    c.includes("e-visa")
  );
}

/** The static visaData table's base categories/processing times describe an
 *  Indian passport. They're only honest fallbacks for travelers whose visa
 *  profile actually lists an IND passport. */
export function staticVisaDataApplies(passports: string[]): boolean {
  return passports.includes("IND");
}

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

/** Everything the visa-deadline reminder needs, re-read at FIRE time so
 * deleted trips, changed dates, or a revoked token make it a clean no-op.
 * Includes the owner's passports so the action can refuse to fall back to
 * the IND-only static visa table for non-IND passport holders. */
export const _getVisaReminderPayload = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.deletedAt !== undefined) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", trip.userId))
      .unique();
    if (!profile?.pushToken) return null;
    const visaProfile = await ctx.db
      .query("visaProfiles")
      .withIndex("by_user", (q) => q.eq("userId", trip.userId))
      .unique();
    return {
      pushToken: profile.pushToken,
      countryName: trip.countryName,
      countryCode: trip.countryCode,
      startDate: trip.startDate,
      visaCategory: trip.visaCategory,
      visaProcessingTime: trip.visaProcessingTime,
      passports: visaProfile?.passports ?? [],
    };
  },
});

/**
 * Visa apply-by reminder, scheduled by completeGeneration for the morning
 * of the derived deadline. Everything is recomputed at fire time — if the
 * user moved the trip dates, deleted the trip, or the deadline no longer
 * lands today (±1 day drift tolerance), it no-ops silently.
 */
export const sendVisaDeadlineReminder = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const p = await ctx.runQuery(
      internal.notifications._getVisaReminderPayload,
      { tripId },
    );
    if (!p) return;
    // The static visaData table is an Indian-passport baseline — only let
    // it back any part of this reminder when the traveler actually holds
    // an IND passport. Otherwise the only trusted inputs are the streamed
    // (passport-aware) category and the trip doc's own processing time;
    // when those don't yield a deadline, skip rather than push wrong data.
    const allowStaticFallback = staticVisaDataApplies(p.passports);
    if (!isActionableVisaCategory(p.visaCategory, p.countryCode, allowStaticFallback)) {
      return;
    }

    const staticEntry = allowStaticFallback
      ? visaData.find((c) => c.code === p.countryCode)
      : undefined;
    const info = deriveVisaDeadline({
      startDate: p.startDate,
      processingTime: p.visaProcessingTime,
      fallbackProcessingTime: staticEntry?.processingTime,
    });
    // Only fire when the recomputed deadline still lands now-ish.
    if (!info || info.daysLeft < -1 || info.daysLeft > 1) return;

    const startLabel = p.startDate
      ? new Date(`${p.startDate}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "your trip";
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: p.pushToken,
          title: `Time to apply for your ${p.countryName} visa`,
          body: `Your apply-by date is here — processing needs to finish before ${startLabel}.`,
          data: { tripId },
          sound: "default",
        }),
      });
      if (!res.ok) {
        console.error(
          `Visa-deadline push failed (${res.status}):`,
          (await res.text()).slice(0, 300),
        );
      }
    } catch (err) {
      console.error("Visa-deadline push errored:", err);
    }
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

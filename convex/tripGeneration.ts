import { v } from "convex/values";
import { internalMutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { lookupStaticFacts } from "../constants/staticTripFacts";
import { SECTION_FIELD_MAP } from "./lib/sectionFieldMap";

// Args validator shared by `generateTrip` and `insertGenerationStub`.
// Mirrors the planner sheet form; deliberately permissive on optional fields.
const generateTripArgs = {
  countryCode: v.string(),
  countryName: v.string(),
  capital: v.string(),
  duration: v.number(),
  vibe: v.string(),
  budget: v.string(),
  interests: v.string(),
  activityStyles: v.array(v.string()),
  travelParty: v.string(),
  heldVisas: v.array(v.string()),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  companions: v.optional(v.string()),
  surpriseMe: v.optional(v.boolean()),
  vibeTag: v.optional(v.string()),
};

/**
 * Insert the trip stub immediately on tap-Generate. All content fields
 * are empty strings; static facts come from the local lookup so they're
 * present from t=0. Returns the new tripId so the client can navigate.
 */
export const insertGenerationStub = internalMutation({
  args: {
    userId: v.id("users"),
    input: v.object(generateTripArgs),
  },
  handler: async (ctx, { userId, input }): Promise<Id<"trips">> => {
    const facts = lookupStaticFacts(input.countryCode);
    const tripId = await ctx.db.insert("trips", {
      userId,
      countryCode: input.countryCode,
      countryName: input.countryName,
      capital: input.capital,
      duration: input.duration,
      // Static facts (instant, free, no LLM):
      currency: facts?.currency ?? "",
      language: facts?.language ?? "",
      timezone: facts?.timezone ?? "",
      iataCode: facts?.iataCode ?? "",
      region: facts?.region ?? "",
      costLevel: facts?.costLevel ?? 3,
      flightHours: facts?.flightHoursFromUS ?? 0,
      // Generation state:
      status: "generating",
      generationStartedAt: Date.now(),
      originalInputs: JSON.stringify(input),
      // Empty content fields — populated by streaming patches:
      itinerary: "",
      budgetBreakdown: "",
      packingSuggestions: "",
      visaChecklist: "",
      visaCategory: "",
      highlights: "",
      accommodationTips: "",
      dailyBudget: "",
      // Optional fields stay undefined until populated:
      companions: input.companions,
      startDate: input.startDate,
      endDate: input.endDate,
      surpriseMe: input.surpriseMe,
      vibeTag: input.vibeTag,
    });
    // Owner collaborator row — same pattern as createTrip
    await ctx.db.insert("tripCollaborators", {
      tripId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
    return tripId;
  },
});

// Re-exported so the action file can use the args shape.
export { generateTripArgs };

/**
 * Patch a single section's content into the trip doc. Called by the
 * streaming action as each section completes (and per-day for itinerary).
 *
 * Four modes (priority order):
 *   - failed=true       → adds `section` to failedSections, does not
 *                         touch the field
 *   - "itinerary-day:N" → parses content as one ItineraryDay JSON, sets
 *                         it at index N in the parsed itinerary array,
 *                         re-stringifies
 *   - "heroImage"       → patches the heroImage field directly with the
 *                         JSON-stringified image record
 *   - other             → looks up field via SECTION_FIELD_MAP, writes
 *                         content directly
 */
export const patchTripSection = internalMutation({
  args: {
    tripId: v.id("trips"),
    section: v.string(),
    content: v.string(),
    failed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) {
      // Trip was deleted mid-generation; silently no-op.
      return;
    }
    if (args.failed) {
      const existing = trip.failedSections ?? [];
      if (!existing.includes(args.section)) {
        await ctx.db.patch(args.tripId, {
          failedSections: [...existing, args.section],
        });
      }
      return;
    }
    // Itinerary day-by-day stream
    if (args.section.startsWith("itinerary-day:")) {
      const idx = Number(args.section.split(":")[1]);
      if (!Number.isInteger(idx) || idx < 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const days: any[] = trip.itinerary ? safeParseArray(trip.itinerary) : [];
      try {
        days[idx] = JSON.parse(args.content);
      } catch {
        // Malformed day payload — record as failed without touching itinerary.
        const existing = trip.failedSections ?? [];
        if (!existing.includes(args.section)) {
          await ctx.db.patch(args.tripId, {
            failedSections: [...existing, args.section],
          });
        }
        return;
      }
      await ctx.db.patch(args.tripId, { itinerary: JSON.stringify(days) });
      return;
    }
    // Hero image (set as a JSON string on completion of the image fetch)
    if (args.section === "heroImage") {
      await ctx.db.patch(args.tripId, { heroImage: args.content });
      return;
    }
    // Standard section
    const field = SECTION_FIELD_MAP[args.section as keyof typeof SECTION_FIELD_MAP];
    if (!field) {
      // Unknown section — log and ignore.
      console.warn(`patchTripSection: unknown section "${args.section}"`);
      return;
    }
    await ctx.db.patch(args.tripId, { [field]: args.content });
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseArray(raw: string): any[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Flip status from "generating" to "planned". Called once all streamed
 * sections have either completed or been marked failed.
 */
export const completeGeneration = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.status !== "generating") return;
    await ctx.db.patch(tripId, { status: "planned" });
  },
});

/**
 * Flip status to "failed". Called by the 60s watchdog if no sections
 * have streamed any content, or by a top-level catch in the streaming
 * action.
 */
export const failGeneration = internalMutation({
  args: {
    tripId: v.id("trips"),
    reason: v.string(),
  },
  handler: async (ctx, { tripId, reason }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    if (trip.status !== "generating") return; // already settled
    await ctx.db.patch(tripId, { status: "failed" });
    console.warn(`Trip ${tripId} failed: ${reason}`);
  },
});

/**
 * 60s watchdog. If no sections have streamed any content, the trip is
 * considered totally failed (LLM outage / rate limit / network).
 *
 * "Has streamed content" = any of: itinerary array length > 0, OR any
 * non-empty content field, OR any failedSections entry.
 */
export const checkGenerationTimeout = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.status !== "generating") return;
    const itineraryLen = trip.itinerary
      ? safeParseArray(trip.itinerary).length
      : 0;
    const hasAnyContent =
      itineraryLen > 0 ||
      !!trip.highlights ||
      !!trip.visaChecklist ||
      !!trip.budgetBreakdown ||
      !!trip.packingSuggestions ||
      !!trip.accommodationTips ||
      (trip.failedSections ?? []).length > 0;
    if (!hasAnyContent) {
      await ctx.db.patch(tripId, { status: "failed" });
      console.warn(`Trip ${tripId} timed out at 60s with no content`);
    }
  },
});

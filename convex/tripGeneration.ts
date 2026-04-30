import { v } from "convex/values";
import { internalMutation, internalAction, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { lookupStaticFacts } from "../constants/staticTripFacts";
import { SECTION_FIELD_MAP, STREAMING_SECTIONS } from "./lib/sectionFieldMap";
import {
  buildSystemPrompt,
  buildItineraryUserPrompt,
  buildVisaUserPrompt,
  buildBudgetUserPrompt,
  buildHighlightsUserPrompt,
  buildTipsBundleUserPrompt,
  streamAnthropic,
  makeWholeSectionBuffer,
  makeItineraryStreamParser,
} from "./lib/anthropicStream";

/** Coerce a value into a string. Strings pass through; arrays/objects get
 * JSON.stringify'd; nullish becomes the supplied fallback (use "[]" for
 * fields that should hold JSON-stringified arrays). Guards transforms
 * against Claude inlining a JS array where a JSON-stringified array was
 * requested — Convex's v.string() validator would otherwise throw. */
const coerceToString = (v: unknown, fallback: string = "[]"): string => {
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  return JSON.stringify(v);
};

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
        const parsed = JSON.parse(args.content);
        // Inject the 1-indexed day number — the LLM doesn't emit it but
        // every consumer (DayDeck, HighlightsStrip, day detail screen)
        // expects `day.day` to be set. Without this they render "DAY · undefined".
        days[idx] = { ...parsed, day: idx + 1 };
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
    console.error(`Trip ${tripId} failed: ${reason}`);
  },
});

/**
 * 60s watchdog. If no sections have streamed any content, the trip is
 * considered totally failed (LLM outage / rate limit / network).
 *
 * "Has streamed content" = any of: itinerary array length > 0, OR any
 * STREAMING_SECTIONS field non-empty, OR any failedSections entry.
 */
export const checkGenerationTimeout = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.status !== "generating") return;
    const itineraryLen = trip.itinerary
      ? safeParseArray(trip.itinerary).length
      : 0;
    const hasAnyStreamedField = STREAMING_SECTIONS.some(
      (s) => !!trip[s],
    );
    const hasAnyContent =
      itineraryLen > 0 ||
      hasAnyStreamedField ||
      (trip.failedSections ?? []).length > 0;
    if (!hasAnyContent) {
      await ctx.db.patch(tripId, { status: "failed" });
      console.error(`Trip ${tripId} timed out at 60s with no content`);
    }
  },
});

/**
 * Orchestrates 5 parallel Anthropic streaming calls. As each section
 * completes (or each itinerary day), patches the trip doc via
 * patchTripSection. On success, calls completeGeneration. Errors in
 * one section don't abort the others.
 */
export const runGenerationStream = internalAction({
  args: {
    tripId: v.id("trips"),
    input: v.object(generateTripArgs),
  },
  handler: async (ctx, { tripId, input }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.tripGeneration.failGeneration, {
        tripId,
        reason: "ANTHROPIC_API_KEY env var not set",
      });
      return;
    }

    const systemPrompt = buildSystemPrompt(input);

    // Schedule the 60s watchdog
    await ctx.scheduler.runAfter(60_000, internal.tripGeneration.checkGenerationTimeout, { tripId });

    // Helper that runs one section call and patches the doc on completion
    const runSection = async (
      sectionName: string,
      userPrompt: string,
      maxTokens: number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onDoneTransform?: (raw: string) => Array<{ section: string; content: string }>,
    ): Promise<void> => {
      return new Promise((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        streamAnthropic(
          { apiKey, systemPrompt, userPrompt, maxTokens },
          makeWholeSectionBuffer(
            async (full) => {
              try {
                if (onDoneTransform) {
                  const patches = onDoneTransform(full);
                  for (const p of patches) {
                    await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                      tripId,
                      section: p.section,
                      content: p.content,
                    });
                  }
                } else {
                  await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                    tripId,
                    section: sectionName,
                    content: full,
                  });
                }
              } catch (err) {
                console.error(`Section ${sectionName} patch failed:`, err);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId,
                  section: sectionName,
                  content: "",
                  failed: true,
                });
              }
              settle();
            },
            async (err) => {
              console.error(`Section ${sectionName} stream errored:`, err);
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId,
                section: sectionName,
                content: "",
                failed: true,
              });
              settle();
            },
          ),
        );
      });
    };

    // Itinerary streams day-by-day with its own parser
    const runItinerary = async (): Promise<void> => {
      return new Promise((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const userPrompt = buildItineraryUserPrompt(input);
        const itineraryParser = makeItineraryStreamParser(
          async (dayIndex, dayJson) => {
            await ctx.runMutation(internal.tripGeneration.patchTripSection, {
              tripId,
              section: `itinerary-day:${dayIndex}`,
              content: dayJson,
            });
            if (dayIndex === 0) {
              await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
            }
          },
          (err) => console.error("Itinerary parse error:", err),
        );
        streamAnthropic(
          { apiKey, systemPrompt, userPrompt, maxTokens: 8192 },
          {
            onDelta: (text) => itineraryParser.onDelta(text),
            onComplete: async () => {
              itineraryParser.onComplete();
              await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
              settle();
            },
            onError: async (err) => {
              console.error("Itinerary stream errored:", err);
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId,
                section: "itinerary",
                content: "",
                failed: true,
              });
              settle();
            },
          },
        );
      });
    };

    // Tips bundle returns three sections in one JSON; split into patches
    const tipsBundleTransform = (raw: string): Array<{ section: string; content: string }> => {
      try {
        const parsed = JSON.parse(raw);
        return [
          { section: "packingSuggestions", content: coerceToString(parsed.packingSuggestions, "[]") },
          { section: "accommodationTips", content: coerceToString(parsed.accommodationTips, "") },
          { section: "localEssentials", content: coerceToString(parsed.localEssentials, "[]") },
        ];
      } catch {
        return [
          { section: "packingSuggestions", content: "[]" },
          { section: "accommodationTips", content: "" },
          { section: "localEssentials", content: "[]" },
        ];
      }
    };

    // Visa returns three fields in one JSON; split into patches.
    // visaCategory is omitted from this v1 — the trip stub leaves it as ""
    // and the UI handles empty visaCategory gracefully. A followup task
    // can extend SECTION_FIELD_MAP to include visaCategory.
    const visaTransform = (raw: string): Array<{ section: string; content: string }> => {
      try {
        const parsed = JSON.parse(raw);
        return [
          { section: "visaNotes", content: coerceToString(parsed.visaNotes, "") },
          { section: "visaChecklist", content: coerceToString(parsed.visaChecklist, "[]") },
        ];
      } catch {
        return [
          { section: "visaNotes", content: "" },
          { section: "visaChecklist", content: "[]" },
        ];
      }
    };

    try {
      await Promise.all([
        runItinerary(),
        runSection("__visa-bundle__", buildVisaUserPrompt(input), 1024, visaTransform),
        runSection("budgetBreakdown", buildBudgetUserPrompt(input), 1024),
        runSection("highlights", buildHighlightsUserPrompt(input), 512),
        runSection("__tips-bundle__", buildTipsBundleUserPrompt(input), 2048, tipsBundleTransform),
      ]);
      await ctx.runMutation(internal.tripGeneration.completeGeneration, { tripId });
    } catch (err) {
      console.error("runGenerationStream top-level failure:", err);
      await ctx.runMutation(internal.tripGeneration.failGeneration, {
        tripId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  },
});

/**
 * Public entry point. Inserts a stub trip row, schedules the streaming
 * action, returns the trip ID immediately so the client can navigate.
 */
export const generateTrip = action({
  args: generateTripArgs,
  handler: async (ctx, args): Promise<Id<"trips">> => {
    const userId = await requireAuth(ctx);
    const tripId: Id<"trips"> = await ctx.runMutation(
      internal.tripGeneration.insertGenerationStub,
      { userId, input: args },
    );
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runGenerationStream, {
      tripId,
      input: args,
    });
    return tripId;
  },
});

/**
 * Retry a single section after a failure. Re-runs that one section's
 * stream and removes it from failedSections on success.
 *
 * Auth: ownership is verified via the `_verifyTripOwner` internal query
 * because actions can't access `ctx.db` directly.
 */
export const retrySection = action({
  args: {
    tripId: v.id("trips"),
    section: v.string(),
  },
  handler: async (ctx, { tripId, section }) => {
    const userId = await requireAuth(ctx);
    const isOwner = await ctx.runQuery(internal.tripGeneration._verifyTripOwner, {
      tripId,
      userId,
    });
    if (!isOwner) throw new Error("Not authorized");

    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip) throw new Error("Trip not found");
    if (!trip.originalInputs) throw new Error("No original inputs stored — cannot retry");

    const input = JSON.parse(trip.originalInputs);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const systemPrompt = buildSystemPrompt(input);

    let userPrompt: string;
    let maxTokens = 1024;
    switch (section) {
      case "highlights":
        userPrompt = buildHighlightsUserPrompt(input);
        maxTokens = 512;
        break;
      case "visaChecklist":
      case "visaNotes":
        userPrompt = buildVisaUserPrompt(input);
        break;
      case "budgetBreakdown":
        userPrompt = buildBudgetUserPrompt(input);
        break;
      case "packingSuggestions":
      case "accommodationTips":
      case "localEssentials":
        userPrompt = buildTipsBundleUserPrompt(input);
        maxTokens = 2048;
        break;
      default:
        throw new Error(`Cannot retry unknown section: ${section}`);
    }

    await new Promise<void>((resolve) => {
      streamAnthropic(
        { apiKey, systemPrompt, userPrompt, maxTokens },
        makeWholeSectionBuffer(
          async (full) => {
            if (section === "highlights" || section === "budgetBreakdown") {
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId, section, content: full.trim(),
              });
            } else if (["visaChecklist", "visaNotes"].includes(section)) {
              try {
                const parsed = JSON.parse(full);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "visaNotes", content: coerceToString(parsed.visaNotes, ""),
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "visaChecklist", content: coerceToString(parsed.visaChecklist, "[]"),
                });
              } catch {
                // swallow — leave failedSections intact
              }
            } else {
              try {
                const parsed = JSON.parse(full);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "packingSuggestions", content: coerceToString(parsed.packingSuggestions, "[]"),
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "accommodationTips", content: coerceToString(parsed.accommodationTips, ""),
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "localEssentials", content: coerceToString(parsed.localEssentials, "[]"),
                });
              } catch {
                // swallow
              }
            }
            await ctx.runMutation(internal.tripGeneration._clearFailedSection, { tripId, section });
            resolve();
          },
          (err) => {
            console.error(`Retry section ${section} failed:`, err);
            resolve();
          },
        ),
      );
    });
  },
});

/** Internal query for retrySection to read the trip — keeps the action stateless. */
export const _getTripForRetry = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => ctx.db.get(tripId),
});

/**
 * Verify the caller is the trip owner. The action calls this so it can
 * run an ownership check from a context where `ctx.db` is available.
 * (We can't use `checkTripPermission` directly because that helper
 * accepts only Query/MutationCtx — its `ctx.db` access wouldn't compile
 * in an action.) Returns `true` only when the caller is the owner.
 */
export const _verifyTripOwner = internalQuery({
  args: { tripId: v.id("trips"), userId: v.id("users") },
  handler: async (ctx, { tripId, userId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return false;
    const collab = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", tripId).eq("userId", userId))
      .first();
    return collab?.role === "owner";
  },
});

/** Remove a section (and any siblings from a bundle retry) from failedSections. */
export const _clearFailedSection = internalMutation({
  args: { tripId: v.id("trips"), section: v.string() },
  handler: async (ctx, { tripId, section }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    const failed = trip.failedSections ?? [];
    const bundleSiblings: Record<string, string[]> = {
      visaChecklist: ["visaChecklist", "visaNotes"],
      visaNotes: ["visaChecklist", "visaNotes"],
      packingSuggestions: ["packingSuggestions", "accommodationTips", "localEssentials"],
      accommodationTips: ["packingSuggestions", "accommodationTips", "localEssentials"],
      localEssentials: ["packingSuggestions", "accommodationTips", "localEssentials"],
    };
    const toRemove = bundleSiblings[section] ?? [section];
    const next = failed.filter((s) => !toRemove.includes(s));
    await ctx.db.patch(tripId, { failedSections: next });
  },
});

/**
 * Fetch trip images via the existing Vercel /api/trip-images endpoint
 * and patch hero/day/activity images into the trip doc.
 *
 * Called from runGenerationStream once Day 1 lands (for fast hero) and
 * again after the full itinerary streams (to backfill remaining day
 * images). The endpoint is idempotent — both calls populate the same
 * fields; the second overwrites the first.
 */
export const fetchAndPatchImages = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip || !trip.itinerary) return;
    let days: Array<{
      morningPlace?: string;
      afternoonPlace?: string;
      eveningPlace?: string;
      title?: string;
      heroSubject?: string;
    }> = [];
    try {
      days = JSON.parse(trip.itinerary);
    } catch {
      return;
    }
    if (days.length === 0) return;

    const activities = days
      .flatMap((d) => [
        d.morningPlace ? { name: 'morning', place: d.morningPlace } : null,
        d.afternoonPlace ? { name: 'afternoon', place: d.afternoonPlace } : null,
        d.eveningPlace ? { name: 'evening', place: d.eveningPlace } : null,
      ])
      .filter(Boolean);

    const dayHeroSubjects = days.map(
      (d) =>
        d.heroSubject ??
        d.morningPlace ??
        d.afternoonPlace ??
        d.eveningPlace ??
        d.title ??
        '',
    );

    try {
      const res = await fetch('https://visa-atlas.vercel.app/api/trip-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName: trip.countryName,
          capital: trip.capital,
          activities,
          dayHeroSubjects,
        }),
      });
      if (!res.ok) return;
      const imgData = (await res.json()) as {
        hero?: unknown;
        activities?: unknown[];
        dayImages?: unknown[];
      };
      if (imgData.hero) {
        await ctx.runMutation(internal.tripGeneration.patchTripSection, {
          tripId,
          section: 'heroImage',
          content: JSON.stringify(imgData.hero),
        });
      }
      if (imgData.dayImages?.length) {
        await ctx.runMutation(internal.tripGeneration._patchTripField, {
          tripId,
          field: 'dayImages',
          value: JSON.stringify(imgData.dayImages),
        });
      }
      if (imgData.activities?.length) {
        await ctx.runMutation(internal.tripGeneration._patchTripField, {
          tripId,
          field: 'activityImages',
          value: JSON.stringify(imgData.activities),
        });
      }
    } catch (err) {
      console.warn(`Image fetch failed for ${tripId}:`, err);
    }
  },
});

/** Generic internal patch helper for fields not in SECTION_FIELD_MAP. */
export const _patchTripField = internalMutation({
  args: {
    tripId: v.id("trips"),
    field: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { tripId, field, value }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.patch(tripId, { [field]: value } as any);
  },
});

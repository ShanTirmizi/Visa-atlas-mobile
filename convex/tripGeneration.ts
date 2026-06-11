import { v } from "convex/values";
import { internalMutation, internalAction, internalQuery, mutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { checkTripPermission, requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { lookupStaticFacts } from "../constants/staticTripFacts";
import { deriveVisaDeadline } from "../utils/visaDeadline";
import { visaData } from "../data/visaData";
import { isActionableVisaCategory } from "./notifications";
import { SECTION_FIELD_MAP, STREAMING_SECTIONS } from "./lib/sectionFieldMap";
import {
  buildSystemPrompt,
  buildItineraryUserPrompt,
  buildDiningUserPrompt,
  buildVisaUserPrompt,
  buildBudgetUserPrompt,
  buildHighlightsUserPrompt,
  buildCountryTipsPrompt,
  streamAnthropic,
  makeWholeSectionBuffer,
  makeItineraryStreamParser,
} from "./lib/anthropicStream";
import type { DiningDayContext } from "./lib/anthropicStream";
import { normalizeDiningGuide, isUsableStop } from "../types/itinerary";
import { localInfo } from "../data/localInfo";
import { toAlpha3 } from "../utils/countryCode";

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

/** The visaCategory vocabulary buildVisaUserPrompt requests — anything else
 * from the model is dropped rather than patched into category-driven UI. */
const STREAMED_VISA_CATEGORIES = new Set([
  "visa-free",
  "visa-on-arrival",
  "e-visa",
  "embassy",
  "varies",
]);

/** Strip optional markdown code fences the model sometimes adds despite
 * instructions — fenced JSON otherwise fails JSON.parse in the section
 * transforms. */
const stripCodeFences = (raw: string): string =>
  raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

/** Extract the first complete top-level JSON object from a string —
 * tolerant of prose preambles/codas the model sometimes adds around the
 * JSON despite instructions. Returns null when no balanced object exists
 * (e.g. truncated output). String-aware brace walk. */
function extractFirstJsonObject(raw: string): string | null {
  const s = stripCodeFences(raw);
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// Args validator for `generateTrip`; also embedded in `runGenerationStream`'s
// args. Mirrors the planner sheet form; deliberately permissive on optional fields.
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
  // ISO codes of the traveler's passport(s) — drives passport-correct visa
  // sections. Optional for back-compat with pre-existing originalInputs.
  passports: v.optional(v.array(v.string())),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  companions: v.optional(v.string()),
  surpriseMe: v.optional(v.boolean()),
  vibeTag: v.optional(v.string()),
  // User's free-text brief, optionally merged with refinement answers.
  // Trimmed and length-capped (≤2000) in the stub handler.
  userNotes: v.optional(v.string()),
  // The interpolated refinement-answer phrases (e.g. "drawn to mountain
  // trails"), stored separately so the trip brief readout can render them
  // as chips. The merged prose in userNotes remains the LLM's context.
  refinementAnswers: v.optional(v.array(v.string())),
};

/**
 * Public entry point. Inserts the trip stub immediately on tap-Generate
 * (content fields empty; static facts from the local lookup so they're
 * present from t=0), schedules the streaming action, and returns the new
 * tripId so the client can navigate straight onto the live trip screen.
 *
 * This is a MUTATION on purpose — the Convex client auto-retries mutations
 * across websocket reconnects, so a network blip on tap can't strand the
 * user the way a dropped in-flight action does ("Connection lost while
 * action was in flight"). The heavy LLM work runs in the scheduled
 * `runGenerationStream` internal action and streams into the doc, which
 * the trip screen watches reactively.
 */
export const generateTrip = mutation({
  args: generateTripArgs,
  handler: async (ctx, input): Promise<Id<"trips">> => {
    const userId = await requireAuth(ctx);
    if (
      !Number.isInteger(input.duration) ||
      input.duration < 1 ||
      input.duration > 60
    ) {
      throw new Error("duration must be between 1 and 60 days");
    }
    const facts = lookupStaticFacts(input.countryCode);

    // Normalize userNotes — trim, treat whitespace-only as undefined,
    // hard-reject anything over 2000 chars (defense in depth; the client
    // caps original notes at 500, leaving room for merged refinement answers).
    const trimmedNotes = input.userNotes?.trim();
    const normalizedUserNotes =
      trimmedNotes && trimmedNotes.length > 0 ? trimmedNotes : undefined;
    if (normalizedUserNotes && normalizedUserNotes.length > 2000) {
      throw new Error("userNotes exceeds 2000 character limit");
    }

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
      userNotes: normalizedUserNotes,
      refinementAnswers: input.refinementAnswers?.length
        ? input.refinementAnswers
        : undefined,
    });
    // Owner collaborator row — same pattern as createTrip
    await ctx.db.insert("tripCollaborators", {
      tripId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runGenerationStream, {
      tripId,
      input,
    });
    return tripId;
  },
});

// Re-exported so other modules can reuse the args shape.
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
      const next = [...existing];
      for (const key of toFailureKeys(args.section)) {
        if (!next.includes(key)) next.push(key);
      }
      if (next.length !== existing.length) {
        await ctx.db.patch(args.tripId, { failedSections: next });
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
        // Malformed day payload — record the itinerary as failed (the
        // retry UI speaks in section keys, not 'itinerary-day:N' slices)
        // without touching the days that already landed.
        const existing = trip.failedSections ?? [];
        if (!existing.includes("itinerary")) {
          await ctx.db.patch(args.tripId, {
            failedSections: [...existing, "itinerary"],
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
 * Output-token budget for the itinerary stream, scaled to trip length.
 * A generated day now runs ~750–1100 output tokens (the prose plus 4-7
 * structured stops at ~350 extra tokens/day); a flat 8192 cap silently
 * truncated long itineraries, which then completed as 'planned' with
 * missing days. Sonnet supports 64k output tokens, so trips up to ~52
 * days stay fully inside the cap; longer trips can truncate at the
 * ceiling, where completeGeneration's realDays < duration check marks
 * 'itinerary' failed so the retry card surfaces.
 */
const itineraryMaxTokens = (duration: number) =>
  Math.min(64_000, Math.max(8_192, 2_048 + duration * 1150));

/**
 * Stream the itinerary (day-by-day) into the trip doc. Shared by the main
 * generation run and the per-section retry path. Resolves when the stream
 * settles — success or failure — and marks 'itinerary' failed on stream
 * errors so the retry card can surface. Every path ends in settle(); an
 * escaped rejection here would hang the caller's Promise.all and wedge
 * the run in 'generating'.
 */
function streamItineraryIntoTrip(
  ctx: ActionCtx,
  tripId: Id<"trips">,
  // Parsed originalInputs / generateTrip args — only duration is read here;
  // the prompt builders consume the rest.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  apiKey: string,
  systemPrompt: string,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const userPrompt = buildItineraryUserPrompt(input);
    // The parser fire-and-forgets the day callback, so collect each
    // patch's promise and await them all in onComplete — otherwise the
    // final day's patchTripSection may not have committed when the stream
    // settles, and downstream readers (the dining day-context read, the
    // itinerary-retry after-check) miss the last day.
    const pending: Promise<void>[] = [];
    const itineraryParser = makeItineraryStreamParser(
      (dayIndex, dayJson) => {
        pending.push(
          (async () => {
            try {
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId,
                section: `itinerary-day:${dayIndex}`,
                content: dayJson,
              });
              if (dayIndex === 0) {
                await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
              }
            } catch (err) {
              // Never let a rejection escape as unhandled — each pushed
              // promise resolves even when the patch fails.
              console.error(`Itinerary day ${dayIndex} patch failed:`, err);
            }
          })(),
        );
      },
      (err) => console.error("Itinerary parse error:", err),
    );
    streamAnthropic(
      {
        apiKey,
        systemPrompt,
        userPrompt,
        maxTokens: itineraryMaxTokens(Number(input?.duration) || 7),
      },
      {
        onDelta: (text) => itineraryParser.onDelta(text),
        onComplete: async () => {
          try {
            itineraryParser.onComplete();
            // Wait for every per-day patch to commit before settling.
            // allSettled never rejects, and each pushed promise already
            // catches its own errors — never-throw discipline holds.
            await Promise.allSettled(pending);
            await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
          } catch (err) {
            console.error("Itinerary completion hook failed:", err);
          } finally {
            settle();
          }
        },
        onError: async (err) => {
          console.error("Itinerary stream errored:", err);
          try {
            await ctx.runMutation(internal.tripGeneration.patchTripSection, {
              tripId,
              section: "itinerary",
              content: "",
              failed: true,
            });
          } catch (patchErr) {
            console.error("Failed to record itinerary failure:", patchErr);
          } finally {
            settle();
          }
        },
      },
    );
  });
}

/** True when a parsed itinerary day carries ≥1 usable structured stop.
 * Built on the shared isUsableStop from types/itinerary — the single
 * definition of "renderable stop" — so server and client never disagree
 * on which days need backfilling. Walks untyped parsed JSON, hence any. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hasUsableStops = (day: any): boolean =>
  Array.isArray(day?.stops) && day.stops.some(isUsableStop);

/**
 * Generate the dining guide and patch it into `trips.diningGuide`. Runs
 * inside runRetrySection's diningGuide branch — both the main generation
 * run (via _beginDiningRun, scheduled after the itinerary settles) and
 * the retry/backfill path land here. The prompt is anchored to the
 * FINAL streamed days — one compact line per day listing where the
 * traveler actually is — so restaurant picks land near the plan.
 *
 * Same settle discipline as streamItineraryIntoTrip: resolves when the
 * stream settles — success or failure — and marks 'diningGuide' failed on
 * any unusable outcome. Every path ends in settle(); an escaped rejection
 * here would hang the caller's Promise chain and wedge the run.
 */
async function streamDiningIntoTrip(
  ctx: ActionCtx,
  tripId: Id<"trips">,
  // Parsed originalInputs / generateTrip args — duration feeds the
  // normalizer's day-range clamp; the prompt builders consume the rest.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  apiKey: string,
  systemPrompt: string,
): Promise<void> {
  // Mark the section failed without ever letting the marker's own failure
  // escape — same shape as runSection's markFailed.
  const markFailed = async () => {
    try {
      await ctx.runMutation(internal.tripGeneration.patchTripSection, {
        tripId,
        section: "diningGuide",
        content: "",
        failed: true,
      });
    } catch (patchErr) {
      console.error("Dining guide failure marker also failed:", patchErr);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let days: any[] = [];
  try {
    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip) return; // deleted mid-run — nothing to anchor or mark
    days = safeParseArray(trip.itinerary ?? "").filter(Boolean);
  } catch (err) {
    console.error("Dining guide trip read failed:", err);
    await markFailed();
    return;
  }
  if (days.length === 0) {
    // Dining without an itinerary to anchor to is meaningless — surface
    // the retry card instead of generating un-anchored picks.
    await markFailed();
    return;
  }

  const dayContexts: DiningDayContext[] = days.map((day, idx) => {
    // Prefer the structured stops' names; fall back to the legacy
    // per-slot place fields for pre-stops trips.
    const fromStops: string[] = Array.isArray(day.stops)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (day.stops as any[]).filter(isUsableStop).map((s) => String(s.name))
      : [];
    const places =
      fromStops.length > 0
        ? fromStops
        : [day.morningPlace, day.afternoonPlace, day.eveningPlace]
            .filter(Boolean)
            .map(String);
    return {
      day: day.day ?? idx + 1,
      title: day.title ?? "",
      places: [...new Set(places)].slice(0, 6),
    };
  });

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    streamAnthropic(
      {
        apiKey,
        systemPrompt,
        userPrompt: buildDiningUserPrompt(input, dayContexts),
        // 8192: the prompt targets up to 22 spots (~3.2-3.9k tokens typical,
        // more with long `days` arrays) — 4096 truncated long guides into
        // unbalanced JSON, and every retry rebuilt the identical
        // prompt+budget, failing forever.
        maxTokens: 8192,
      },
      makeWholeSectionBuffer(
        async (full) => {
          try {
            // Tolerate prose around the JSON; null means truncated or no
            // object at all. normalizeDiningGuide returns null when nothing
            // usable survives validation — mark failed rather than store
            // an empty guide.
            const cleaned = extractFirstJsonObject(full);
            const normalized = cleaned
              ? normalizeDiningGuide(
                  JSON.parse(cleaned),
                  Number(input?.duration) || days.length,
                )
              : null;
            if (!normalized) {
              console.error(
                "Dining guide output unusable:",
                full.slice(0, 200),
              );
              await markFailed();
              return;
            }
            await ctx.runMutation(internal.tripGeneration.patchTripSection, {
              tripId,
              section: "diningGuide",
              content: JSON.stringify(normalized),
            });
          } catch (err) {
            console.error("Dining guide parse/patch failed:", err);
            await markFailed();
          } finally {
            settle();
          }
        },
        async (err) => {
          console.error("Dining guide stream errored:", err);
          try {
            await markFailed();
          } finally {
            settle();
          }
        },
      ),
    );
  });
}

/**
 * Map internal stream identifiers to the section keys the client's retry
 * UI checks. The streams run as bundles ('__visa-bundle__') and per-day
 * slices ('itinerary-day:3'), but hasFailed()/retrySection speak in real
 * section keys — recording the internal names verbatim left the retry
 * cards permanently unreachable.
 */
function toFailureKeys(section: string): string[] {
  if (section === "__visa-bundle__") return ["visaChecklist", "visaNotes"];
  if (section === "__budget-bundle__") return ["budgetBreakdown", "dailyBudget"];
  if (section.startsWith("itinerary-day:") || section === "itinerary") {
    return ["itinerary"];
  }
  return [section];
}

/**
 * Flip status from "generating" to "planned". Called once all streamed
 * sections have either completed or been marked failed.
 *
 * If literally nothing landed (LLM outage / every stream failed), 'planned'
 * would render an empty trip that looks normal in the trips list — settle
 * those as 'failed' so TripFailedScreen offers a full retry instead.
 */
export const completeGeneration = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.status !== "generating") return;
    const days = trip.itinerary ? safeParseArray(trip.itinerary) : [];
    // filter(Boolean): out-of-order day patches leave null holes — a hole
    // is not a delivered day.
    const realDays = days.filter(Boolean).length;
    const hasAnyContent =
      realDays > 0 || STREAMING_SECTIONS.some((s) => !!trip[s]);
    // max_tokens truncation ends a stream "successfully", so a short
    // itinerary would otherwise complete silently with no retry card —
    // surface under-delivery as a failed section in the SAME patch that
    // settles the status (deduped against entries already recorded).
    const failed = trip.failedSections ?? [];
    const underDelivered =
      realDays < trip.duration && !failed.includes("itinerary");
    await ctx.db.patch(tripId, {
      status: hasAnyContent ? "planned" : "failed",
      ...(underDelivered ? { failedSections: [...failed, "itinerary"] } : {}),
    });
    if (hasAnyContent) {
      // Trip-ready push for users who left the app mid-generation.
      // Best-effort — the action no-ops when no push token is registered.
      await ctx.scheduler.runAfter(0, internal.notifications.sendTripReady, {
        tripId,
      });

      // Visa apply-by reminder: scheduled for 09:00 UTC on the derived
      // deadline date. The action recomputes everything at fire time, so
      // deleted trips / moved dates make it a clean no-op.
      if (isActionableVisaCategory(trip.visaCategory, trip.countryCode)) {
        const staticEntry = visaData.find((c) => c.code === trip.countryCode);
        const info = deriveVisaDeadline({
          startDate: trip.startDate,
          processingTime: trip.visaProcessingTime,
          fallbackProcessingTime: staticEntry?.processingTime,
        });
        if (info) {
          const reminderAt = new Date(info.deadline);
          reminderAt.setUTCHours(9, 0, 0, 0);
          if (reminderAt.getTime() > Date.now()) {
            await ctx.scheduler.runAt(
              reminderAt.getTime(),
              internal.notifications.sendVisaDeadlineReminder,
              { tripId },
            );
          }
        }
      }
    }
  },
});

/**
 * Last-resort watchdog. Convex actions are capped at 10 minutes; a trip
 * still 'generating' 12 minutes after kickoff means the streaming action
 * died without settling (crash, redeploy, platform kill). Salvage whatever
 * landed: mark the empty sections failed so their retry cards surface,
 * then settle the status so the trip can't stay bricked in 'generating'.
 */
export const finalizeStuckGeneration = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.status !== "generating") return;
    const failed = new Set(trip.failedSections ?? []);
    for (const section of STREAMING_SECTIONS) {
      if (!trip[section]) failed.add(section);
    }
    const days = trip.itinerary ? safeParseArray(trip.itinerary) : [];
    // filter(Boolean): null holes from dropped days are not days.
    const realDays = days.filter(Boolean).length;
    if (realDays < trip.duration) failed.add("itinerary");
    const hasAnyContent =
      realDays > 0 || STREAMING_SECTIONS.some((s) => !!trip[s]);
    await ctx.db.patch(tripId, {
      failedSections: [...failed],
      retryingSections: [],
      status: hasAnyContent ? "planned" : "failed",
    });
    console.error(`Trip ${tripId} finalized by stuck-generation watchdog`);
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

    // Schedule the 60s zero-content watchdog and the 12-minute stuck-
    // generation finalizer (actions cap at 10 minutes, so by 12 this run
    // is provably dead if the trip is still 'generating').
    await ctx.scheduler.runAfter(60_000, internal.tripGeneration.checkGenerationTimeout, { tripId });
    await ctx.scheduler.runAfter(12 * 60_000, internal.tripGeneration.finalizeStuckGeneration, { tripId });

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
        // Every code path below MUST end in settle(), even when the
        // failure-marking mutation itself throws — an escaped rejection
        // here would hang the Promise.all and wedge the whole run in
        // 'generating' until the stuck-generation watchdog fires.
        const markFailed = async () => {
          try {
            await ctx.runMutation(internal.tripGeneration.patchTripSection, {
              tripId,
              section: sectionName,
              content: "",
              failed: true,
            });
          } catch (patchErr) {
            console.error(`Section ${sectionName} failure marker also failed:`, patchErr);
          }
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
                await markFailed();
              } finally {
                settle();
              }
            },
            async (err) => {
              console.error(`Section ${sectionName} stream errored:`, err);
              try {
                await markFailed();
              } finally {
                settle();
              }
            },
          ),
        );
      });
    };

    // Itinerary streams day-by-day with its own parser
    const runItinerary = (): Promise<void> =>
      streamItineraryIntoTrip(ctx, tripId, input, apiKey, systemPrompt);

    // ── Country tips — static-first, cache-second, LLM-fallback ─────
    //
    // The Tips tab on the trip detail screen renders CountryTipsView,
    // which reads from data/localInfo.ts (88 hand-written countries)
    // OR from the countryTipsCache Convex table (filled in lazily by
    // this very flow). Three branches:
    //   1. Country in localInfo → no LLM call needed, do nothing here.
    //   2. Country in countryTipsCache → no LLM call needed, do nothing.
    //   3. Neither → run the LLM with buildCountryTipsPrompt, parse the
    //      LocalInfo-shaped JSON, write to countryTipsCache for forever-
    //      reuse by every future trip / visitor to that country.
    const alpha3 = toAlpha3(input.countryCode);
    const isStaticallyCovered = alpha3 ? alpha3 in localInfo : false;
    let isCachedCovered = false;
    if (alpha3 && !isStaticallyCovered) {
      const cached = await ctx.runQuery(
        internal.tripGeneration._getCachedCountryTips,
        { countryCode: alpha3 },
      );
      isCachedCovered = cached !== null;
    }
    const needsCountryTipsLLM = !!alpha3 && !isStaticallyCovered && !isCachedCovered;

    const runCountryTips = async (): Promise<void> => {
      return new Promise((resolve) => {
        let settled = false;
        const settle = () => { if (settled) return; settled = true; resolve(); };
        streamAnthropic(
          {
            apiKey,
            systemPrompt,
            userPrompt: buildCountryTipsPrompt(input.countryCode, input.countryName),
            maxTokens: 2048,
          },
          makeWholeSectionBuffer(
            async (full) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parsed: any = JSON.parse(full);
                // Coerce the parsed shape into the validator's expectation.
                // We're forgiving on optional fields (omit if missing) and
                // strict on the required ones (skip the cache write if any
                // required field is missing or wrong-typed — better to leave
                // the row absent than poison the cache with a bad payload).
                const tap = parsed.tapWater;
                const tapOk = tap === "safe" || tap === "unsafe" || tap === "varies";
                const requiredOk =
                  typeof parsed.emergencyNumber === "string" &&
                  typeof parsed.policeNumber === "string" &&
                  typeof parsed.ambulanceNumber === "string" &&
                  typeof parsed.fireNumber === "string" &&
                  Array.isArray(parsed.essentialApps) &&
                  typeof parsed.tippingCulture === "string" &&
                  tapOk &&
                  typeof parsed.plugType === "string" &&
                  typeof parsed.simCard === "string";
                if (!requiredOk) {
                  console.error(`Country tips for ${alpha3} failed shape validation; skipping cache write`);
                  settle();
                  return;
                }
                await ctx.runMutation(internal.countryTips._writeCountryTips, {
                  countryCode: alpha3,
                  emergencyNumber: parsed.emergencyNumber,
                  policeNumber: parsed.policeNumber,
                  ambulanceNumber: parsed.ambulanceNumber,
                  fireNumber: parsed.fireNumber,
                  ukEmbassy: parsed.ukEmbassy && typeof parsed.ukEmbassy === "object"
                    ? {
                        city: String(parsed.ukEmbassy.city ?? ""),
                        phone: String(parsed.ukEmbassy.phone ?? ""),
                        address: String(parsed.ukEmbassy.address ?? ""),
                        website: String(parsed.ukEmbassy.website ?? ""),
                      }
                    : undefined,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  essentialApps: (parsed.essentialApps as any[])
                    .map((a) => ({
                      name: String(a?.name ?? ""),
                      purpose: String(a?.purpose ?? ""),
                    }))
                    .filter((a) => a.name && a.purpose),
                  tippingCulture: parsed.tippingCulture,
                  dressCode: typeof parsed.dressCode === "string" ? parsed.dressCode : undefined,
                  scamWarnings: Array.isArray(parsed.scamWarnings)
                    ? parsed.scamWarnings.map(String)
                    : undefined,
                  localCustoms: Array.isArray(parsed.localCustoms)
                    ? parsed.localCustoms.map(String)
                    : undefined,
                  tapWater: tap,
                  plugType: parsed.plugType,
                  simCard: parsed.simCard,
                  currencyTip: typeof parsed.currencyTip === "string" ? parsed.currencyTip : undefined,
                });
              } catch (err) {
                console.error("Country tips parse/write failed:", err);
              }
              settle();
            },
            (err) => {
              console.error("Country tips stream errored:", err);
              settle();
            },
          ),
        );
      });
    };

    // Budget returns two fields in one JSON; split into patches so
    // dailyBudget lands in its own schema field rather than getting
    // smuggled inside the budgetBreakdown JSON blob (which broke the
    // featured-trip card on the trips home).
    //
    // Throwing on a parse failure is deliberate: runSection's catch marks
    // the bundle failed, which surfaces the retry card. The previous
    // swallow-and-write-empty left a silently blank Budget section with
    // no retry affordance whenever the model wrapped its JSON in fences.
    const budgetTransform = (raw: string): Array<{ section: string; content: string }> => {
      const parsed = JSON.parse(stripCodeFences(raw));
      return [
        { section: "dailyBudget", content: coerceToString(parsed.dailyBudget, "") },
        { section: "budgetBreakdown", content: coerceToString(parsed.budgetBreakdown, "[]") },
      ];
    };

    // Visa returns three fields in one JSON; split into patches.
    // visaCategory is passport-aware (the prompt receives the traveler's
    // passports), so the client prefers it over the static table's
    // not-passport-aware category. Only patched when it's a known value —
    // an off-vocabulary string would break the category-driven UI.
    // Throws on parse failure for the same reason as budgetTransform.
    const visaTransform = (raw: string): Array<{ section: string; content: string }> => {
      const parsed = JSON.parse(stripCodeFences(raw));
      const patches = [
        { section: "visaNotes", content: coerceToString(parsed.visaNotes, "") },
        { section: "visaChecklist", content: coerceToString(parsed.visaChecklist, "[]") },
      ];
      if (
        typeof parsed.visaCategory === "string" &&
        STREAMED_VISA_CATEGORIES.has(parsed.visaCategory)
      ) {
        patches.push({ section: "visaCategory", content: parsed.visaCategory });
      }
      return patches;
    };

    try {
      const promises: Array<Promise<void>> = [
        // Dining is sequential-after-itinerary by design — it anchors its
        // restaurant picks to the streamed day areas, so it needs the final
        // days as prompt context. But it runs as its OWN scheduled action
        // (via _beginDiningRun → runRetrySection), not chained inside this
        // action: a long itinerary plus dining would overrun the 10-minute
        // action budget. The Food tab shows the reactive 'retrying' state
        // via the retryingSections marker while it runs, and the trip can
        // flip 'planned' before dining lands — by design (the trip is
        // usable immediately; dining trickles in). The .catch ensures a
        // kickoff failure can never reject the Promise.all.
        runItinerary()
          .then(async () => {
            await ctx.runMutation(internal.tripGeneration._beginDiningRun, { tripId });
          })
          .catch((err) => {
            console.error("Dining kickoff failed:", err);
          }),
        runSection("__visa-bundle__", buildVisaUserPrompt(input), 1024, visaTransform),
        runSection("__budget-bundle__", buildBudgetUserPrompt(input), 1024, budgetTransform),
        runSection("highlights", buildHighlightsUserPrompt(input), 512),
      ];
      // Only burn tokens on country tips when neither the static table
      // nor the Convex cache has them. Once this fires for any uncovered
      // country, the result is cached forever — every future trip to
      // that country reads from the cache instead.
      if (needsCountryTipsLLM) {
        promises.push(runCountryTips());
      }
      await Promise.all(promises);
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
 * Kick off the dining-guide generation as its OWN scheduled action run.
 * Dining used to be chained after the itinerary inside runGenerationStream,
 * which spent the main action's 10-minute budget twice over on long trips.
 * Scheduling runRetrySection gives dining a fresh action budget; the Food
 * tab shows the reactive 'retrying' state via the retryingSections marker
 * while it runs; the trip can flip 'planned' before dining lands — by
 * design (the trip is usable immediately, dining trickles in).
 */
export const _beginDiningRun = internalMutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.deletedAt !== undefined) return; // deleted mid-generation
    const retrying = trip.retryingSections ?? [];
    if (retrying.includes("diningGuide")) return; // a run is already in flight
    await ctx.db.patch(tripId, {
      retryingSections: [...retrying, "diningGuide"],
    });
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runRetrySection, {
      tripId,
      section: "diningGuide",
    });
    // Watchdog mirrors finalizeStuckGeneration: actions are at-most-once,
    // so a crash/redeploy/10-min-kill mid-run would strand the marker.
    // _clearRetryingSection is an idempotent filter — a normal completion
    // makes this a no-op.
    await ctx.scheduler.runAfter(12 * 60_000, internal.tripGeneration._clearRetryingSection, {
      tripId,
      section: "diningGuide",
    });
  },
});

/** Sections the retry flow knows how to re-run. packingSuggestions /
 * accommodationTips / localEssentials are no longer generated by the
 * streaming flow — country-level tips come from data/localInfo.ts or the
 * countryTipsCache table now. */
const RETRYABLE_SECTIONS = new Set([
  "highlights",
  "visaChecklist",
  "visaNotes",
  "budgetBreakdown",
  "dailyBudget",
  "itinerary",
  "diningGuide",
]);

/**
 * Retry a single section after a failure. Validates and marks the section
 * as retrying, then schedules `runRetrySection` to re-run that one slice's
 * stream — the same mutation-schedules-action shape as `generateTrip`, so
 * a websocket blip mid-retry can't kill it. Progress is reactive: the
 * section leaves `retryingSections` when the run settles, and leaves
 * `failedSections` only on success.
 */
export const retrySection = mutation({
  args: {
    tripId: v.id("trips"),
    section: v.string(),
  },
  handler: async (ctx, { tripId, section }) => {
    // Dining regeneration is deliberately editor-level, matching tweakDay
    // and generateDiningGuide; everything else stays owner-only.
    await checkTripPermission(
      ctx,
      tripId,
      section === "diningGuide" ? "editor" : "owner",
    );

    const trip = await ctx.db.get(tripId);
    if (!trip) throw new Error("Trip not found");
    if (!trip.originalInputs) throw new Error("No original inputs stored — cannot retry");
    if (!RETRYABLE_SECTIONS.has(section)) {
      // Stale failedSections entry from an older generation pipeline.
      throw new Error(`Cannot retry unknown section: ${section}`);
    }

    const retrying = trip.retryingSections ?? [];
    if (retrying.includes(section)) return; // already in flight
    await ctx.db.patch(tripId, { retryingSections: [...retrying, section] });
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runRetrySection, {
      tripId,
      section,
    });
    // Watchdog mirrors finalizeStuckGeneration: actions are at-most-once, so
    // a crash mid-run would strand the marker. _clearRetryingSection is an
    // idempotent filter — a normal completion makes this a no-op.
    await ctx.scheduler.runAfter(12 * 60_000, internal.tripGeneration._clearRetryingSection, {
      tripId,
      section,
    });
  },
});

/**
 * Generate (or regenerate) the dining guide for an existing trip — the
 * back-fill path for trips created before dining existed, surfaced as the
 * "Curate my food guide" CTA on the Food tab. New trips get their guide
 * automatically at the end of the main generation run.
 *
 * Editor permission (not owner): collaborators who can tweak days can
 * curate dining too. Mutation→scheduler→action shape per project rule;
 * progress is reactive via retryingSections('diningGuide').
 */
export const generateDiningGuide = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    await checkTripPermission(ctx, tripId, "editor");
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.deletedAt !== undefined) throw new Error("Trip not found");
    if (trip.status === "generating") return; // the main run will produce it
    if (!trip.originalInputs) throw new Error("No original inputs stored");
    const days = trip.itinerary ? safeParseArray(trip.itinerary) : [];
    if (days.filter(Boolean).length === 0) {
      throw new Error("Itinerary not ready yet");
    }
    const retrying = trip.retryingSections ?? [];
    if (retrying.includes("diningGuide")) return; // already in flight
    await ctx.db.patch(tripId, {
      retryingSections: [...retrying, "diningGuide"],
    });
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runRetrySection, {
      tripId,
      section: "diningGuide",
    });
    // Watchdog mirrors finalizeStuckGeneration: actions are at-most-once, so
    // a crash mid-run would strand the marker. _clearRetryingSection is an
    // idempotent filter — a normal completion makes this a no-op.
    await ctx.scheduler.runAfter(12 * 60_000, internal.tripGeneration._clearRetryingSection, {
      tripId,
      section: "diningGuide",
    });
  },
});

// ── Day quick-tweaks ─────────────────────────────────────────────
// One-tap single-day rewrites from the day-detail screen ("More relaxed",
// "Rainy-day version", "Swap the evening"). Same mutation-schedules-action
// shape as retrySection; progress is reactive via retryingSections with
// the key 'itinerary-day:N'.

const DAY_TWEAK_PROMPTS: Record<string, string> = {
  relaxed:
    "Rewrite this single day to be noticeably more relaxed: fewer stops, a later start, more lingering time at each place. Keep the day's best anchor activity.",
  rainy:
    "Rewrite this single day as a rainy-day version: indoor alternatives (museums, markets, food halls, cafés, galleries) that keep the day's spirit and neighborhood where possible.",
  "swap-evening":
    "Keep the morning and afternoon EXACTLY as they are (same text). Replace ONLY the evening with a different, equally specific plan — a different venue, ideally a different neighborhood. If the day has a \"stops\" array, the morning- and afternoon-slot stops must stay identical (same entries, same order) and only the evening-slot stops change.",
};

export const tweakDay = mutation({
  args: {
    tripId: v.id("trips"),
    dayIndex: v.number(),
    instruction: v.union(
      v.literal("relaxed"),
      v.literal("rainy"),
      v.literal("swap-evening"),
    ),
  },
  handler: async (ctx, { tripId, dayIndex, instruction }) => {
    await checkTripPermission(ctx, tripId, "editor");
    const trip = await ctx.db.get(tripId);
    if (!trip || trip.deletedAt !== undefined) throw new Error("Trip not found");
    if (!trip.originalInputs) throw new Error("No original inputs stored");
    const days = trip.itinerary ? safeParseArray(trip.itinerary) : [];
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= days.length) {
      throw new Error("Invalid day");
    }
    const key = `itinerary-day:${dayIndex}`;
    const retrying = trip.retryingSections ?? [];
    if (retrying.includes(key)) return; // already in flight
    await ctx.db.patch(tripId, { retryingSections: [...retrying, key] });
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runDayTweak, {
      tripId,
      dayIndex,
      instruction,
    });
    // Watchdog mirrors finalizeStuckGeneration: actions are at-most-once, so
    // a crash mid-run would strand the marker. _clearRetryingSection is an
    // idempotent filter — a normal completion makes this a no-op.
    await ctx.scheduler.runAfter(12 * 60_000, internal.tripGeneration._clearRetryingSection, {
      tripId,
      section: key,
    });
  },
});

export const runDayTweak = internalAction({
  args: {
    tripId: v.id("trips"),
    dayIndex: v.number(),
    instruction: v.string(),
  },
  handler: async (ctx, { tripId, dayIndex, instruction }) => {
    try {
      const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
      if (!trip?.originalInputs || !trip.itinerary) return;
      const days = safeParseArray(trip.itinerary);
      const day = days[dayIndex];
      if (!day) return;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

      const input = JSON.parse(trip.originalInputs);
      const systemPrompt = buildSystemPrompt(input);
      const guidance = DAY_TWEAK_PROMPTS[instruction];
      if (!guidance) return;
      const userPrompt = `Here is Day ${dayIndex + 1} of the traveler's itinerary as JSON:
${JSON.stringify(day)}

${guidance}

Keep the exact same JSON shape (same keys), keep "day": ${dayIndex + 1}, recommend real places by name. When the day object contains a "stops" array, rewrite it to match the new plan — 4-7 stops across morning/afternoon/evening with the same per-stop keys (slot, time, name, note, kind, duration) — keeping the prose and the stops telling the same story. Output ONLY the JSON object — no fences, no commentary.`;

      await new Promise<void>((resolve) => {
        streamAnthropic(
          { apiKey, systemPrompt, userPrompt, maxTokens: 2048 },
          makeWholeSectionBuffer(
            async (full) => {
              try {
                // Tolerate prose around the JSON; null means truncated or
                // no object at all — keep the old day rather than corrupt it.
                const cleaned = extractFirstJsonObject(full);
                if (!cleaned) {
                  console.error(
                    `Day tweak ${dayIndex}: no parseable JSON in output:`,
                    full.slice(0, 200),
                  );
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parsed: any = JSON.parse(cleaned); // a bad payload keeps the old day
                // The 'same keys' / 'swap-evening keeps morning+afternoon'
                // contracts were prompt-only — enforce them server-side so
                // a tweak can never silently destroy a day's stops.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const originalStops: any[] = Array.isArray(day?.stops)
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (day.stops as any[]).filter(isUsableStop)
                  : [];
                let contentToPatch = cleaned;
                if (originalStops.length > 0) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const parsedStops: any[] = Array.isArray(parsed?.stops)
                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (parsed.stops as any[]).filter(isUsableStop)
                    : [];
                  if (instruction === "swap-evening") {
                    // Force-preserve the contract: morning/afternoon stops
                    // are the ORIGINAL ones verbatim; only evening changes.
                    const newEvening = parsedStops.filter((s) => s.slot === "evening");
                    const hadEvening = originalStops.some((s) => s.slot === "evening");
                    if (hadEvening && newEvening.length === 0) {
                      console.error(
                        `Day tweak ${dayIndex}: swap-evening returned no usable evening stops; keeping the old day`,
                      );
                      return;
                    }
                    contentToPatch = JSON.stringify({
                      ...parsed,
                      stops: [
                        ...originalStops.filter((s) => s.slot === "morning"),
                        ...originalStops.filter((s) => s.slot === "afternoon"),
                        ...newEvening,
                      ],
                    });
                  } else {
                    // relaxed / rainy (and any future instruction): a rewrite
                    // that loses every stop is a destroyed day, not a tweak.
                    if (parsedStops.length === 0) {
                      console.error(
                        `Day tweak ${dayIndex}: rewrite returned no usable stops; keeping the old day`,
                      );
                      return;
                    }
                    contentToPatch = JSON.stringify({ ...parsed, stops: parsedStops });
                  }
                }
                // Original day had no usable stops → legacy day, stops
                // optional — accept the parsed day as-is.
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId,
                  section: `itinerary-day:${dayIndex}`,
                  content: contentToPatch,
                });
              } catch (err) {
                console.error(`Day tweak ${dayIndex} patch failed:`, err);
              } finally {
                resolve();
              }
            },
            (err) => {
              console.error(`Day tweak ${dayIndex} stream errored:`, err);
              resolve();
            },
          ),
        );
      });
    } finally {
      await ctx.runMutation(internal.tripGeneration._clearRetryingSection, {
        tripId,
        section: `itinerary-day:${dayIndex}`,
      });
    }
  },
});

/** Scheduled worker for `retrySection`. Re-runs one section's stream and
 * always clears the section from `retryingSections` when it settles. */
export const runRetrySection = internalAction({
  args: {
    tripId: v.id("trips"),
    section: v.string(),
  },
  handler: async (ctx, { tripId, section }) => {
    try {
      await runRetrySectionInner(ctx, tripId, section);
    } finally {
      await ctx.runMutation(internal.tripGeneration._clearRetryingSection, {
        tripId,
        section,
      });
    }
  },
});

async function runRetrySectionInner(
  ctx: ActionCtx,
  tripId: Id<"trips">,
  section: string,
) {
  {
    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip) throw new Error("Trip not found");
    if (!trip.originalInputs) throw new Error("No original inputs stored — cannot retry");

    // originalInputs is written from validated args, but a corrupted/legacy
    // doc would otherwise surface a raw SyntaxError to the client.
    let input: Parameters<typeof buildSystemPrompt>[0];
    try {
      input = JSON.parse(trip.originalInputs);
    } catch {
      throw new Error("Stored trip inputs are corrupted — cannot retry");
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const systemPrompt = buildSystemPrompt(input);

    if (section === "itinerary") {
      // Clear any partial itinerary so re-streamed days land in a clean
      // array — stale days from the failed run could otherwise linger
      // past the new day count.
      await ctx.runMutation(internal.tripGeneration._patchTripField, {
        tripId,
        field: "itinerary",
        value: "",
      });
      await streamItineraryIntoTrip(ctx, tripId, input, apiKey, systemPrompt);
      // Only clear the failure marker if the re-run actually produced days.
      const after = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
      const days = after?.itinerary ? safeParseArray(after.itinerary) : [];
      if (days.length > 0) {
        await ctx.runMutation(internal.tripGeneration._clearFailedSection, {
          tripId,
          section: "itinerary",
        });
      }
      return;
    }

    if (section === "diningGuide") {
      // Also the backfill path for trips created before dining existed —
      // generateDiningGuide schedules this even when the section was never
      // marked failed, and _clearFailedSection no-ops harmlessly then.
      await streamDiningIntoTrip(ctx, tripId, input, apiKey, systemPrompt);
      // Only clear the failure marker if the run actually produced a guide.
      const after = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
      if (after?.diningGuide) {
        await ctx.runMutation(internal.tripGeneration._clearFailedSection, {
          tripId,
          section: "diningGuide",
        });
      }
      return;
    }

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
      case "dailyBudget":
        userPrompt = buildBudgetUserPrompt(input);
        break;
      default:
        // Validated in the retrySection mutation; kept for defense in depth.
        throw new Error(`Cannot retry unknown section: ${section}`);
    }

    await new Promise<void>((resolve) => {
      streamAnthropic(
        { apiKey, systemPrompt, userPrompt, maxTokens },
        makeWholeSectionBuffer(
          async (full) => {
            if (section === "highlights") {
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId, section, content: full.trim(),
              });
            } else if (section === "budgetBreakdown" || section === "dailyBudget") {
              try {
                const parsed = JSON.parse(full);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "dailyBudget", content: coerceToString(parsed.dailyBudget, ""),
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "budgetBreakdown", content: coerceToString(parsed.budgetBreakdown, "[]"),
                });
              } catch {
                // swallow
              }
            } else if (section === "visaChecklist" || section === "visaNotes") {
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
  }
}

/**
 * Backfill structured `stops` arrays onto legacy itinerary days created
 * before the structured-stops release. The model structures (not
 * reinvents) what each day's prose already describes; results merge into
 * the stored itinerary via _mergeBackfilledStops — a single mutation
 * transaction, so a concurrent itinerary write (EditDaySheet save,
 * tweakDay patch) can't be clobbered by a stale whole-array overwrite.
 * Never throws — every failure logs and leaves the itinerary untouched.
 *
 * Invoked manually via CLI for now:
 *   npx convex run tripGeneration:backfillDayStops '{"tripId":"..."}'
 */
export const backfillDayStops = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    try {
      const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
      if (!trip?.originalInputs || !trip.itinerary) return;
      const days = safeParseArray(trip.itinerary);
      const missing = days
        .map((day, idx) => ({ day, idx }))
        .filter(({ day }) => day && !hasUsableStops(day));
      if (missing.length === 0) return;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error("backfillDayStops: ANTHROPIC_API_KEY not set");
        return;
      }
      let input: Parameters<typeof buildSystemPrompt>[0];
      try {
        input = JSON.parse(trip.originalInputs);
      } catch {
        console.error(`backfillDayStops: corrupted originalInputs on ${tripId}`);
        return;
      }
      const systemPrompt = buildSystemPrompt(input);

      const dayNumberFor = ({ day, idx }: { day: (typeof days)[number]; idx: number }): number =>
        Number.isInteger(day.day) ? day.day : idx + 1;
      const missingDayNumbers = new Set(missing.map(dayNumberFor));

      const dayBlocks = missing
        .map((entry) => {
          const { day } = entry;
          const n = dayNumberFor(entry);
          return `Day ${n} — ${day.title ?? ""}
morning: ${day.morning ?? ""}${day.morningPlace ? ` (place: ${day.morningPlace})` : ""}
afternoon: ${day.afternoon ?? ""}${day.afternoonPlace ? ` (place: ${day.afternoonPlace})` : ""}
evening: ${day.evening ?? ""}${day.eveningPlace ? ` (place: ${day.eveningPlace})` : ""}`;
        })
        .join("\n\n");

      // Same stop schema as buildItineraryUserPrompt — the backfilled days
      // must be indistinguishable from natively-generated ones.
      const userPrompt = `Here are the days of an existing itinerary that lack structured stops. Each day's prose already describes the plan:

${dayBlocks}

Output a JSON object with this exact shape:

{
  "days": [
    {
      "day": N,
      "stops": [
        {
          "slot": "morning" | "afternoon" | "evening",
          "time": "09:00",
          "name": "Real place name — exact enough to find in Apple Maps",
          "note": "ONE editorial sentence: what you do there and why it earns its slot.",
          "kind": "landmark" | "museum" | "gallery" | "market" | "nature" | "walk" | "neighborhood" | "experience" | "cafe" | "viewpoint" | "beach" | "shopping",
          "duration": "1½ hrs"
        }
      ]
    }
  ]
}

Rules:
- Cover EXACTLY the days listed above — no more, no fewer.
- 4-7 stops per day, spread across the three slots (each slot gets at least one). Times are plausible 24h local starts in chronological order.
- Every stop is a real, currently-operating place CONSISTENT WITH THE EXISTING PROSE — extract and structure what the prose already describes; only invent a stop when a slot's prose names no place.

Output ONLY the JSON object. No preamble, no markdown fences.`;

      const maxTokens = Math.min(16_384, 1_024 + missing.length * 550);

      await new Promise<void>((resolve) => {
        streamAnthropic(
          { apiKey, systemPrompt, userPrompt, maxTokens },
          makeWholeSectionBuffer(
            async (full) => {
              try {
                const cleaned = extractFirstJsonObject(full);
                if (!cleaned) {
                  console.error(
                    "backfillDayStops: no parseable JSON in output:",
                    full.slice(0, 200),
                  );
                  return;
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const parsed: any = JSON.parse(cleaned);
                if (!Array.isArray(parsed?.days)) {
                  console.error("backfillDayStops: output missing days array");
                  return;
                }
                // Validate LLM output into the mutation payload here; the
                // read-merge-write happens inside _mergeBackfilledStops as
                // ONE transaction, so a concurrent itinerary write can't be
                // reverted by a stale overwrite from this action.
                const payload: Array<{
                  day: number;
                  stops: Array<{
                    slot: string;
                    name: string;
                    note: string;
                    kind?: string;
                    time?: string;
                    duration?: string;
                  }>;
                }> = [];
                for (const entry of parsed.days) {
                  const n = entry?.day;
                  if (!Number.isInteger(n) || !missingDayNumbers.has(n)) {
                    console.error(`backfillDayStops: skipping unrequested/invalid day:`, n);
                    continue;
                  }
                  const stops = Array.isArray(entry.stops)
                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (entry.stops as any[]).filter(isUsableStop)
                    : [];
                  if (stops.length === 0) {
                    console.error(`backfillDayStops: day ${n} returned no usable stops; skipping`);
                    continue;
                  }
                  payload.push({
                    day: n,
                    // Map to exactly the keys the args validator allows —
                    // stray LLM fields would fail v.object validation.
                    stops: stops.map((s) => ({
                      slot: String(s.slot),
                      name: String(s.name),
                      note: String(s.note),
                      ...(typeof s.kind === "string" ? { kind: s.kind } : {}),
                      ...(typeof s.time === "string" ? { time: s.time } : {}),
                      ...(typeof s.duration === "string" ? { duration: s.duration } : {}),
                    })),
                  });
                }
                if (payload.length > 0) {
                  await ctx.runMutation(internal.tripGeneration._mergeBackfilledStops, {
                    tripId,
                    days: payload,
                  });
                }
              } catch (err) {
                console.error("backfillDayStops merge failed:", err);
              } finally {
                resolve();
              }
            },
            (err) => {
              console.error("backfillDayStops stream errored:", err);
              resolve();
            },
          ),
        );
      });
    } catch (err) {
      console.error("backfillDayStops failed:", err);
    }
  },
});

/**
 * Merge backfilled stops into the stored itinerary in ONE transaction.
 * backfillDayStops used to re-read via a query and write via a generic
 * field patch from the action — any itinerary write committing between the
 * two (EditDaySheet whole-array save, tweakDay patch) was silently reverted
 * by the stale whole-array overwrite. Doing the read-merge-write inside a
 * single mutation makes the merge transactional: per-day, a target that has
 * grown usable stops since the action read it (a concurrent tweak is
 * fresher) or no longer exists is skipped.
 */
export const _mergeBackfilledStops = internalMutation({
  args: {
    tripId: v.id("trips"),
    days: v.array(
      v.object({
        day: v.number(),
        stops: v.array(
          v.object({
            slot: v.string(),
            name: v.string(),
            note: v.string(),
            kind: v.optional(v.string()),
            time: v.optional(v.string()),
            duration: v.optional(v.string()),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, { tripId, days }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip?.itinerary) return;
    const stored = safeParseArray(trip.itinerary);
    let merged = 0;
    for (const entry of days) {
      const n = entry.day;
      // Match by day.day; fall back to the 1-indexed position.
      let targetIdx = stored.findIndex((d) => d && d.day === n);
      if (targetIdx === -1 && stored[n - 1]) targetIdx = n - 1;
      if (targetIdx === -1) {
        console.error(`_mergeBackfilledStops: day ${n} not found in itinerary; skipping`);
        continue;
      }
      if (hasUsableStops(stored[targetIdx])) {
        // A concurrent tweak already structured this day — its stops are
        // fresher than ours.
        continue;
      }
      const stops = entry.stops.filter(isUsableStop);
      if (stops.length === 0) continue;
      stored[targetIdx] = { ...stored[targetIdx], stops };
      merged++;
    }
    if (merged > 0) {
      await ctx.db.patch(tripId, { itinerary: JSON.stringify(stored) });
    }
  },
});

/** Internal query for retrySection to read the trip — keeps the action stateless. */
export const _getTripForRetry = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => ctx.db.get(tripId),
});

/** Internal lookup so runGenerationStream can decide whether to fire
 *  the country-tips LLM call without round-tripping through the public
 *  countryTips.getCountryTips query. Returns the cached row or null. */
export const _getCachedCountryTips = internalQuery({
  args: { countryCode: v.string() },
  handler: async (ctx, { countryCode }) => {
    const row = await ctx.db
      .query("countryTipsCache")
      .withIndex("by_country", (q) => q.eq("countryCode", countryCode))
      .first();
    return row ?? null;
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
      budgetBreakdown: ["budgetBreakdown", "dailyBudget"],
      dailyBudget: ["budgetBreakdown", "dailyBudget"],
    };
    const toRemove = bundleSiblings[section] ?? [section];
    const next = failed.filter((s) => !toRemove.includes(s));
    await ctx.db.patch(tripId, { failedSections: next });
  },
});

/** Remove a section from retryingSections once its retry run settles. */
export const _clearRetryingSection = internalMutation({
  args: { tripId: v.id("trips"), section: v.string() },
  handler: async (ctx, { tripId, section }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    const next = (trip.retryingSections ?? []).filter((s) => s !== section);
    await ctx.db.patch(tripId, { retryingSections: next });
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

/** Generic internal patch helper for fields not in SECTION_FIELD_MAP.
 *  The field name is allow-listed (literal union, not v.string()) so neither
 *  the runtime nor a future caller can patch arbitrary trip fields — mirrors
 *  the allow-list in the public `trips.updateTripField`. */
export const _patchTripField = internalMutation({
  args: {
    tripId: v.id("trips"),
    field: v.union(
      v.literal("dayImages"),
      v.literal("activityImages"),
      v.literal("itinerary"),
    ),
    value: v.string(),
  },
  handler: async (ctx, { tripId, field, value }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    const patch: Partial<{
      dayImages: string;
      activityImages: string;
      itinerary: string;
    }> = {};
    patch[field] = value;
    await ctx.db.patch(tripId, patch);
  },
});

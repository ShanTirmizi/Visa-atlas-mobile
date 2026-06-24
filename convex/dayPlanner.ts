// convex/dayPlanner.ts
//
// The "Plan my day" engine. Input-driven, web-grounded, map-centric — NOT the
// trip generator replugged. Flow (canonical mutation → scheduler → internal
// action → reactive query; never client useAction):
//
//   generateDayPlan (mutation)  → insert a `generating` dayPlans row, schedule
//   runDayPlan (internalAction) → (1) web-grounded LLM picks real recommended
//                                 stops with sources, (2) GEOCODE every stop
//                                 (Photon) so nothing hallucinated reaches the
//                                 map, (3) ROUTE the day (OSRM driving) for the
//                                 road line + leg times, (4) write the DayPlan.
//   getDayPlan / listDayPlans   → reactive reads the client subscribes to.

import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";
import { geocode, routeDriving, haversineKm, estimateLegMinutes } from "./lib/geo";
import { generateGroundedPlan, type DayPlanInput } from "./lib/dayPlanLLM";
import type { DayPlan, DayPlanStop, DayPlanLeg } from "../types/dayPlan";

const transportValidator = v.union(
  v.literal("car"),
  v.literal("transit"),
  v.literal("walk"),
  v.literal("cycle"),
);

// ── Public mutation ──────────────────────────────────────────────

export const generateDayPlan = mutation({
  args: {
    startLat: v.number(),
    startLng: v.number(),
    startLabel: v.string(),
    transport: transportValidator,
    reachMinutes: v.number(),
    interests: v.array(v.string()),
    notes: v.optional(v.string()),
    startTime: v.optional(v.string()),
  },
  returns: v.id("dayPlans"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // Each plan is a fresh web-grounded generation — meter it like generateTrip.
    await checkRateLimit(ctx, userId, "dayPlan", 8, HOUR_MS);

    const reach = Math.min(240, Math.max(10, Math.round(args.reachMinutes)));
    const notes = args.notes?.trim();

    const planId = await ctx.db.insert("dayPlans", {
      userId,
      status: "generating",
      startLat: args.startLat,
      startLng: args.startLng,
      startLabel: args.startLabel,
      transport: args.transport,
      reachMinutes: reach,
      interests: args.interests.slice(0, 8),
      notes: notes && notes.length > 0 ? notes.slice(0, 500) : undefined,
      startTime: args.startTime,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.dayPlanner.runDayPlan, { planId });
    return planId;
  },
});

// ── Reactive reads ───────────────────────────────────────────────

export const getDayPlan = query({
  args: { planId: v.id("dayPlans") },
  handler: async (ctx, { planId }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(planId);
    if (!row || row.userId !== userId) return null;
    return row;
  },
});

export const listDayPlans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("dayPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return rows.map((r) => ({
      _id: r._id,
      status: r.status,
      title: r.title,
      destArea: r.destArea,
      transport: r.transport,
      startLabel: r.startLabel,
      createdAt: r.createdAt,
    }));
  },
});

// ── Internal plumbing ────────────────────────────────────────────

export const _getPlan = internalQuery({
  args: { planId: v.id("dayPlans") },
  handler: async (ctx, { planId }) => ctx.db.get(planId),
});

export const _writePlan = internalMutation({
  args: {
    planId: v.id("dayPlans"),
    title: v.string(),
    summary: v.string(),
    destArea: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, { planId, title, summary, destArea, plan }) => {
    await ctx.db.patch(planId, {
      status: "ready",
      title,
      summary,
      destArea,
      plan,
    });
  },
});

export const _failPlan = internalMutation({
  args: { planId: v.id("dayPlans"), errorMessage: v.string() },
  handler: async (ctx, { planId, errorMessage }) => {
    await ctx.db.patch(planId, { status: "failed", errorMessage });
  },
});

// ── The action: web-grounded → geocoded → routed ─────────────────

export const runDayPlan = internalAction({
  args: { planId: v.id("dayPlans") },
  handler: async (ctx, { planId }) => {
    const fail = async (msg: string) => {
      await ctx.runMutation(internal.dayPlanner._failPlan, { planId, errorMessage: msg });
    };
    try {
      const row = await ctx.runQuery(internal.dayPlanner._getPlan, { planId });
      if (!row) return;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return fail("ANTHROPIC_API_KEY not set");

      const input: DayPlanInput = {
        start: { lat: row.startLat, lng: row.startLng, label: row.startLabel },
        transport: row.transport,
        reachMinutes: row.reachMinutes,
        interests: row.interests,
        notes: row.notes,
        startTime: row.startTime,
      };

      // 1) Web-grounded picks. distinctId = the plan owner (off the doc),
      // traceId = planId so the day-plan generation groups in LLM analytics.
      const raw = await generateGroundedPlan(apiKey, input, {
        distinctId: row.userId,
        traceId: planId,
        purpose: "day_plan",
        planId,
      });

      // 2) Geocode every stop — authoritative coords, drop what can't resolve.
      const areaCenter = raw.destArea
        ? await geocode(raw.destArea, { lat: row.startLat, lng: row.startLng })
        : null;

      const stops: DayPlanStop[] = [];
      for (const s of raw.stops ?? []) {
        if (!s?.name) continue;
        const approx =
          typeof s.approxLat === "number" && typeof s.approxLng === "number"
            ? { lat: s.approxLat, lng: s.approxLng }
            : null;
        const bias = approx ?? areaCenter ?? { lat: row.startLat, lng: row.startLng };
        // Town-level query is the reliable disambiguator (a hyper-specific
        // `area` can mislead OSM); bias nudges toward the right town.
        const g = await geocode(`${s.name}, ${raw.destArea ?? s.area ?? ""}`, bias);
        // Trust the geocode when it agrees with the LLM's estimate; otherwise
        // OSM likely mis-matched (e.g. returned a different café) — prefer the
        // LLM's coords for a real, web-sourced place. Drop only if neither.
        let lat: number | undefined;
        let lng: number | undefined;
        if (g && (!approx || haversineKm([g.lng, g.lat], [approx.lng, approx.lat]) < 3)) {
          lat = g.lat;
          lng = g.lng;
        } else if (approx) {
          lat = approx.lat;
          lng = approx.lng;
        } else if (g) {
          lat = g.lat;
          lng = g.lng;
        }
        if (lat === undefined || lng === undefined) continue;
        stops.push({
          name: s.name,
          lat,
          lng,
          kind: typeof s.kind === "string" ? s.kind : undefined,
          time: typeof s.time === "string" ? s.time : "",
          durationMin:
            typeof s.durationMin === "number" ? Math.max(15, Math.round(s.durationMin)) : 60,
          why: typeof s.why === "string" ? s.why : "",
          source:
            s.source?.url && /^https?:\/\//i.test(s.source.url)
              ? { label: s.source.label || "Source", url: s.source.url }
              : undefined,
          area: s.area,
          bookingNote: typeof s.bookingNote === "string" ? s.bookingNote : undefined,
        });
      }

      if (stops.length < 2) return fail("Couldn't resolve enough real places for a day");

      // 3) Route the day: start → stops → home.
      const start: [number, number] = [row.startLng, row.startLat];
      const nodes: [number, number][] = [start, ...stops.map((s) => [s.lng, s.lat] as [number, number]), start];

      let legs: DayPlanLeg[] = [];
      let routeGeometry: [number, number][] | undefined;
      let totalTravelMin = 0;
      let totalDistanceKm = 0;

      const routed = row.transport === "car" ? await routeDriving(nodes) : null;
      if (routed && routed.legs.length === nodes.length - 1) {
        legs = routed.legs.map((l) => ({ durationMin: l.durationMin, distanceKm: l.distanceKm }));
        routeGeometry = routed.geometry;
        totalTravelMin = routed.totalDurationMin;
        totalDistanceKm = routed.totalDistanceKm;
      } else {
        // Non-car or routing failed: straight-line connectors + mode estimates.
        for (let i = 0; i < nodes.length - 1; i++) {
          const km = Math.round(haversineKm(nodes[i], nodes[i + 1]) * 10) / 10;
          const min = estimateLegMinutes(km, row.transport);
          legs.push({ durationMin: min, distanceKm: km, estimated: true });
          totalTravelMin += min;
          totalDistanceKm += km;
        }
        routeGeometry = nodes;
        totalDistanceKm = Math.round(totalDistanceKm * 10) / 10;
      }

      const dayPlan: DayPlan = {
        start: input.start,
        transport: row.transport,
        reachMinutes: row.reachMinutes,
        title: raw.title || `A day in ${raw.destArea ?? "your area"}`,
        summary: raw.summary || "",
        destArea: raw.destArea,
        stops,
        legs,
        routeGeometry,
        totalDistanceKm,
        totalTravelMin,
      };

      await ctx.runMutation(internal.dayPlanner._writePlan, {
        planId,
        title: dayPlan.title,
        summary: dayPlan.summary,
        destArea: dayPlan.destArea ?? "",
        plan: JSON.stringify(dayPlan),
      });
    } catch (err) {
      console.error("runDayPlan failed:", err);
      await fail(err instanceof Error ? err.message : String(err));
    }
  },
});

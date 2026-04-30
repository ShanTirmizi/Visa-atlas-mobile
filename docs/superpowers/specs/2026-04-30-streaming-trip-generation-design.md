# Streaming Trip Generation — Design Spec

**Date:** 2026-04-30
**Status:** Draft, awaiting review
**Scope:** Eliminate the 25–75 second blocking loading screen during trip creation by streaming generated content into the trip detail screen as it arrives, fanning out the single mega-prompt into parallel section calls, and short-circuiting static facts to a free local lookup.
**Branch:** `feat/stream-trip-generation`

## Problem

Today, creating a trip is the slowest interaction in the app and feels broken on the first try.

The user taps **Generate itinerary** in the planner sheet at [components/trip/TripPlannerSheet.tsx:838-887](components/trip/TripPlannerSheet.tsx:838) and is then trapped on a sparkle-orb loading screen ([TripPlannerSheet.tsx:1110-1180](components/trip/TripPlannerSheet.tsx:1110)) for 25–75 seconds. Three things happen in strict serial:

1. `POST /api/generate-trip` — one mega-prompt that generates the full itinerary, budget, visa, highlights, packing, tips, and ~12 static facts in a single non-streamed JSON blob (20–60s).
2. `POST /api/trip-images` — only fires *after* the itinerary is fully returned (5–15s).
3. `createTrip` Convex mutation — single `db.insert` (1–2s).

During those seconds, rotating "Researching your destination…" copy ticks every 3s ([TripPlannerSheet.tsx:317](components/trip/TripPlannerSheet.tsx:317)) but bears no relationship to actual progress. The user has no idea whether it's almost done, halfway done, or stalled.

## Goal

Replace the loading screen with **optimistic navigation into a streaming trip detail screen**. The user sees their trip writing itself in real time — Day 1 in ~3 seconds, the rest filling in over the same total wall-clock window. Perceived wait drops from ~40s to ~3s. Total wall-clock time also drops because the work is parallelised.

The trip detail screen has five tabs (Overview, Itinerary, Bookings, Visa, Tips) and during generation each tab uses a tight visual vocabulary so the user always knows which sections are live, streaming, queued, or failed.

## Non-goals (out of scope)

- Refactoring the existing Vercel `/api/generate-trip` endpoint into multiple endpoints. We will *call it differently* (with streaming) but we are not splitting it into separate Vercel routes in this PR. We will introduce a new `/api/generate-trip-stream` endpoint and migrate the planner to it.
- Per-token streaming on non-itinerary sections. Budget, Visa, Tips, etc. patch the doc on full completion only — no progressive cursor mid-section. Per-token streaming everywhere requires partial-JSON parsing on every section and is not worth the complexity for the small UX delta.
- Image generation streaming. Images stay as a fan-out fetch but kick off as soon as Day 1's place names are available, not after the entire itinerary is done.
- Cancellation UI. The user can navigate away during generation, but there is no explicit "Cancel" button. Generation continues server-side; the populated trip simply appears in the list.
- Regenerate-this-section UI. Per-section retry on failure is in scope; "I want a different itinerary" is not.
- Multi-country trips. The existing `generate-multi-trip` endpoint is unchanged.
- Cost-aware degradation (e.g., Haiku for tips on a free-tier plan). Out of scope; we use one model tier consistently.

## User experience

### The moment of submit

User fills out the planner sheet (destination, dates, travelers, vibes), taps **Generate itinerary**. **Immediately**:

1. Sheet dismisses (no 300ms delay; current setTimeout at [TripPlannerSheet.tsx:490](components/trip/TripPlannerSheet.tsx:490) goes away).
2. Client navigates to `/trip/{id}` for the freshly-created stub.
3. Trip detail screen renders with skeleton sections + a thin coral progress strip across the top.

### The visual vocabulary (four loading languages)

Locked design system. Used everywhere in the streaming flow:

| Indicator | Visual | Meaning | Where used |
|---|---|---|---|
| **Bouncing dots (3)** | `· · ·` coral, scale + opacity, 200ms stagger, 1000ms loop | Opaque background work — no progress to show | Hero "image arriving" tag; top "Crafting your trip · N of M" status; Itinerary day pill suffix |
| **Streaming cursor** | thin coral I-beam, 0.9s steps(2) blink | Text actively being written — user sees words appearing | End of last word in actively-streaming day activity |
| **Single pulsing dot** | `•` coral, 1.4s ease-in-out blink | Badge — "incomplete, attend to it" | Section header next to streaming card titles; tab labels with pending content; currently-streaming day-dot in day-dots row |
| **Skeleton shimmer** | warm-toned linear gradient, 1.6s linear loop | Pre-content placeholder | Hero image background; queued section cards; queued day rows |

The `TypingDots` component already exists at [components/trip/TripPlannerSheet.tsx:152](components/trip/TripPlannerSheet.tsx:152). Lift it to `components/ui/TypingDots.tsx` and reuse.

### Trip detail at t ≈ 8s — Overview tab

A user who watches the screen for 8 seconds after submit sees:

- **Top of screen**: 1.5px coral progress strip pulsing under the safe-area blur. Above it, a small kicker: `Crafting your trip · 4 of 7 · · ·` (uppercase, coral, with bouncing dots). The strip persists across all five tabs.
- **Hero kicker** (instant, known from form): `TRIP · APRIL 30 → MAY 9` mono uppercase.
- **Country title** (instant): `Japan.` in italic Fraunces with a coral period.
- **Meta line** (instant): `10 days · 2 travelers · Tokyo + Kyoto`.
- **Hero image area**: warm shimmer placeholder with a translucent pill bottom-left reading `image arriving · · ·` (bouncing dots). When the image fetch resolves, the photo crossfades in over 250ms; the pill removes itself.
- **Highlights strip** (rendered via `HighlightsStrip` at [app/trip/[id]/index.tsx:442](app/trip/[id]/index.tsx:442)): once the `highlights` field arrives, four compact pills fade in. Pre-arrival: a row of three skeleton pills shimmer.
- **Next Up card** ([app/trip/[id]/index.tsx:432](app/trip/[id]/index.tsx:432)): renders only once `itinerary[0]` exists. Pre-arrival: hidden (no skeleton — the slot collapses).
- **AI chat CTA section** ([app/trip/[id]/index.tsx:447-491](app/trip/[id]/index.tsx:447)): unchanged — these CTAs don't depend on generated content. They render immediately.

### Trip detail at t ≈ 8s — Itinerary tab

Renders the existing `DayDeck` component ([app/trip/[id]/index.tsx:498-505](app/trip/[id]/index.tsx:498)), with three streaming additions:

- **Day pill nav** ("Day 2 of 10"): suffix becomes `Day 2 of 10 · writing · · ·` while a day is mid-stream. Right chevron is disabled (greyed at 0.3 opacity) when the next day doesn't exist yet; tapping it gives a haptic but doesn't navigate.
- **Day-dots row** (10 micro-dots beneath the pill): filled coral for complete days, pulsing-coral with 3px halo for the day currently writing, dim grey (`colors.line`) for queued days.
- **Active day card body**: morning/afternoon/evening activities render as they complete. The currently-streaming activity gets a streaming cursor at the end of its last word. Activities that haven't started yet render as a skeleton row (left "MORNING" kicker, right shimmer line).
- **Tapping a queued day**: navigates to `/trip/{id}/day/{idx}` as today, but the day detail screen renders `Day 5 · arriving in ~30s` + a skeleton until the data arrives. No dead screen.

### Trip detail at t ≈ 8s — Bookings, Visa, Tips tabs

- **Bookings**: unchanged — bookings are user-added, not generated. Inactive tab during streaming.
- **Visa**: until the `visaChecklist` / `visaCategory` / `visaNotes` fields populate, render the tab content as four skeleton cards. Once the section completes, fade in the real content. Tab label gets a coral dot until complete.
- **Tips**: same pattern as Visa. Tab label gets a coral dot until complete.

### Tab dot indicators

When a tab is inactive *and* its content is incomplete, a coral 4px dot appears next to the tab label. Dot animation: 1.4s blink. The Overview tab never gets a dot (its sections render inline; no "hidden incomplete content"). Bookings tab never gets a dot. Itinerary, Visa, and Tips tabs may.

### When generation completes

- The progress strip fades out over 400ms.
- The "Crafting your trip · N of M" kicker fades to nothing.
- All section dot/cursor/dot indicators clear.
- The trip's `status` flips from `"generating"` to `"planned"` in the Convex doc, observable to all subscribers.

### Trips list during generation

Today the trip card ([components/trips/TripRow.tsx:99-176](components/trips/TripRow.tsx:99)) shows a thumb, country name, mono date, visa pill. During generation:

- **Hero thumb**: warm-tone placeholder (`Photo` with no `uri`, `tone="mountain"`). No flag emoji fallback.
- **Bottom of thumb**: a 2px coral progress strip animates left-to-right across the bottom edge.
- **Right rail**: visa pill is replaced with a small `GENERATING` pill (coral background, white text, mono uppercase, 9pt) until complete.
- **Star badge**: hidden during generation (no starring an incomplete trip).

When the user taps a generating card, they navigate to the trip detail screen and see the streaming UX described above. They can leave and return; nothing breaks.

### Failure handling

**Per-section failure** (e.g., the `visaChecklist` stream throws):
- The trip's `status` does *not* flip to `"completed"`. It stays `"generating"`.
- The failing section's field is set to `null`. A new field `failedSections: v.array(v.string())` records which streams failed.
- On the trip detail screen, that section's card renders an inline error state: `Couldn't generate visa info` + `Retry` button. Retry calls a new `retrySection(tripId, sectionName)` mutation which re-runs that one section.
- The progress kicker becomes `Crafting your trip · 6 of 7 · 1 issue · · ·` (coral, with the bouncing dots and the `1 issue` segment in a slightly muted tone).
- After all sections are either complete or marked failed, status flips to `"planned"` and the progress strip removes — failed-section CTAs persist on the cards.

**Whole-trip failure** (e.g., total LLM outage, network):
- After 60 seconds with zero sections having streamed any content, the trip's `status` flips to `"failed"`.
- The trip detail screen renders a centered error state: `Couldn't create your trip` + `Try again` and `Delete` buttons.
- `Try again` re-runs the full generation flow with the original inputs, which are stored on the trip doc as `originalInputs: v.string()` (JSON-stringified planner form).
- `Delete` runs the existing `deleteTrip` mutation.

**Auth expires mid-generation:**
- Server-side actions have their own context and continue.
- Client reconnects on next foreground; Convex query repopulates; user sees the (possibly complete) trip.
- No special UX needed.

**User backgrounds the app mid-generation:**
- Server-side: continues. Mutations flow into the doc.
- Client: re-subscribes on foreground; trip updates without intervention.

**User force-quits the app:**
- Same as backgrounding — server-side work is decoupled from the client.

## Technical design

### Schema changes ([convex/schema.ts:9-58](convex/schema.ts:9))

Three changes to the `trips` table:

1. Widen the `status` literal:
   ```ts
   status: v.union(
     v.literal("planned"),
     v.literal("completed"),
     v.literal("generating"),
     v.literal("failed"),
   )
   ```
2. Add three new optional fields:
   ```ts
   failedSections: v.optional(v.array(v.string())),    // e.g. ["visaChecklist", "highlights"]
   originalInputs: v.optional(v.string()),             // JSON-stringified planner form for retry
   generationStartedAt: v.optional(v.number()),        // for the 60s timeout watchdog
   ```
3. All existing JSON-stringified content fields stay `v.string()` but the `createTrip` mutation now writes `""` (empty string) for sections that haven't started, and `safeParse` already gracefully handles that with the existing fallback.

   Note: we considered making them `v.optional(v.string())` but that ripples through every reader (`trip.itinerary` becomes `string | undefined`). Empty-string-as-pending is simpler.

Existing `by_status` index covers the new states automatically. No new indexes.

### Backend changes

#### New Vercel endpoint: `/api/generate-trip-stream`

Returns SSE (Server-Sent Events) with discriminated event payloads:

```
event: section-start
data: { "section": "highlights" }

event: section-complete
data: { "section": "highlights", "content": "[\"Shibuya at dusk\", \"Fushimi Inari\", ...]" }

event: itinerary-day-complete
data: { "dayIndex": 0, "day": { "title": "...", "morningPlace": "...", ... } }

event: section-failed
data: { "section": "visaChecklist", "error": "rate_limit_exceeded" }

event: done
data: {}
```

The endpoint internally fans out the existing mega-prompt into 5 parallel Anthropic calls:
- **Itinerary** (Sonnet) — streams day-by-day; emits `itinerary-day-complete` per day as JSON parses
- **Visa** (Sonnet) — emits `section-complete` once full
- **Budget** (Sonnet) — emits `section-complete` once full
- **Highlights** (Sonnet) — emits `section-complete` once full
- **Tips + Packing + Accommodation** (Sonnet, single call) — emits 3 `section-complete` events from one stream

All 5 share a cached Anthropic prompt prefix containing destination context (country, dates, travelers, budget tier, vibes). After the first call writes the cache, calls 2–5 read at 90% off input. See "Cost mitigations" below.

Static facts (`currency`, `timezone`, `language`, `iataCode`, `region`, `costLevel`, `flightHours`) come from a local lookup table in the new endpoint — **no LLM call**. Emitted as a single `section-complete` event with `section: "staticFacts"` typically within 200ms of the request landing.

#### Convex action: `generateTrip`

Replaces the client-side fetch flow at [TripPlannerSheet.tsx:387-506](components/trip/TripPlannerSheet.tsx:387). New action at `convex/trips.ts`:

```ts
export const generateTrip = action({
  args: { /* same fields as the current /api/generate-trip POST body */ },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // 1. Insert stub
    const tripId = await ctx.runMutation(internal.trips.insertGenerationStub, {
      userId,
      input: args,
    });
    // 2. Kick off streaming fetch (don't await)
    await ctx.scheduler.runAfter(0, internal.trips.runGenerationStream, {
      tripId,
      input: args,
    });
    // 3. Return ID immediately so client can navigate
    return tripId;
  },
});
```

The internal `runGenerationStream` action:
1. Opens a streaming `fetch` to `/api/generate-trip-stream`.
2. Reads the SSE stream via `response.body.getReader()`.
3. For each event, calls `internal.trips.patchTripSection({ tripId, section, content })` — a mutation that updates one field.
4. On `done`: calls `internal.trips.completeGeneration({ tripId })` which sets status to `"planned"`. Whether existing planned trips are later auto-completed when their `endDate` passes is a separate concern not touched by this spec.
5. On the 60s watchdog: a `ctx.scheduler.runAfter(60_000, internal.trips.checkGenerationTimeout, { tripId })` checks if any section has streamed; if not, marks as `"failed"`.
6. Wraps the full lifecycle in try/catch; any uncaught error sets status to `"failed"`.

#### Convex mutation: `patchTripSection`

```ts
export const patchTripSection = internalMutation({
  args: {
    tripId: v.id("trips"),
    section: v.string(),       // e.g. "highlights" or "itinerary-day:3"
    content: v.string(),       // JSON-stringified
    failed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const trip = await ctx.db.get(args.tripId);
    if (!trip) throw new Error("Trip vanished");
    if (args.failed) {
      const failed = trip.failedSections ?? [];
      await ctx.db.patch(args.tripId, {
        failedSections: [...failed, args.section],
      });
      return;
    }
    if (args.section.startsWith("itinerary-day:")) {
      // Append/replace day at index in the parsed itinerary array
      const idx = Number(args.section.split(":")[1]);
      const days = trip.itinerary ? JSON.parse(trip.itinerary) : [];
      days[idx] = JSON.parse(args.content);
      await ctx.db.patch(args.tripId, { itinerary: JSON.stringify(days) });
      return;
    }
    // Standard section: write directly to its field
    const field = SECTION_FIELD_MAP[args.section]; // e.g. "highlights"
    if (!field) throw new Error(`Unknown section: ${args.section}`);
    await ctx.db.patch(args.tripId, { [field]: args.content });
  },
});
```

Note: this writes one Convex mutation per section completion (~7-15 patches per trip). Convex pushes each patch to the subscribed client, so the UI re-renders 7-15 times during generation. This is well within Convex's design parameters and the React reconciler handles it without jank.

#### Trigger images fetch as soon as Day 1 lands

The existing `/api/trip-images` flow ([TripPlannerSheet.tsx:452-471](components/trip/TripPlannerSheet.tsx:452)) currently fires after the entire itinerary completes. Change: kick it off after the first `itinerary-day-complete` event, when we already have place names for the hero subject and Day 1 activities. This shaves ~5-10s off the time-to-first-image.

### Frontend changes

#### TripPlannerSheet.tsx

The whole loading state block ([TripPlannerSheet.tsx:1110-1180](components/trip/TripPlannerSheet.tsx:1110)) goes away. The `generate` callback ([TripPlannerSheet.tsx:387-506](components/trip/TripPlannerSheet.tsx:387)) becomes:

```ts
const generate = useCallback(async () => {
  // ...same input validation...
  try {
    setIsLoading(true);                      // brief flash, < 1s
    const tripId = await generateTripAction({ /* same args */ });
    bottomSheetRef.current?.dismiss();
    onTripCreated(String(tripId));           // parent navigates immediately
  } catch (e) {
    setError("Couldn't start your trip. Please try again.");
    setIsLoading(false);
  }
}, [...]);
```

The `LOAD_MSGS` array, `TypingDots` component, sparkle orb animation — all stay in the file but become unused. We lift `TypingDots` to `components/ui/TypingDots.tsx` and update both call sites (the planner sheet still uses it briefly during the < 1s window where the action is awaited; the trip detail screen uses it in the new streaming UI).

The parent of `TripPlannerSheet` (`app/(tabs)/trips.tsx`) wires `onTripCreated` to `router.push('/trip/' + tripId)`.

#### app/trip/[id]/index.tsx

Three additions:

1. **TripGenerationStrip** — a new component rendered as a sibling of `<TopSafeAreaBlur />`, conditionally on `trip.status === 'generating'`. Renders the 1.5px coral pulse line + the "Crafting your trip · N of M · · ·" kicker. Computes N/M from the populated/total section count.

2. **Section-state guards** — each block in the JSX checks the relevant field. Examples:
   ```tsx
   {trip.highlights ? <HighlightsStrip ... /> : <HighlightsSkeleton />}
   {trip.heroImage ? <TripOverviewHero ... /> : <TripHeroSkeleton />}
   ```

3. **Tab dot indicators** — `SegmentedControl` gets a new optional `dotIndicators?: Record<string, boolean>` prop. When a tab key has `true`, render a 4px coral dot offset top-right of the label.

A new `app/trip/[id]/_helpers/sectionState.ts` exports utilities like `isSectionPending(trip, sectionName)`, `getStreamingDayIndex(trip)`, etc. — all derived from current trip fields, no additional state.

#### components/trip/DayDeck.tsx (and its day card)

The day-pill nav suffix becomes `Day {n} of {N} · writing · · ·` when `getStreamingDayIndex(trip) === n - 1`. The day-dots row gets the three states (done / streaming / queued). The active day card renders its activities with a cursor on the streaming activity.

#### components/trips/TripRow.tsx

Add a `status?: string` prop. When `status === 'generating'`:
- Render thumb with no `uri` (already works at [TripRow.tsx:120](components/trips/TripRow.tsx:120)).
- Replace the visa pill with the GENERATING pill.
- Add a 2px coral animated bar at the bottom of `thumbWrap`.
- Hide the star badge.

The trips list ([app/(tabs)/trips.tsx:387-400](app/(tabs)/trips.tsx:387)) passes `status={trip.status}` through.

#### components/ui/TypingDots.tsx (new)

Lift the existing `TypingDots` from `TripPlannerSheet.tsx` into its own file. Same Reanimated worklet implementation (scale + opacity, 200ms stagger, 1000ms loop). Export with default coral color but accept a `color?: string` prop.

#### components/ui/SegmentedControl.tsx

Add the optional `dotIndicators` prop. Render a single 4px coral dot absolutely positioned top-right of the tab label when `dotIndicators[option]` is true. Animation: 1.4s blink (use existing `colors.coral`).

### The static-facts lookup

A new file `constants/staticTripFacts.ts` (client-side, but the Vercel endpoint will mirror it):

```ts
export const STATIC_FACTS: Record<string, {
  currency: string;
  language: string;
  timezone: string;
  iataCode: string;
  region: string;
  costLevel: number;
  flightHoursFromUS: number;  // from JFK as a default
}> = {
  JP: { currency: "JPY (¥)", language: "Japanese", timezone: "JST (UTC+9)", iataCode: "NRT", region: "East Asia", costLevel: 4, flightHoursFromUS: 14 },
  // ...all ~200 supported countries
};
```

Generated once from a public dataset (REST Countries API, IATA primary-airport lookup). Committed to git. Updated annually.

This removes 7 fields × ~50 tokens = ~350 output tokens per trip, plus the LLM context to know to emit them. Real-cost win is small but the latency win is meaningful — these arrive in < 200ms vs ~5s today.

## Cost mitigations

Honest math: parallel calls without mitigations are ~22% more expensive than the single mega-prompt today (input duplication; output is roughly the same). With mitigations layered:

| Mitigation | How | Impact |
|---|---|---|
| Anthropic prompt caching on shared destination prefix | Each section call uses a `cache_control: { type: "ephemeral" }` block on the `[country, dates, travelers, budget tier, vibes]` prefix. First call writes; subsequent 4 read at 10% of normal price (90% discount). 5-min TTL is well within the ~30s generation window. | Drops aggregate input cost by ~60%. Brings total cost to roughly even with current. |
| Static facts via local lookup | New `constants/staticTripFacts.ts` table indexed by ISO country code. No LLM. | Removes ~15-20% of output tokens. Drops total cost ~5-10% below current. |
| Country-level visa cache | New `convex/visaCache.ts` table keyed by `(destinationCode, passportCode)`. First user generates and writes; subsequent users read. Cache invalidates manually (or via TTL of 30 days for non-trivial geopolitical events). | At any reasonable traffic, drops amortized visa cost to near zero. Total cost lands ~20% cheaper than current. |

Net: with all three mitigations, **cost is roughly 20% cheaper than today**. The streaming UX is effectively free.

Future option (out of scope for this PR): route Highlights / Tips / Packing / Accommodation to Haiku (~12x cheaper). Would land another 20-30% cost reduction. We're not doing this now because we want to validate streaming quality on a single tier first.

## Edge cases

- **0-day trip**: schema allows `duration: 0` but the planner UI doesn't. Defensive: if the LLM returns 0 days, show the existing "No itinerary yet" state. Status still flips to `"planned"`.
- **Duration mismatch**: planner asks for 10 days, LLM returns 8. We render whatever the LLM returned. The day-dots row shows 8 dots. No error.
- **Malformed JSON in a streamed day**: the `patchTripSection` mutation tries to parse and on failure marks that section as failed and continues. Other days/sections proceed.
- **User generates Trip A, navigates to Trip A detail, taps to start Trip B from the trips list before A is done**: both trips have independent `tripId`s and independent SSE streams. They generate in parallel server-side. The Convex doc subscriptions are per-trip, so they don't interfere. **Anthropic tier-1 concurrency is ~5 in-flight requests; one trip already uses 5 parallel section calls, so two simultaneous trips would hit the limit and queue.** Acceptable — queued calls just take slightly longer to start; nothing breaks. Worth monitoring once we have real usage and bumping our tier if it becomes common.
- **Two devices on the same account**: both subscribe to the same trip doc; both see the streaming. No coordination needed.
- **Two collaborators on a shared trip**: same as above — both subscribe to the doc. Note: the existing `tripCollaborators` table doesn't permit non-owners to start generation, so only the owner triggers the stream. Other collaborators just observe.
- **Pull-to-refresh during generation**: the existing pull-to-refresh on the trip detail screen re-runs the Convex query. Already idempotent. Nothing changes.
- **Network drop mid-stream**: the Convex action's `fetch` to the Vercel endpoint will throw. The catch block sets `status: "failed"`. User retries via the Try Again button.
- **The user deletes the trip mid-generation**: existing `deleteTrip` mutation already exists; running it during generation removes the doc. The streaming action's next `patchTripSection` will throw "Trip vanished" — caught and ignored. No orphan state.
- **The `/api/trip-images` call fails entirely**: existing fallback at [TripPlannerSheet.tsx:472-474](components/trip/TripPlannerSheet.tsx:472) — proceed without images. Hero stays as the warm-tone placeholder forever; no error UI. This is unchanged behavior.
- **A streaming day completes but its place names are missing (LLM omitted morningPlace)**: image fetch for that day returns no image; day card renders with a tinted-fallback color. Existing pattern in [DayDeck](components/trip/DayDeck.tsx).
- **TopSafeAreaBlur + progress strip overlap**: the strip needs `position: absolute` with a higher z-index than the blur. The `TopSafeAreaBlur` component renders with the blur container's natural elevation; the new `TripGenerationStrip` renders as a sibling and stacks visually above it. Verify in Reanimated: blur with `pointerEvents: 'none'` ensures the strip stays interactive (not that it has tap targets, but defensively).
- **Animation count perf check**: at peak, the trip detail screen runs ~8 Reanimated worklets simultaneously (top dots, image dots, day pill dots, day-dots row pulse, cursor blink, shimmer on hero, shimmer on tips, progress strip). Reanimated runs all on the UI thread — should comfortably handle on iPhone 11 and up. Verify on a TestFlight build before merge.
- **5-minute Anthropic cache TTL exceeded**: trip generation taking > 5 minutes is pathological. Even so, a cache miss on call 5 just means it pays full input price for that call — degraded but not broken.
- **Schema migration on existing trips**: adding `"generating"` and `"failed"` to the status union, plus the three new optional fields, doesn't require a migration. Existing rows have `status: "planned"` or `"completed"` and the new fields are absent, which the schema allows. Convex's widening-union pattern handles this transparently.

## Decisions made (with reasoning, for future-me)

1. **Stub-first, stream-into approach** over "full server-side generate then return". Optimistic nav matters more than transactional cleanliness. A trip in the `generating` state is acceptable to surface — it's a state, not a bug.
2. **Empty string for pending content fields** instead of widening to `v.optional(v.string())`. Avoids rippling `undefined` checks through every reader.
3. **Per-section retry** instead of regenerate-everything. A failed visa section should not invalidate a successful itinerary.
4. **Per-day patch granularity** for the itinerary stream. Per-token would be too chatty for Convex and the visual difference (cursor on the streaming activity) is achievable by deriving "currently streaming" from the array length + the trip status.
5. **No cancellation UI**. Adds complexity and a confirmation flow for almost no user benefit. Generation is fast (~30s) and abandoning is free server-side.
6. **Static facts lookup, not LLM**. Latency win + cost win with no quality cost — these are factual lookups, not generative content.
7. **No Haiku routing** in this PR. Validate Sonnet-everywhere first; route later if cost matters.
8. **`status: "failed"`** as a distinct state from `"generating"` with no progress. Lets the UI surface a clear retry CTA without any client-side timer logic.

## Open questions (please resolve before plan)

1. **Should the trip generation strip persist across all five tabs, or fade when the user navigates *away from* Overview?** I've designed it to persist (it's a global signal). Confirm this is right.
2. **When the static facts arrive (instantly), should we render them in the Logistics-equivalent Overview section right away, or hold them until at least one other section completes?** I've designed for "render the moment they arrive" — confirm.
3. **Hero image timeout fallback** — if `/api/trip-images` takes > 30s, should we drop the placeholder and use what? I've designed to keep the placeholder forever (existing behavior). Alternative: show a country-flag emoji on a warm tile as a fallback after 30s. Your call.
4. **Schema migration for `originalInputs`** — existing rows don't have it, so retrying old failed trips wouldn't have inputs to retry from. Acceptable (those rows will never be in `failed` state, since they're all `planned` or `completed`). Confirm.

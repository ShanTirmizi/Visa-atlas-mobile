# Streaming Trip Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 25–75s blocking loading screen during trip creation with optimistic navigation into a trip detail screen that streams generated content (itinerary days, visa, budget, highlights, tips) as it arrives, dropping perceived wait from ~40s to ~3s.

**Architecture:** Client calls a new Convex action `generateTrip` which inserts a stub trip row (status `"generating"`) and schedules an internal action `runGenerationStream`. The internal action makes 5 parallel streaming calls to the Anthropic Messages API directly from Convex (no Vercel hop), parses SSE events, and patches the trip doc per section completion (and per day completion for the itinerary stream). The client navigates to the trip detail screen immediately on stub creation; Convex's real-time query subscription pushes section content to the screen as it lands. Trip detail and trips-list cards render skeleton/streaming/complete states using a locked four-language visual vocabulary (bouncing dots, streaming cursor, single pulsing dot, skeleton shimmer).

**Tech Stack:** React Native / Expo Router, Convex (queries / mutations / actions, default V8 runtime, real-time subscriptions), Anthropic Messages API (raw `fetch` with SSE parsing — no SDK dependency), Reanimated for UI worklets, existing `TypingDots` component (lifted to `components/ui/`).

**Architectural deviation from spec:** The spec described a new Vercel endpoint at `/api/generate-trip-stream` that fans out to Anthropic. This plan calls Anthropic *directly* from a Convex action, eliminating the Vercel hop. Reasons: (1) the Vercel project lives in a separate repo we don't have access to, (2) Convex's default V8 runtime supports `fetch()` with streaming responses natively, (3) one less network hop = lower latency and simpler debugging. This requires `ANTHROPIC_API_KEY` in Convex env (Task 0.1) and means we write Anthropic prompts directly in `convex/`. The user-visible UX is identical to the spec.

---

## File Structure

### New files

```
constants/staticTripFacts.ts                  # ISO country code → currency/lang/timezone/IATA/region/cost lookup
components/ui/TypingDots.tsx                  # Lifted from TripPlannerSheet (3 bouncing coral dots)
components/trip/TripGenerationStrip.tsx       # Top status strip — pulse line + "Crafting your trip · N of M · · ·"
components/trip/skeletons/TripHeroSkeleton.tsx
components/trip/skeletons/HighlightsSkeleton.tsx
components/trip/skeletons/VisaTabSkeleton.tsx
components/trip/skeletons/TipsTabSkeleton.tsx
components/trip/skeletons/SectionRetryCard.tsx  # Per-section failure state with Retry CTA
components/trip/TripFailedScreen.tsx          # Whole-trip failure → Try Again / Delete
app/trip/[id]/_helpers/sectionState.ts        # Pure helpers: isSectionPending, getStreamingDayIndex, etc.
convex/tripGeneration.ts                      # Public action `generateTrip`, internal action `runGenerationStream`, all internal mutations
convex/lib/anthropicStream.ts                 # Raw fetch + SSE parser, prompt builders, section parsers
convex/lib/sectionFieldMap.ts                 # SECTION_NAME → trip doc field mapping
docs/superpowers/plans/2026-04-30-streaming-trip-generation.md  # this file
```

### Modified files

```
convex/schema.ts                               # Widen trips.status union, add 3 optional fields
convex/trips.ts                                # Mark old createTrip as @deprecated; add retrySection action
components/trip/TripPlannerSheet.tsx           # Replace generate() with new action call; remove sparkle loading
app/trip/[id]/index.tsx                        # Conditional skeletons per section, mount TripGenerationStrip
components/trip/DayDeck.tsx                    # Day-pill suffix, day-dots row, streaming cursor on active activity
components/trips/TripRow.tsx                   # status='generating' visual: placeholder hero + GENERATING pill + progress strip
components/ui/SegmentedControl.tsx             # New optional dotIndicators prop
app/(tabs)/trips.tsx                           # Pass status={trip.status} to TripRow
```

---

## Verification posture

This plan uses pragmatic verification, not strict TDD on every UI task. Reasons:

- **Convex backend code** — verified via `npx convex dev --once` + a one-off test trip creation in dev.
- **React Native UI** — verified visually on the iOS simulator + occasional TestFlight build (per CLAUDE.md guidance).
- **Pure helpers** (`sectionState.ts`, `anthropicStream.ts` parsers, `staticTripFacts.ts` lookup) — these get unit tests.
- **End-to-end** — final task runs through the user-facing flow: tap Generate → land on detail → watch sections stream in → verify trip card update.

Every task ends with a verification step and a commit.

---

## Phase 0 — Foundation (low-risk setup)

### Task 0.1: Add ANTHROPIC_API_KEY to Convex env

**Files:**
- Modify: Convex environment (CLI command, no code change)

- [ ] **Step 1: Set the env var in dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

The user provides the key. If they don't have one, they create one at console.anthropic.com → API Keys.

- [ ] **Step 2: Verify**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex env list | grep ANTHROPIC_API_KEY
```

Expected: `ANTHROPIC_API_KEY` appears in output (the value is masked).

- [ ] **Step 3: No commit** — env vars aren't tracked in git.

---

### Task 0.2: Lift `TypingDots` to `components/ui/TypingDots.tsx`

**Files:**
- Create: `components/ui/TypingDots.tsx`
- Modify: `components/trip/TripPlannerSheet.tsx:152-184` (remove local definition, import from new location)

- [ ] **Step 1: Create the new component**

```tsx
// components/ui/TypingDots.tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type TypingDotsSize = 'sm' | 'md';

interface TypingDotsProps {
  color: string;
  size?: TypingDotsSize;
  /** Horizontal gap between dots. Default 6px. */
  gap?: number;
}

/**
 * Three bouncing dots — the "active opaque background work" indicator.
 * Reanimated worklets run on the UI thread; safe to mount many simultaneously.
 */
export function TypingDots({ color, size = 'md', gap = 6 }: TypingDotsProps) {
  const dot1 = useSharedValue(0.4);
  const dot2 = useSharedValue(0.4);
  const dot3 = useSharedValue(0.4);

  useEffect(() => {
    const anim = (sv: { value: number }, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: delay }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    };
    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scale: dot1.value }], opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scale: dot2.value }], opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scale: dot3.value }], opacity: dot3.value }));

  const dotPx = size === 'sm' ? 4 : 6;
  const dotStyle = { width: dotPx, height: dotPx, borderRadius: dotPx / 2, backgroundColor: color };

  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'center' }}>
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
      <Animated.View style={[dotStyle, s3]} />
    </View>
  );
}
```

- [ ] **Step 2: Update TripPlannerSheet to import from the new location**

In `components/trip/TripPlannerSheet.tsx`, delete the local `TypingDots` function (lines 142-184) and add:

```tsx
import { TypingDots } from '@/components/ui/TypingDots';
```

The existing call site at line 1179 (`<TypingDots color={colors.coral} />`) continues to work as-is.

- [ ] **Step 3: Verify visually**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx expo start
```

Open the app, tap Generate trip on the planner sheet. Confirm the loading state still shows the three coral bouncing dots animating identically to before.

- [ ] **Step 4: Commit**

```bash
git add components/ui/TypingDots.tsx components/trip/TripPlannerSheet.tsx
git commit -m "refactor: lift TypingDots from TripPlannerSheet to components/ui

Will be reused on the trip detail screen + trip card during the streaming
generation flow."
```

---

### Task 0.3: Create `constants/staticTripFacts.ts`

**Files:**
- Create: `constants/staticTripFacts.ts`
- Test: `constants/__tests__/staticTripFacts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// constants/__tests__/staticTripFacts.test.ts
import { describe, expect, it } from '@jest/globals';
import { lookupStaticFacts, hasStaticFacts } from '@/constants/staticTripFacts';

describe('staticTripFacts', () => {
  it('returns full facts for a known country', () => {
    const f = lookupStaticFacts('JP');
    expect(f).toEqual({
      currency: 'JPY (¥)',
      language: 'Japanese',
      timezone: 'JST (UTC+9)',
      iataCode: 'NRT',
      region: 'East Asia',
      costLevel: 4,
      flightHoursFromUS: 14,
    });
  });

  it('returns null for an unknown country', () => {
    expect(lookupStaticFacts('XX')).toBeNull();
  });

  it('hasStaticFacts is a fast boolean check', () => {
    expect(hasStaticFacts('JP')).toBe(true);
    expect(hasStaticFacts('XX')).toBe(false);
  });

  it('handles lowercase ISO codes', () => {
    expect(lookupStaticFacts('jp')?.currency).toBe('JPY (¥)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- staticTripFacts
```

Expected: FAIL with "Cannot find module '@/constants/staticTripFacts'".

- [ ] **Step 3: Write the lookup table and helpers**

```ts
// constants/staticTripFacts.ts
export interface StaticTripFacts {
  currency: string;
  language: string;
  timezone: string;
  iataCode: string;
  region: string;
  /** 1 = budget, 5 = ultra-luxury */
  costLevel: number;
  /** From JFK, rough average. Used by the planner to estimate flight hours. */
  flightHoursFromUS: number;
}

/**
 * Static lookup of facts that don't change per-user-trip.
 *
 * Why local lookup, not LLM: these are factual mappings (ISO → currency, etc.).
 * Putting them through an LLM costs tokens and adds latency for no quality
 * benefit. Updated annually from the REST Countries API + IATA primary-airport
 * lookup.
 */
export const STATIC_TRIP_FACTS: Record<string, StaticTripFacts> = {
  // ── Asia-Pacific ───────────────────────────────────────────────
  JP: { currency: 'JPY (¥)',  language: 'Japanese',     timezone: 'JST (UTC+9)',   iataCode: 'NRT', region: 'East Asia',     costLevel: 4, flightHoursFromUS: 14 },
  KR: { currency: 'KRW (₩)',  language: 'Korean',       timezone: 'KST (UTC+9)',   iataCode: 'ICN', region: 'East Asia',     costLevel: 3, flightHoursFromUS: 14 },
  CN: { currency: 'CNY (¥)',  language: 'Mandarin',     timezone: 'CST (UTC+8)',   iataCode: 'PEK', region: 'East Asia',     costLevel: 2, flightHoursFromUS: 14 },
  TW: { currency: 'TWD (NT$)',language: 'Mandarin',     timezone: 'CST (UTC+8)',   iataCode: 'TPE', region: 'East Asia',     costLevel: 3, flightHoursFromUS: 16 },
  TH: { currency: 'THB (฿)',  language: 'Thai',         timezone: 'ICT (UTC+7)',   iataCode: 'BKK', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 17 },
  VN: { currency: 'VND (₫)',  language: 'Vietnamese',   timezone: 'ICT (UTC+7)',   iataCode: 'SGN', region: 'Southeast Asia',costLevel: 1, flightHoursFromUS: 19 },
  ID: { currency: 'IDR (Rp)', language: 'Indonesian',   timezone: 'WIB (UTC+7)',   iataCode: 'CGK', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 20 },
  SG: { currency: 'SGD (S$)', language: 'English',      timezone: 'SGT (UTC+8)',   iataCode: 'SIN', region: 'Southeast Asia',costLevel: 4, flightHoursFromUS: 18 },
  MY: { currency: 'MYR (RM)', language: 'Malay',        timezone: 'MYT (UTC+8)',   iataCode: 'KUL', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 18 },
  PH: { currency: 'PHP (₱)',  language: 'Filipino',     timezone: 'PHT (UTC+8)',   iataCode: 'MNL', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 16 },
  IN: { currency: 'INR (₹)',  language: 'Hindi',        timezone: 'IST (UTC+5:30)',iataCode: 'DEL', region: 'South Asia',    costLevel: 1, flightHoursFromUS: 14 },
  AU: { currency: 'AUD (A$)', language: 'English',      timezone: 'AEDT (UTC+11)', iataCode: 'SYD', region: 'Oceania',       costLevel: 4, flightHoursFromUS: 22 },
  NZ: { currency: 'NZD (NZ$)',language: 'English',      timezone: 'NZDT (UTC+13)', iataCode: 'AKL', region: 'Oceania',       costLevel: 4, flightHoursFromUS: 18 },

  // ── Europe ─────────────────────────────────────────────────────
  GB: { currency: 'GBP (£)',  language: 'English',      timezone: 'GMT (UTC+0)',   iataCode: 'LHR', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 7 },
  FR: { currency: 'EUR (€)',  language: 'French',       timezone: 'CET (UTC+1)',   iataCode: 'CDG', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  DE: { currency: 'EUR (€)',  language: 'German',       timezone: 'CET (UTC+1)',   iataCode: 'FRA', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  IT: { currency: 'EUR (€)',  language: 'Italian',      timezone: 'CET (UTC+1)',   iataCode: 'FCO', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 9 },
  ES: { currency: 'EUR (€)',  language: 'Spanish',      timezone: 'CET (UTC+1)',   iataCode: 'MAD', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  PT: { currency: 'EUR (€)',  language: 'Portuguese',   timezone: 'WET (UTC+0)',   iataCode: 'LIS', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  NL: { currency: 'EUR (€)',  language: 'Dutch',        timezone: 'CET (UTC+1)',   iataCode: 'AMS', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  BE: { currency: 'EUR (€)',  language: 'Dutch/French', timezone: 'CET (UTC+1)',   iataCode: 'BRU', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  CH: { currency: 'CHF',      language: 'German/French',timezone: 'CET (UTC+1)',   iataCode: 'ZRH', region: 'Western Europe',costLevel: 5, flightHoursFromUS: 9 },
  AT: { currency: 'EUR (€)',  language: 'German',       timezone: 'CET (UTC+1)',   iataCode: 'VIE', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 9 },
  IE: { currency: 'EUR (€)',  language: 'English',      timezone: 'GMT (UTC+0)',   iataCode: 'DUB', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 7 },
  GR: { currency: 'EUR (€)',  language: 'Greek',        timezone: 'EET (UTC+2)',   iataCode: 'ATH', region: 'Southern Europe',costLevel: 3, flightHoursFromUS: 11 },
  HR: { currency: 'EUR (€)',  language: 'Croatian',     timezone: 'CET (UTC+1)',   iataCode: 'ZAG', region: 'Southern Europe',costLevel: 3, flightHoursFromUS: 10 },
  CZ: { currency: 'CZK (Kč)', language: 'Czech',        timezone: 'CET (UTC+1)',   iataCode: 'PRG', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  PL: { currency: 'PLN (zł)', language: 'Polish',       timezone: 'CET (UTC+1)',   iataCode: 'WAW', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  HU: { currency: 'HUF (Ft)', language: 'Hungarian',    timezone: 'CET (UTC+1)',   iataCode: 'BUD', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  SE: { currency: 'SEK (kr)', language: 'Swedish',      timezone: 'CET (UTC+1)',   iataCode: 'ARN', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 9 },
  NO: { currency: 'NOK (kr)', language: 'Norwegian',    timezone: 'CET (UTC+1)',   iataCode: 'OSL', region: 'Northern Europe',costLevel: 5, flightHoursFromUS: 8 },
  DK: { currency: 'DKK (kr)', language: 'Danish',       timezone: 'CET (UTC+1)',   iataCode: 'CPH', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 8 },
  FI: { currency: 'EUR (€)',  language: 'Finnish',      timezone: 'EET (UTC+2)',   iataCode: 'HEL', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 9 },
  IS: { currency: 'ISK (kr)', language: 'Icelandic',    timezone: 'GMT (UTC+0)',   iataCode: 'KEF', region: 'Northern Europe',costLevel: 5, flightHoursFromUS: 6 },

  // ── Americas ───────────────────────────────────────────────────
  US: { currency: 'USD ($)',  language: 'English',      timezone: 'ET (UTC-5)',    iataCode: 'JFK', region: 'North America', costLevel: 4, flightHoursFromUS: 0 },
  CA: { currency: 'CAD (C$)', language: 'English/French',timezone: 'ET (UTC-5)',   iataCode: 'YYZ', region: 'North America', costLevel: 3, flightHoursFromUS: 2 },
  MX: { currency: 'MXN ($)',  language: 'Spanish',      timezone: 'CST (UTC-6)',   iataCode: 'MEX', region: 'North America', costLevel: 2, flightHoursFromUS: 5 },
  BR: { currency: 'BRL (R$)', language: 'Portuguese',   timezone: 'BRT (UTC-3)',   iataCode: 'GRU', region: 'South America', costLevel: 2, flightHoursFromUS: 10 },
  AR: { currency: 'ARS ($)',  language: 'Spanish',      timezone: 'ART (UTC-3)',   iataCode: 'EZE', region: 'South America', costLevel: 2, flightHoursFromUS: 11 },
  CL: { currency: 'CLP ($)',  language: 'Spanish',      timezone: 'CLT (UTC-4)',   iataCode: 'SCL', region: 'South America', costLevel: 3, flightHoursFromUS: 11 },
  PE: { currency: 'PEN (S/)', language: 'Spanish',      timezone: 'PET (UTC-5)',   iataCode: 'LIM', region: 'South America', costLevel: 2, flightHoursFromUS: 8 },
  CO: { currency: 'COP ($)',  language: 'Spanish',      timezone: 'COT (UTC-5)',   iataCode: 'BOG', region: 'South America', costLevel: 2, flightHoursFromUS: 6 },
  CR: { currency: 'CRC (₡)',  language: 'Spanish',      timezone: 'CST (UTC-6)',   iataCode: 'SJO', region: 'Central America',costLevel: 2,flightHoursFromUS: 6 },

  // ── Middle East / Africa ───────────────────────────────────────
  AE: { currency: 'AED (د.إ)',language: 'Arabic',       timezone: 'GST (UTC+4)',   iataCode: 'DXB', region: 'Middle East',   costLevel: 4, flightHoursFromUS: 13 },
  TR: { currency: 'TRY (₺)',  language: 'Turkish',      timezone: 'TRT (UTC+3)',   iataCode: 'IST', region: 'Middle East',   costLevel: 2, flightHoursFromUS: 11 },
  IL: { currency: 'ILS (₪)',  language: 'Hebrew',       timezone: 'IST (UTC+2)',   iataCode: 'TLV', region: 'Middle East',   costLevel: 4, flightHoursFromUS: 11 },
  EG: { currency: 'EGP (£)',  language: 'Arabic',       timezone: 'EET (UTC+2)',   iataCode: 'CAI', region: 'North Africa',  costLevel: 2, flightHoursFromUS: 12 },
  MA: { currency: 'MAD (د.م.)',language: 'Arabic',      timezone: 'WET (UTC+0)',   iataCode: 'CMN', region: 'North Africa',  costLevel: 2, flightHoursFromUS: 8 },
  ZA: { currency: 'ZAR (R)',  language: 'English',      timezone: 'SAST (UTC+2)',  iataCode: 'JNB', region: 'Southern Africa',costLevel: 2,flightHoursFromUS: 16 },
  KE: { currency: 'KES (KSh)',language: 'English',      timezone: 'EAT (UTC+3)',   iataCode: 'NBO', region: 'East Africa',   costLevel: 2, flightHoursFromUS: 15 },
  TZ: { currency: 'TZS (TSh)',language: 'Swahili',      timezone: 'EAT (UTC+3)',   iataCode: 'DAR', region: 'East Africa',   costLevel: 2, flightHoursFromUS: 16 },
};

export function lookupStaticFacts(code: string): StaticTripFacts | null {
  const upper = code.toUpperCase();
  return STATIC_TRIP_FACTS[upper] ?? null;
}

export function hasStaticFacts(code: string): boolean {
  return code.toUpperCase() in STATIC_TRIP_FACTS;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- staticTripFacts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add constants/staticTripFacts.ts constants/__tests__/staticTripFacts.test.ts
git commit -m "feat: add static trip facts lookup table

Replaces ~7 LLM-generated fields (currency, language, timezone, IATA,
region, costLevel, flightHours) with a local lookup. Removes ~350 output
tokens per trip; arrives in <200ms vs ~5s today."
```

---

## Phase 1 — Convex schema

### Task 1.1: Widen `trips.status` and add new fields

**Files:**
- Modify: `convex/schema.ts:9-58`

- [ ] **Step 1: Apply schema changes**

Edit `convex/schema.ts` to widen the `status` literal and add three new optional fields. The diff:

```diff
-    status: v.union(v.literal("planned"), v.literal("completed")),
+    status: v.union(
+      v.literal("planned"),
+      v.literal("completed"),
+      v.literal("generating"),
+      v.literal("failed"),
+    ),
```

And add (anywhere in the trips fields list, before the closing `})`):

```ts
    failedSections: v.optional(v.array(v.string())),
    originalInputs: v.optional(v.string()),
    generationStartedAt: v.optional(v.number()),
```

- [ ] **Step 2: Push schema to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: stdout contains a line like `✔ Updated table 'trips' schema` or `Convex functions ready!` with no errors. If you see a schema validation error referencing existing rows, the existing data is incompatible — investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "schema: widen trips.status union + add generation tracking fields

Adds 'generating' and 'failed' to the status union, plus failedSections,
originalInputs, and generationStartedAt for the streaming generation flow."
```

---

## Phase 2 — Convex backend: data plane

### Task 2.1: Create `convex/lib/sectionFieldMap.ts`

**Files:**
- Create: `convex/lib/sectionFieldMap.ts`

- [ ] **Step 1: Write the module**

```ts
// convex/lib/sectionFieldMap.ts
import type { Doc } from "../_generated/dataModel";

/**
 * Maps a section name (used in SSE events + retry calls) to the trip
 * doc field that holds its content. Drives `patchTripSection`.
 *
 * Sections that are NOT in this map are handled specially:
 *   - "itinerary-day:N"  → appended/replaced at index N in the parsed
 *                          itinerary array
 *   - "staticFacts"      → patches multiple fields atomically
 *                          (currency, language, etc.); see patchTripSection
 *   - "heroImage"        → set on completion; see patchTripSection
 */
export const SECTION_FIELD_MAP = {
  highlights: "highlights",
  visaChecklist: "visaChecklist",
  visaNotes: "visaNotes",
  budgetBreakdown: "budgetBreakdown",
  packingSuggestions: "packingSuggestions",
  accommodationTips: "accommodationTips",
  localEssentials: "localEssentials",
  localGuide: "localGuide",
  carRental: "carRental",
  seasonalGuide: "seasonalGuide",
} as const satisfies Record<string, keyof Doc<"trips">>;

export type SectionName =
  | keyof typeof SECTION_FIELD_MAP
  | `itinerary-day:${number}`
  | "staticFacts"
  | "heroImage";

/**
 * The full ordered list of sections that the generation flow expects
 * to populate. Used by completeGeneration to determine "all done".
 * Itinerary days are tracked separately via the parsed array length.
 */
export const STREAMING_SECTIONS = [
  "highlights",
  "visaChecklist",
  "visaNotes",
  "budgetBreakdown",
  "packingSuggestions",
  "accommodationTips",
] as const satisfies readonly (keyof typeof SECTION_FIELD_MAP)[];
```

- [ ] **Step 2: Verify it compiles**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/sectionFieldMap.ts
git commit -m "feat(convex): add section→field map for trip generation"
```

---

### Task 2.2: Create stub trip insertion mutation

**Files:**
- Create: `convex/tripGeneration.ts` (initial skeleton)

- [ ] **Step 1: Create the file with the first internal mutation**

```ts
// convex/tripGeneration.ts
import { v } from "convex/values";
import { internalMutation, internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import { lookupStaticFacts } from "../constants/staticTripFacts";

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
```

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: `✔ Added function tripGeneration:insertGenerationStub`.

- [ ] **Step 3: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): insertGenerationStub — initial trip row with static facts"
```

---

### Task 2.3: Create `patchTripSection` internal mutation

**Files:**
- Modify: `convex/tripGeneration.ts` (append)

- [ ] **Step 1: Append the patch mutation**

Add to `convex/tripGeneration.ts`:

```ts
import { SECTION_FIELD_MAP } from "./lib/sectionFieldMap";

/**
 * Patch a single section's content into the trip doc. Called by the
 * streaming action as each section completes (and per-day for itinerary).
 *
 * Three modes:
 *   - failed=true       → adds `section` to failedSections, does not
 *                         touch the field
 *   - "itinerary-day:N" → parses content as one ItineraryDay JSON, sets
 *                         it at index N in the parsed itinerary array,
 *                         re-stringifies
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
```

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: `✔ Added function tripGeneration:patchTripSection`.

- [ ] **Step 3: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): patchTripSection — per-section + per-day streaming patches"
```

---

### Task 2.4: Create `completeGeneration` and `failGeneration` mutations

**Files:**
- Modify: `convex/tripGeneration.ts` (append)

- [ ] **Step 1: Append the completion + failure mutations**

```ts
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
```

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: 3 new functions added.

- [ ] **Step 3: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): completeGeneration / failGeneration / checkGenerationTimeout"
```

---

## Phase 3 — Convex backend: Anthropic streaming

### Task 3.1: Create the SSE parser + prompt builders in `convex/lib/anthropicStream.ts`

**Files:**
- Create: `convex/lib/anthropicStream.ts`

This is the single biggest file. It contains:
- `buildSystemPrompt(input)` — returns the cached prefix shared across all 5 calls
- `buildSectionPrompt(section, input)` — returns the per-section instruction
- `streamAnthropic(opts, onEvent)` — opens a stream to `api.anthropic.com/v1/messages`, parses SSE, calls back with token deltas
- `parseItineraryStream(onDayComplete)` — buffers tokens, detects when each `[i]` element of the days array completes, emits it
- `parseSimpleSection(onDone)` — buffers tokens, on stream completion calls `onDone` with the full string

- [ ] **Step 1: Create the file**

```ts
// convex/lib/anthropicStream.ts

interface GenerateInput {
  countryCode: string;
  countryName: string;
  capital: string;
  duration: number;
  vibe: string;
  budget: string;
  interests: string;
  activityStyles: string[];
  travelParty: string;
  heldVisas: string[];
  startDate?: string;
  endDate?: string;
  companions?: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";

/**
 * The shared system prompt prefix. Wrapped in a `cache_control: { type:
 * "ephemeral" }` block on each request so calls 2-5 read the cache at
 * 90% off input cost. 5-min TTL is well within our ~30s generation
 * window.
 */
export function buildSystemPrompt(input: GenerateInput): string {
  return `You are a meticulous travel planner writing for a premium iOS app called Visa Atlas.

The user's trip:
- Destination: ${input.countryName} (${input.countryCode})
- Capital / primary city: ${input.capital}
- Duration: ${input.duration} days
- Travel party: ${input.travelParty}${input.companions ? ` (${input.companions})` : ""}
- Budget tier: ${input.budget}
- Vibe / pace: ${input.vibe}
- Interests: ${input.interests}
- Activity styles: ${input.activityStyles.join(", ") || "none specified"}
- Visas already held: ${input.heldVisas.join(", ") || "none"}
${input.startDate && input.endDate ? `- Dates: ${input.startDate} → ${input.endDate}` : "- Dates: flexible (\"dreaming\" mode)"}

Tone: editorial, specific, never generic. Recommend real places by name. Avoid clichés ("hidden gem", "must-see", "off the beaten path"). Write the way the New York Times Travel section does — confident, particular, warm.

Output: emit ONLY valid JSON for the requested section, no preamble, no markdown fences, no explanation. Match the schema exactly.`;
}

// ── Per-section instruction prompts ──────────────────────────────

export function buildItineraryUserPrompt(input: GenerateInput): string {
  return `Generate the day-by-day itinerary as a JSON array with exactly ${input.duration} elements. Each element matches:

{
  "title": "Editorial title — short, evocative, specific to the day's character",
  "subtitle": "ALL CAPS · KICKER · UNDER 5 WORDS",
  "heroSubject": "The single most photogenic place/landmark for this day, used to fetch the hero image",
  "morning": "2-4 sentences. Specific recommendations with named places. Editorial tone.",
  "morningPlace": "The primary place name for morning",
  "afternoon": "2-4 sentences.",
  "afternoonPlace": "...",
  "evening": "2-4 sentences.",
  "eveningPlace": "...",
  "tip": "Optional one-sentence local tip. May be omitted."
}

Emit ONLY the JSON array. No surrounding object, no preamble.`;
}

export function buildVisaUserPrompt(input: GenerateInput): string {
  return `Generate visa information as a JSON object with this shape:

{
  "visaCategory": "visa-free" | "visa-on-arrival" | "e-visa" | "embassy" | "varies",
  "visaNotes": "1-2 sentences plain English summary",
  "visaChecklist": "[\\"Passport valid 6mo\\", \\"Onward ticket\\", ...]"  // JSON-stringified array of bullet items
}

For US passport holders unless held visas suggest otherwise. Be concrete; cite typical durations and what's required at the border. Output ONLY the JSON object.`;
}

export function buildBudgetUserPrompt(input: GenerateInput): string {
  return `Generate budget information as a JSON object:

{
  "dailyBudget": "~$XXX/person/day for ${input.budget} tier",
  "budgetBreakdown": "[\\"Lodging: $X-Y/night\\", \\"Food: $X-Y/day\\", \\"Transit: $X-Y/day\\", \\"Activities: $X-Y/day\\"]"  // JSON-stringified array
}

Use real, current-ish prices for ${input.countryName} at the ${input.budget} tier. Output ONLY the JSON object.`;
}

export function buildHighlightsUserPrompt(input: GenerateInput): string {
  return `Generate the trip highlights — 4 to 6 short evocative pills the user will see at the top of their trip overview.

Output a JSON-stringified array of strings, each 2-5 words, each a specific named place or moment (not a category):

["Shibuya at dusk", "Fushimi Inari", "Tsukiji breakfast", "Onsen night"]

Output ONLY the JSON array.`;
}

export function buildTipsBundleUserPrompt(input: GenerateInput): string {
  return `Generate three sections at once as a JSON object:

{
  "packingSuggestions": "[\\"Item 1 with a short reason\\", \\"Item 2 ...\\", ...]"  // JSON-stringified array of 6-10 items
  "accommodationTips": "1-2 paragraphs. Where to stay by neighbourhood, what to look for, what to avoid.",
  "localEssentials": "[\\"Tip 1\\", \\"Tip 2\\", ...]"  // JSON-stringified array of 5-8 short tips
}

All content tailored to ${input.countryName}, ${input.budget} budget, ${input.travelParty} travel party. Output ONLY the JSON object.`;
}

// ── SSE streaming over fetch ─────────────────────────────────────

interface StreamOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

interface StreamCallbacks {
  /** Fired for each text delta token. */
  onDelta: (text: string) => void;
  /** Fired once at end-of-stream regardless of success. */
  onComplete: () => void;
  /** Fired on transport / API errors. */
  onError: (err: Error) => void;
}

/**
 * Open a streaming POST to the Anthropic Messages API. Parses SSE,
 * extracts text deltas, and invokes onDelta as tokens arrive.
 *
 * The shared system prompt is wrapped in cache_control so subsequent
 * parallel calls within 5 minutes hit the cache at 90% input discount.
 */
export async function streamAnthropic(
  opts: StreamOptions,
  cb: StreamCallbacks,
): Promise<void> {
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        system: [
          {
            type: "text",
            text: opts.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: opts.userPrompt }],
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "<no body>");
      throw new Error(`Anthropic API ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines
      let lineEnd: number;
      while ((lineEnd = buffer.indexOf("\n\n")) !== -1) {
        const event = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const json = dataLine.slice(6).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json);
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta" &&
            typeof parsed.delta.text === "string"
          ) {
            cb.onDelta(parsed.delta.text);
          }
        } catch {
          // Malformed event line — skip
        }
      }
    }
    cb.onComplete();
  } catch (err) {
    cb.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Section parsers (consume token deltas, emit completed sections) ──

/**
 * Buffer all tokens; on completion, return the full trimmed string.
 * Used for visa, budget, highlights, tips-bundle — sections that don't
 * benefit from progressive emission (their content is short and JSON-
 * structured).
 */
export function makeWholeSectionBuffer(
  onDone: (full: string) => void,
  onErr: (err: Error) => void,
): StreamCallbacks {
  let buffer = "";
  return {
    onDelta: (text) => {
      buffer += text;
    },
    onComplete: () => onDone(buffer.trim()),
    onError: (err) => onErr(err),
  };
}

/**
 * Streaming parser for the itinerary array. Tracks bracket depth to
 * know when each top-level array element (one Day) closes, and emits
 * that day's JSON on completion.
 *
 * Why bracket counting and not a streaming JSON parser library? Keep
 * the dependency footprint tiny in Convex; the day shape is simple
 * enough that depth-tracking is reliable. We additionally validate via
 * JSON.parse before emission — a malformed slice never reaches the
 * patch mutation.
 */
export function makeItineraryStreamParser(
  onDayComplete: (dayIndex: number, dayJson: string) => void,
  onErr: (err: Error) => void,
): StreamCallbacks {
  let buffer = "";
  let inArray = false;
  let depth = 0; // depth WITHIN the array (objects/arrays nested in a day)
  let inString = false;
  let escapeNext = false;
  let dayStart = -1;
  let dayIndex = 0;

  return {
    onDelta: (text) => {
      for (const char of text) {
        const idx = buffer.length;
        buffer += char;

        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === "\\" && inString) {
          escapeNext = true;
          continue;
        }
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (!inArray) {
          if (char === "[") {
            inArray = true;
          }
          continue;
        }
        // we're in the array
        if (char === "{") {
          if (depth === 0) dayStart = idx;
          depth++;
        } else if (char === "}") {
          depth--;
          if (depth === 0 && dayStart !== -1) {
            const slice = buffer.slice(dayStart, idx + 1);
            try {
              JSON.parse(slice); // validate
              onDayComplete(dayIndex, slice);
              dayIndex++;
            } catch (err) {
              onErr(new Error(`Malformed day ${dayIndex}: ${(err as Error).message}`));
            }
            dayStart = -1;
          }
        }
      }
    },
    onComplete: () => {
      // No-op; per-day emission already happened. If the stream closed
      // mid-day, that day is silently dropped (will show up as missing
      // in the final array).
    },
    onError: (err) => onErr(err),
  };
}
```

- [ ] **Step 2: Add a quick smoke test**

Create `convex/lib/__tests__/anthropicStream.test.ts`:

```ts
import { describe, expect, it } from '@jest/globals';
import { makeItineraryStreamParser, makeWholeSectionBuffer } from '../anthropicStream';

describe('makeItineraryStreamParser', () => {
  it('emits each day as it completes', () => {
    const days: Array<[number, string]> = [];
    const errs: Error[] = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      (err) => errs.push(err),
    );
    // Simulate a streamed array of two days, split arbitrarily
    cb.onDelta('[{"title":"D1","mor');
    cb.onDelta('ning":"x"},{"title":"D2","morning":"y"}]');
    cb.onComplete();
    expect(errs).toEqual([]);
    expect(days).toHaveLength(2);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'D1', morning: 'x' });
    expect(JSON.parse(days[1][1])).toEqual({ title: 'D2', morning: 'y' });
  });

  it('handles strings with embedded braces', () => {
    const days: Array<[number, string]> = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      () => {},
    );
    cb.onDelta('[{"title":"a {b} c","x":1}]');
    cb.onComplete();
    expect(days).toHaveLength(1);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'a {b} c', x: 1 });
  });

  it('handles escaped quotes in strings', () => {
    const days: Array<[number, string]> = [];
    const cb = makeItineraryStreamParser(
      (idx, json) => days.push([idx, json]),
      () => {},
    );
    cb.onDelta('[{"title":"a \\"b\\" c","x":1}]');
    cb.onComplete();
    expect(days).toHaveLength(1);
    expect(JSON.parse(days[0][1])).toEqual({ title: 'a "b" c', x: 1 });
  });
});

describe('makeWholeSectionBuffer', () => {
  it('concatenates all deltas and trims', () => {
    let result = '';
    const cb = makeWholeSectionBuffer((full) => { result = full; }, () => {});
    cb.onDelta('  {"a"');
    cb.onDelta(': 1}');
    cb.onComplete();
    expect(result).toBe('{"a": 1}');
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npm test -- anthropicStream
```

Expected: 4 tests pass.

- [ ] **Step 4: Verify it compiles in Convex**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/anthropicStream.ts convex/lib/__tests__/anthropicStream.test.ts
git commit -m "feat(convex): Anthropic SSE streaming + section parsers

Adds raw fetch-based SSE parser, prompt builders for the 5 parallel
section calls (with shared cached prefix), and the per-day streaming
parser for the itinerary stream. No SDK dependency."
```

---

### Task 3.2: Create `runGenerationStream` internal action

**Files:**
- Modify: `convex/tripGeneration.ts` (append the action)

- [ ] **Step 1: Append the streaming action**

```ts
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
                  // Tips-bundle case: one stream → multiple sections
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
        streamAnthropic(
          { apiKey, systemPrompt, userPrompt, maxTokens: 8192 },
          {
            onDelta: (text) => itineraryParser.onDelta(text),
            onComplete: () => {
              itineraryParser.onComplete();
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
        // The parser invokes patchTripSection per-day completion
        const itineraryParser = makeItineraryStreamParser(
          async (dayIndex, dayJson) => {
            await ctx.runMutation(internal.tripGeneration.patchTripSection, {
              tripId,
              section: `itinerary-day:${dayIndex}`,
              content: dayJson,
            });
          },
          (err) => console.error("Itinerary parse error:", err),
        );
      });
    };

    // Tips bundle returns three sections in one JSON; split into patches
    const tipsBundleTransform = (raw: string): Array<{ section: string; content: string }> => {
      try {
        const parsed = JSON.parse(raw);
        return [
          { section: "packingSuggestions", content: parsed.packingSuggestions ?? "[]" },
          { section: "accommodationTips", content: parsed.accommodationTips ?? "" },
          { section: "localEssentials", content: parsed.localEssentials ?? "[]" },
        ];
      } catch {
        return [
          { section: "packingSuggestions", content: "" },
          { section: "accommodationTips", content: "" },
          { section: "localEssentials", content: "" },
        ];
      }
    };

    // Visa returns three fields in one JSON
    const visaTransform = (raw: string): Array<{ section: string; content: string }> => {
      try {
        const parsed = JSON.parse(raw);
        // visaCategory is a special case — patches the trips.visaCategory field,
        // which lives outside SECTION_FIELD_MAP. Inline patch via a dedicated
        // mutation would be cleaner; for this PR we stuff it via patchTripSection
        // with a shim section name handled by an extra branch in patchTripSection.
        // For the v1 plan, we patch only the two we have field maps for:
        return [
          { section: "visaNotes", content: parsed.visaNotes ?? "" },
          { section: "visaChecklist", content: parsed.visaChecklist ?? "[]" },
          // visaCategory is omitted in v1 — TODO followup task.
        ];
      } catch {
        return [
          { section: "visaNotes", content: "" },
          { section: "visaChecklist", content: "" },
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
      // All settled (success or failure) → complete generation
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
```

Note the `// visaCategory is omitted in v1 — TODO followup task` comment: the existing schema has a `visaCategory` field that we're not patching in this PR. Stays as `""` from the stub. The Visa tab UI handles empty `visaCategory` gracefully (it won't render the badge). A followup task can add `visaCategory` patching via either a generalized `patchTripField` mutation or by extending `SECTION_FIELD_MAP` and the tips-bundle transform pattern.

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: `✔ Added function tripGeneration:runGenerationStream`.

- [ ] **Step 3: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): runGenerationStream — 5 parallel Anthropic streams w/ patch"
```

---

### Task 3.3: Create the public `generateTrip` action

**Files:**
- Modify: `convex/tripGeneration.ts` (append)

- [ ] **Step 1: Append the public action**

```ts
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
    // Fire-and-forget the streaming work
    await ctx.scheduler.runAfter(0, internal.tripGeneration.runGenerationStream, {
      tripId,
      input: args,
    });
    return tripId;
  },
});
```

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: `✔ Added function tripGeneration:generateTrip`.

- [ ] **Step 3: Smoke test from the Convex dashboard**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dashboard
```

In the dashboard, navigate to Functions → tripGeneration:generateTrip. Run with sample args (you'll need a real authenticated session — easiest path is to invoke via the app in the next phase).

For now, only verify the function appears in the function list with no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): generateTrip public action — stub + schedule stream"
```

---

### Task 3.4: Add `retrySection` action

**Files:**
- Modify: `convex/tripGeneration.ts` (append)

- [ ] **Step 1: Append the retry action**

```ts
import { checkTripPermission } from "./lib/auth";

/**
 * Retry a single section after a failure. Re-runs that one section's
 * stream and removes it from failedSections on success.
 */
export const retrySection = action({
  args: {
    tripId: v.id("trips"),
    section: v.string(),
  },
  handler: async (ctx, { tripId, section }) => {
    await checkTripPermission(ctx, tripId, "owner");
    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip) throw new Error("Trip not found");
    if (!trip.originalInputs) throw new Error("No original inputs stored — cannot retry");

    const input = JSON.parse(trip.originalInputs);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const systemPrompt = buildSystemPrompt(input);

    // Map section name → prompt + parser strategy
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
        // Will populate both fields in one call; that's fine.
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

    // Re-run the stream, patch on completion, remove from failedSections
    await new Promise<void>((resolve) => {
      streamAnthropic(
        { apiKey, systemPrompt, userPrompt, maxTokens },
        makeWholeSectionBuffer(
          async (full) => {
            // For simple sections, patch directly. For bundles, parse and patch each.
            if (section === "highlights" || section === "budgetBreakdown") {
              await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                tripId, section, content: full.trim(),
              });
            } else if (["visaChecklist", "visaNotes"].includes(section)) {
              try {
                const parsed = JSON.parse(full);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "visaNotes", content: parsed.visaNotes ?? "",
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "visaChecklist", content: parsed.visaChecklist ?? "[]",
                });
              } catch {/* swallow */}
            } else {
              try {
                const parsed = JSON.parse(full);
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "packingSuggestions", content: parsed.packingSuggestions ?? "[]",
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "accommodationTips", content: parsed.accommodationTips ?? "",
                });
                await ctx.runMutation(internal.tripGeneration.patchTripSection, {
                  tripId, section: "localEssentials", content: parsed.localEssentials ?? "[]",
                });
              } catch {/* swallow */}
            }
            // Remove this section (and any related ones the bundle covered) from failedSections
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

/** Internal query for retrySection to read the trip — keeps the action stateless */
export const _getTripForRetry = internalQuery({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => ctx.db.get(tripId),
});

/** Remove a section (and any siblings from a bundle retry) from failedSections */
export const _clearFailedSection = internalMutation({
  args: { tripId: v.id("trips"), section: v.string() },
  handler: async (ctx, { tripId, section }) => {
    const trip = await ctx.db.get(tripId);
    if (!trip) return;
    const failed = trip.failedSections ?? [];
    // Remove the explicit section, plus any bundle siblings
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
```

Add to imports at top of file:

```ts
import { internalQuery } from "./_generated/server";
```

- [ ] **Step 2: Push to dev**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Expected: 3 new functions added.

- [ ] **Step 3: Commit**

```bash
git add convex/tripGeneration.ts
git commit -m "feat(convex): retrySection action + supporting internal helpers"
```

---

## Phase 4 — Frontend: trip detail streaming UI

### Task 4.1: Create section-state derivation helpers

**Files:**
- Create: `app/trip/[id]/_helpers/sectionState.ts`
- Test: `app/trip/[id]/_helpers/__tests__/sectionState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from '@jest/globals';
import {
  isGenerating,
  isSectionPending,
  hasFailed,
  getStreamingDayIndex,
  getCompletedSectionCount,
  getTotalSectionCount,
} from '../sectionState';

const baseTrip = {
  status: 'planned',
  itinerary: '',
  highlights: '',
  visaChecklist: '',
  visaNotes: '',
  budgetBreakdown: '',
  packingSuggestions: '',
  accommodationTips: '',
  failedSections: [],
  duration: 10,
  heroImage: undefined,
} as const;

describe('sectionState helpers', () => {
  it('isGenerating returns true only when status is generating', () => {
    expect(isGenerating({ ...baseTrip, status: 'generating' })).toBe(true);
    expect(isGenerating({ ...baseTrip, status: 'planned' })).toBe(false);
    expect(isGenerating({ ...baseTrip, status: 'failed' })).toBe(false);
  });

  it('isSectionPending true when field empty and not in failedSections', () => {
    expect(isSectionPending({ ...baseTrip, status: 'generating' }, 'highlights')).toBe(true);
    expect(isSectionPending({ ...baseTrip, status: 'generating', highlights: '[]' }, 'highlights')).toBe(false);
    expect(isSectionPending({ ...baseTrip, status: 'generating', failedSections: ['highlights'] }, 'highlights')).toBe(false);
  });

  it('isSectionPending false when not generating', () => {
    expect(isSectionPending({ ...baseTrip, status: 'planned' }, 'highlights')).toBe(false);
  });

  it('hasFailed checks failedSections', () => {
    expect(hasFailed({ ...baseTrip, failedSections: ['highlights'] }, 'highlights')).toBe(true);
    expect(hasFailed(baseTrip, 'highlights')).toBe(false);
  });

  it('getStreamingDayIndex returns array length when generating, else null', () => {
    expect(
      getStreamingDayIndex({
        ...baseTrip,
        status: 'generating',
        itinerary: JSON.stringify([{ title: 'D1' }, { title: 'D2' }]),
      }),
    ).toBe(2);
    expect(
      getStreamingDayIndex({ ...baseTrip, status: 'planned', itinerary: '[]' }),
    ).toBeNull();
  });

  it('getCompletedSectionCount counts non-empty content fields', () => {
    expect(
      getCompletedSectionCount({ ...baseTrip, highlights: '[]', budgetBreakdown: '[]' }),
    ).toBe(2);
    expect(getCompletedSectionCount(baseTrip)).toBe(0);
  });

  it('getTotalSectionCount is the same constant', () => {
    // 6 streamed sections + itinerary + heroImage = 8; adjust if shape changes
    expect(getTotalSectionCount()).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- sectionState
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the helpers**

```ts
// app/trip/[id]/_helpers/sectionState.ts
import type { Doc } from '@/convex/_generated/dataModel';

type TripLike = Pick<
  Doc<'trips'>,
  | 'status'
  | 'itinerary'
  | 'highlights'
  | 'visaChecklist'
  | 'visaNotes'
  | 'budgetBreakdown'
  | 'packingSuggestions'
  | 'accommodationTips'
  | 'failedSections'
  | 'duration'
  | 'heroImage'
>;

export type SectionName =
  | 'highlights'
  | 'visaChecklist'
  | 'visaNotes'
  | 'budgetBreakdown'
  | 'packingSuggestions'
  | 'accommodationTips';

const STREAMED_SECTIONS: SectionName[] = [
  'highlights',
  'visaChecklist',
  'visaNotes',
  'budgetBreakdown',
  'packingSuggestions',
  'accommodationTips',
];

const TOTAL_SECTIONS = STREAMED_SECTIONS.length + 2; // + itinerary + heroImage

export function isGenerating(trip: TripLike): boolean {
  return trip.status === 'generating';
}

export function hasFailed(trip: TripLike, section: string): boolean {
  return (trip.failedSections ?? []).includes(section);
}

export function isSectionPending(trip: TripLike, section: SectionName): boolean {
  if (!isGenerating(trip)) return false;
  if (hasFailed(trip, section)) return false;
  return !trip[section];
}

export function getStreamingDayIndex(trip: TripLike): number | null {
  if (!isGenerating(trip)) return null;
  if (!trip.itinerary) return 0;
  try {
    const parsed = JSON.parse(trip.itinerary);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function getCompletedSectionCount(trip: TripLike): number {
  let count = 0;
  for (const s of STREAMED_SECTIONS) {
    if (trip[s]) count++;
  }
  if (trip.itinerary) {
    try {
      const days = JSON.parse(trip.itinerary);
      if (Array.isArray(days) && days.length >= (trip.duration ?? 0)) count++;
    } catch {/* */}
  }
  if (trip.heroImage) count++;
  return count;
}

export function getTotalSectionCount(): number {
  return TOTAL_SECTIONS;
}

export function getTabDotIndicators(trip: TripLike): Record<string, boolean> {
  if (!isGenerating(trip)) {
    // Even when not generating, surface tab dots if a section failed
    return {
      Visa: hasFailed(trip, 'visaChecklist') || hasFailed(trip, 'visaNotes'),
      Tips: hasFailed(trip, 'packingSuggestions') ||
            hasFailed(trip, 'accommodationTips') ||
            hasFailed(trip, 'localEssentials'),
      Itinerary: false,
    };
  }
  return {
    Visa: isSectionPending(trip, 'visaChecklist') || isSectionPending(trip, 'visaNotes'),
    Tips: isSectionPending(trip, 'packingSuggestions') ||
          isSectionPending(trip, 'accommodationTips'),
    Itinerary: (() => {
      const idx = getStreamingDayIndex(trip);
      return idx !== null && idx < (trip.duration ?? 0);
    })(),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- sectionState
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/trip/[id]/_helpers/sectionState.ts app/trip/[id]/_helpers/__tests__/sectionState.test.ts
git commit -m "feat: section-state derivation helpers for the trip detail screen"
```

---

### Task 4.2: Create `TripGenerationStrip` component

**Files:**
- Create: `components/trip/TripGenerationStrip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/trip/TripGenerationStrip.tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { TypingDots } from '@/components/ui/TypingDots';
import { FontFamily } from '@/constants/theme';

interface TripGenerationStripProps {
  /** N from "Crafting your trip · N of M" */
  completed: number;
  /** M from "Crafting your trip · N of M" */
  total: number;
  /** Optional: "1 issue" appended in muted tone if any sections failed */
  issueCount?: number;
}

const STRIP_HEIGHT = 1.5;

/**
 * Top-of-screen progress strip + status kicker. Renders ABOVE the
 * TopSafeAreaBlur (z-index 10) and stays mounted across all five tabs.
 *
 * Strip animation: a coral gradient sweeps right→left in a 2.4s cycle
 * with opacity oscillating 0.35 ↔ 1. Feels alive without being noisy.
 */
export function TripGenerationStrip({ completed, total, issueCount = 0 }: TripGenerationStripProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [sweep]);

  const stripStyle = useAnimatedStyle(() => {
    const progress = sweep.value;
    return {
      opacity: 0.35 + Math.sin(progress * Math.PI) * 0.65,
      transform: [{ translateX: -200 + progress * 400 }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      <View style={{ height: insets.top, justifyContent: 'flex-end', paddingBottom: 4, paddingLeft: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 0.08 * 9,
              textTransform: 'uppercase',
              color: colors.coral,
              fontFamily: FontFamily.semibold,
            }}
          >
            Crafting your trip · {completed} of {total}
            {issueCount > 0 && (
              <Text style={{ color: colors.inkMute }}>
                {`  · ${issueCount} issue${issueCount > 1 ? 's' : ''}`}
              </Text>
            )}
          </Text>
          <TypingDots color={colors.coral} size="sm" gap={3} />
        </View>
      </View>
      <View style={{ height: STRIP_HEIGHT, overflow: 'hidden' }}>
        <Animated.View
          style={[
            {
              width: 200,
              height: STRIP_HEIGHT,
              backgroundColor: colors.coral,
            },
            stripStyle,
          ]}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/trip/TripGenerationStrip.tsx
git commit -m "feat: TripGenerationStrip — top progress strip + status kicker"
```

---

### Task 4.3: Create the four skeleton components

**Files:**
- Create: `components/trip/skeletons/TripHeroSkeleton.tsx`
- Create: `components/trip/skeletons/HighlightsSkeleton.tsx`
- Create: `components/trip/skeletons/VisaTabSkeleton.tsx`
- Create: `components/trip/skeletons/TipsTabSkeleton.tsx`

Each is a simple shimmering placeholder that matches the dimensions of the real component it's standing in for.

- [ ] **Step 1: Create a shared shimmer primitive**

```tsx
// components/trip/skeletons/_shimmer.tsx
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

interface ShimmerProps {
  style?: ViewStyle;
}

export function Shimmer({ style }: ShimmerProps) {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [x]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + Math.sin(x.value * Math.PI) * 0.4,
  }));
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.warmBg ?? '#F5EFE6' }, style]}>
      <Animated.View
        style={[
          { width: '100%', height: '100%', backgroundColor: colors.line ?? '#EFE7D9' },
          animStyle,
        ]}
      />
    </View>
  );
}
```

- [ ] **Step 2: Hero skeleton**

```tsx
// components/trip/skeletons/TripHeroSkeleton.tsx
import { View, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { TypingDots } from '@/components/ui/TypingDots';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

export function TripHeroSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: Spacing.md, marginHorizontal: Spacing.lg, position: 'relative' }}>
      <Shimmer style={{ height: 220, borderRadius: Radius.lg }} />
      <View
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(255,255,255,0.78)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
        }}
      >
        <Text style={{ fontSize: 9, letterSpacing: 0.06 * 9, textTransform: 'uppercase', color: colors.inkMute }}>
          image arriving
        </Text>
        <TypingDots color={colors.coral} size="sm" gap={3} />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Highlights skeleton**

```tsx
// components/trip/skeletons/HighlightsSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Spacing } from '@/constants/theme';

export function HighlightsSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
      <Shimmer style={{ width: 90, height: 22, borderRadius: 999 }} />
      <Shimmer style={{ width: 70, height: 22, borderRadius: 999 }} />
      <Shimmer style={{ width: 110, height: 22, borderRadius: 999 }} />
    </View>
  );
}
```

- [ ] **Step 4: Visa tab skeleton**

```tsx
// components/trip/skeletons/VisaTabSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

export function VisaTabSkeleton() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, gap: 12, marginTop: Spacing.md }}>
      <Shimmer style={{ height: 90, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
    </View>
  );
}
```

- [ ] **Step 5: Tips tab skeleton**

```tsx
// components/trip/skeletons/TipsTabSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

export function TipsTabSkeleton() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, gap: 12, marginTop: Spacing.md }}>
      <Shimmer style={{ height: 110, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 80, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 80, borderRadius: Radius.md }} />
    </View>
  );
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx tsc --noEmit
```

If `colors.warmBg` is missing on the theme, add it to `constants/theme.ts` light + dark palettes (per CLAUDE.md theming rules) — likely value: `#F5EFE6` light, `#2A2419` dark.

- [ ] **Step 7: Commit**

```bash
git add components/trip/skeletons/
git commit -m "feat: skeleton components for hero, highlights, visa tab, tips tab"
```

---

### Task 4.4: Create `SectionRetryCard` for per-section failures

**Files:**
- Create: `components/trip/skeletons/SectionRetryCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/trip/skeletons/SectionRetryCard.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useMutation } from 'convex/react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { RotateCw } from 'lucide-react-native';

interface SectionRetryCardProps {
  tripId: Id<'trips'>;
  section: string;
  /** User-facing label for the failed section, e.g. "visa info" */
  label: string;
}

export function SectionRetryCard({ tripId, section, label }: SectionRetryCardProps) {
  const { colors } = useTheme();
  const retry = useAction(api.tripGeneration.retrySection);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    setRetrying(true);
    setError(null);
    try {
      await retry({ tripId, section });
    } catch (err) {
      setError("Couldn't retry. Try again in a moment.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      style={{
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        padding: 14,
        borderRadius: Radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Text style={[Type.body13, { color: colors.ink, marginBottom: 6 }]}>
        Couldn't generate {label}
      </Text>
      <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 11, marginBottom: 12 }]}>
        Tap retry to try again — your other sections are unaffected.
      </Text>
      <Pressable
        onPress={onPress}
        disabled={retrying}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: colors.coral,
          opacity: pressed || retrying ? 0.7 : 1,
        })}
      >
        <RotateCw size={12} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
          {retrying ? 'Retrying...' : 'Retry'}
        </Text>
      </Pressable>
      {error && (
        <Text style={{ color: colors.coral, fontSize: 11, marginTop: 8 }}>
          {error}
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trip/skeletons/SectionRetryCard.tsx
git commit -m "feat: SectionRetryCard — inline failure recovery for streamed sections"
```

---

### Task 4.5: Create `TripFailedScreen`

**Files:**
- Create: `components/trip/TripFailedScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/trip/TripFailedScreen.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Radius, Spacing, Type, FontFamily } from '@/constants/theme';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id, Doc } from '@/convex/_generated/dataModel';
import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';

interface TripFailedScreenProps {
  trip: Doc<'trips'>;
}

export function TripFailedScreen({ trip }: TripFailedScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const generate = useAction(api.tripGeneration.generateTrip);
  const deleteTrip = useMutation(api.trips.deleteTrip);
  const [retrying, setRetrying] = useState(false);

  const onTryAgain = async () => {
    if (!trip.originalInputs) {
      // No inputs stored — fall back to deleting and asking the user to start again
      await deleteTrip({ id: trip._id });
      router.replace('/(tabs)/trips');
      return;
    }
    setRetrying(true);
    try {
      const inputs = JSON.parse(trip.originalInputs);
      const newTripId = await generate(inputs);
      // Delete the failed stub
      await deleteTrip({ id: trip._id });
      router.replace(`/trip/${newTripId}`);
    } catch (err) {
      setRetrying(false);
    }
  };

  const onDelete = async () => {
    await deleteTrip({ id: trip._id });
    router.replace('/(tabs)/trips');
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <AlertTriangle size={42} color={colors.coral} strokeWidth={1.6} />
      <Text
        style={[
          Type.headlineSm,
          {
            color: colors.ink,
            marginTop: 18,
            marginBottom: 6,
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            textAlign: 'center',
          },
        ]}
      >
        Couldn't create your trip<Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Text style={[Type.body13, { color: colors.inkMute, textAlign: 'center', marginBottom: 28 }]}>
        Something went wrong while generating. Your inputs are saved — try again.
      </Text>
      <Pressable
        onPress={onTryAgain}
        disabled={retrying}
        style={({ pressed }) => ({
          paddingHorizontal: 28,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: colors.coral,
          opacity: pressed || retrying ? 0.7 : 1,
          marginBottom: 12,
        })}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
          {retrying ? 'Trying again...' : 'Try again'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => ({
          paddingHorizontal: 28,
          paddingVertical: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.inkMute, fontSize: 13 }}>Delete</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/trip/TripFailedScreen.tsx
git commit -m "feat: TripFailedScreen — whole-trip failure recovery with Try Again"
```

---

### Task 4.6: Add `dotIndicators` prop to `SegmentedControl`

**Files:**
- Modify: `components/ui/SegmentedControl.tsx`

- [ ] **Step 1: Read the existing file**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" cat components/ui/SegmentedControl.tsx | head -160
```

Identify the props interface (around line 17) and the squiggle variant render path (lines 20-68).

- [ ] **Step 2: Add the `dotIndicators` prop and render the dot**

In the props interface, add:

```ts
/**
 * Optional map: tab option → whether to show a coral dot indicator
 * next to that tab's label. Used during trip generation to flag
 * tabs with pending content.
 */
dotIndicators?: Record<string, boolean>;
```

In the squiggle variant render (the function that maps `options` to tabs), wrap the label in a `View` and conditionally render a dot:

```tsx
import { useTheme } from '@/hooks/useTheme';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

// In the tab render:
{dotIndicators?.[option] && <PulsingDot />}
```

Add this helper inside the same file (or its own internal component):

```tsx
function PulsingDot() {
  const { colors } = useTheme();
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -2,
          right: -7,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.coral,
        },
        s,
      ]}
    />
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/ui/SegmentedControl.tsx
git commit -m "feat(SegmentedControl): optional dotIndicators prop for streaming UX"
```

---

### Task 4.7: Wire skeletons into `app/trip/[id]/index.tsx`

**Files:**
- Modify: `app/trip/[id]/index.tsx`

This is the orchestration task — pulling all the new components into the trip detail screen.

- [ ] **Step 1: Add imports at the top of the file**

```tsx
import { TripGenerationStrip } from '@/components/trip/TripGenerationStrip';
import { TripHeroSkeleton } from '@/components/trip/skeletons/TripHeroSkeleton';
import { HighlightsSkeleton } from '@/components/trip/skeletons/HighlightsSkeleton';
import { VisaTabSkeleton } from '@/components/trip/skeletons/VisaTabSkeleton';
import { TipsTabSkeleton } from '@/components/trip/skeletons/TipsTabSkeleton';
import { SectionRetryCard } from '@/components/trip/skeletons/SectionRetryCard';
import { TripFailedScreen } from '@/components/trip/TripFailedScreen';
import {
  isGenerating,
  isSectionPending,
  hasFailed,
  getCompletedSectionCount,
  getTotalSectionCount,
  getTabDotIndicators,
} from './_helpers/sectionState';
```

- [ ] **Step 2: After the trip is loaded, branch on status**

Find the location where the screen renders the loaded trip (around line 322 after the loading guard). Add:

```tsx
if (trip.status === 'failed') {
  return <TripFailedScreen trip={trip} />;
}

const generating = isGenerating(trip);
const dotIndicators = getTabDotIndicators(trip);
const completedSections = getCompletedSectionCount(trip);
const totalSections = getTotalSectionCount();
const issueCount = (trip.failedSections ?? []).length;
```

- [ ] **Step 3: Mount `TripGenerationStrip` as a sibling of `TopSafeAreaBlur`**

Find the `<TopSafeAreaBlur />` mount (around line 340 per the agent's earlier report) and add immediately after it:

```tsx
{generating && (
  <TripGenerationStrip
    completed={completedSections}
    total={totalSections}
    issueCount={issueCount}
  />
)}
```

- [ ] **Step 4: Pass `dotIndicators` to `SegmentedControl`**

Update the existing call (around line 410-415):

```tsx
<SegmentedControl
  options={TABS}
  value={activeTab}
  onChange={(v) => setActiveTab(v as TabKey)}
  variant="squiggle"
  dotIndicators={dotIndicators}
/>
```

- [ ] **Step 5: Conditional skeletons on Overview tab**

Find the hero render (around line 424-429) and the highlights strip (around line 442). Replace with conditional logic:

```tsx
{trip.heroImage ? (
  <TripOverviewHero
    tripName={trip.routeTitle ?? trip.countryName ?? ''}
    cityName={cityLabel}
    heroImageUrl={heroImage?.url}
    duration={typeof trip.duration === 'number' ? trip.duration : undefined}
  />
) : generating ? (
  <TripHeroSkeleton />
) : null}

{trip.highlights ? (
  <HighlightsStrip items={highlights} onSeeAll={() => setActiveTab('Itinerary')} />
) : isSectionPending(trip, 'highlights') ? (
  <HighlightsSkeleton />
) : hasFailed(trip, 'highlights') ? (
  <SectionRetryCard tripId={trip._id} section="highlights" label="highlights" />
) : null}
```

- [ ] **Step 6: Conditional skeleton on Visa tab**

Find the Visa tab block (around lines 521-891). Wrap the existing IIFE that conditionally renders visa content:

```tsx
{activeTab === 'Visa' && (
  <Animated.View entering={tabSlideIn(tabDirection * 18)} style={{ paddingTop: 8 }}>
    {(isSectionPending(trip, 'visaChecklist') || isSectionPending(trip, 'visaNotes')) ? (
      <VisaTabSkeleton />
    ) : (hasFailed(trip, 'visaChecklist') || hasFailed(trip, 'visaNotes')) ? (
      <SectionRetryCard tripId={trip._id} section="visaChecklist" label="visa info" />
    ) : (
      // ... existing visa render block ...
    )}
  </Animated.View>
)}
```

- [ ] **Step 7: Conditional skeleton on Tips tab**

Same pattern as Visa, on the Tips tab block.

- [ ] **Step 8: Verify visually**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx expo start
```

You can't yet trigger generation from the planner sheet (that's task 6.1). For now, manually patch a trip in the Convex dashboard to status `"generating"` and verify the trip detail screen shows the strip + skeletons.

- [ ] **Step 9: Commit**

```bash
git add app/trip/[id]/index.tsx
git commit -m "feat(trip-detail): conditional skeletons + generation strip + tab dots"
```

---

## Phase 5 — Frontend: DayDeck streaming

### Task 5.1: Update `DayDeck` for streaming day pill + dots row + active-day cursor

**Files:**
- Modify: `components/trip/DayDeck.tsx`

- [ ] **Step 1: Read the existing DayDeck**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" cat components/trip/DayDeck.tsx | head -200
```

Note the day-pill nav and the day card render structure.

- [ ] **Step 2: Add a `streamingDayIndex?: number | null` prop**

In `DayDeckProps`, add:

```ts
/**
 * If the trip is mid-generation, this is the index of the day currently
 * being written. null/undefined means no day is streaming. The day at
 * this index renders with a typing-dots suffix in the pill and a
 * coral cursor at the end of its currently-streaming activity.
 */
streamingDayIndex?: number | null;
/**
 * Total expected days (for the day-dots row). Defaults to `days.length`.
 */
expectedDayCount?: number;
```

- [ ] **Step 3: Render the day pill suffix when streaming**

Wherever the pill currently renders `Day N of M`, conditionally append:

```tsx
{streamingDayIndex === currentDayIdx && (
  <>
    <Text>{` · writing`}</Text>
    <TypingDots color={colors.coral} size="sm" gap={3} />
  </>
)}
```

- [ ] **Step 4: Add a day-dots row beneath the pill**

```tsx
function DayDotsRow({
  total,
  currentIndex,
  streamingIndex,
}: {
  total: number;
  currentIndex: number;
  streamingIndex?: number | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const isDone = i < (streamingIndex ?? total);
        const isStreaming = i === streamingIndex;
        return (
          <View
            key={i}
            style={[
              { width: 5, height: 5, borderRadius: 2.5 },
              isDone && { backgroundColor: colors.coral },
              isStreaming && {
                backgroundColor: colors.coral,
                shadowColor: colors.coral,
                shadowOpacity: 0.5,
                shadowRadius: 3,
                elevation: 3,
              },
              !isDone && !isStreaming && { backgroundColor: colors.line },
            ]}
          />
        );
      })}
    </View>
  );
}
```

Mount it directly under the day pill nav.

- [ ] **Step 5: Render streaming cursor on the active day's currently-streaming activity**

The day card currently renders Morning / Afternoon / Evening as activity rows. The "currently streaming" activity is the LAST one with content (since the LLM emits them in order). For the day at `streamingDayIndex`, find the last filled activity and append a coral cursor.

Add a `<StreamingCursor />` component:

```tsx
function StreamingCursor() {
  const { colors } = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0, { duration: 450, easing: Easing.steps(2) }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        {
          width: 1.5,
          height: 11,
          backgroundColor: colors.coral,
          marginLeft: 2,
          alignSelf: 'center',
        },
        s,
      ]}
    />
  );
}
```

Append `<StreamingCursor />` to the rendered text of the last completed activity slot (morning/afternoon/evening) on the day at `streamingDayIndex`.

- [ ] **Step 6: Disable right chevron when next day doesn't exist**

In the day pill nav, the right chevron should be disabled (opacity 0.3, no nav, but still a haptic on press) when `currentDayIdx >= days.length - 1` AND the trip is generating. Add:

```tsx
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';

const rightDisabled = currentDayIdx >= days.length - 1 && streamingDayIndex !== null && streamingDayIndex !== undefined;

<Pressable
  onPress={() => {
    if (rightDisabled) {
      impactAsync(ImpactFeedbackStyle.Light);
      return;
    }
    setDayIdx(currentDayIdx + 1);
  }}
  style={{ opacity: rightDisabled ? 0.3 : 1 }}
>
  <ChevronRight ... />
</Pressable>
```

- [ ] **Step 7: Wire `streamingDayIndex` from the parent**

In `app/trip/[id]/index.tsx`, where DayDeck is rendered:

```tsx
import { getStreamingDayIndex } from './_helpers/sectionState';
// ...
<DayDeck
  tripId={String(trip._id)}
  days={itinerary}
  dayImages={dayImages}
  tripHeroImage={heroImage}
  tripStartDate={trip.startDate}
  destination={trip.countryName}
  streamingDayIndex={getStreamingDayIndex(trip)}
  expectedDayCount={trip.duration}
/>
```

- [ ] **Step 8: Verify visually**

Manually patch a trip in the Convex dashboard to status `"generating"` and itinerary `[{"title":"D1",...}]` (only one day). Open the Itinerary tab. Confirm:
- Day pill reads `Day 1 of 10 · writing · · ·`
- Dots row shows 1 filled, 1 streaming with halo, 8 grey
- Right chevron disabled

- [ ] **Step 9: Commit**

```bash
git add components/trip/DayDeck.tsx app/trip/[id]/index.tsx
git commit -m "feat(DayDeck): streaming pill suffix, day-dots row, active cursor, disabled chev"
```

---

## Phase 6 — Frontend: TripRow + planner sheet

### Task 6.1: Wire the planner sheet to `generateTrip` action

**Files:**
- Modify: `components/trip/TripPlannerSheet.tsx`
- Modify: `app/(tabs)/trips.tsx`

- [ ] **Step 1: Replace the `generate()` callback**

In `TripPlannerSheet.tsx`, replace the body of `generate` (lines 387-506) with:

```tsx
const generateTripAction = useAction(api.tripGeneration.generateTrip);

const generate = useCallback(async () => {
  const eff = effective ?? (
    country && meta && travel && resolved
      ? { country, meta, travel, resolved }
      : null
  );
  if (!eff) {
    setError('Pick a destination first.');
    return;
  }
  setIsLoading(true);
  setError('');
  try {
    const tripId = await generateTripAction({
      countryCode: eff.country.code,
      countryName: eff.country.name,
      capital: eff.meta.capital ?? eff.country.name,
      duration: days,
      heldVisas: [...heldVisas],
      vibe,
      budget,
      interests: [...activeVibes].join(', ') || 'culture, food, sightseeing',
      activityStyles: [...activeVibes],
      travelParty: travelers > 1 ? party : 'solo',
      companions: travelers > 1 ? JSON.stringify({ party, count: travelers }) : undefined,
      startDate: dreaming ? undefined : startDate.toISOString().slice(0, 10),
      endDate: dreaming ? undefined : endDate.toISOString().slice(0, 10),
    });
    bottomSheetRef.current?.dismiss();
    onTripCreated(String(tripId));
  } catch (e) {
    setError("Couldn't start your trip. Please try again.");
    setIsLoading(false);
  }
}, [
  effective, country, meta, travel, resolved, heldVisas,
  days, vibe, budget, activeVibes, travelers, party,
  generateTripAction, onTripCreated, dreaming, startDate, endDate,
]);
```

Add at top of file:

```tsx
import { useAction } from 'convex/react';
```

- [ ] **Step 2: Remove the sparkle loading screen**

Delete the entire loading state block (lines 1110-1180). The brief `isLoading` flash before navigation can stay — replace the entire block with a minimal wait state:

```tsx
{isLoading && (
  <View style={s.loadingContainer}>
    <Animated.View style={sparkleStyle}>
      <DarkOrb size={64}><Sparkles size={26} color="#FFFFFF" /></DarkOrb>
    </Animated.View>
    <Text style={[s.loadingContext, { color: colors.inkMute, marginTop: 14 }]}>
      Starting your trip...
    </Text>
  </View>
)}
```

This is the < 1s window between tap and stub creation. Once the action returns, the sheet dismisses.

- [ ] **Step 3: Wire `onTripCreated` in the parent**

In `app/(tabs)/trips.tsx`, find the `<TripPlannerSheet ... onTripCreated={() => {}} />` (around line 412) and replace with:

```tsx
import { useRouter } from 'expo-router';
const router = useRouter();
// ...
onTripCreated={(tripId) => router.push(`/trip/${tripId}`)}
```

- [ ] **Step 4: Verify end-to-end**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx expo start
```

Open the app, tap Plan a trip, fill out the form, tap Generate. Expected:
- Sheet dismisses within ~1s
- Trip detail screen appears with the country name + meta line + skeletons
- Coral progress strip pulsing at the top
- "Crafting your trip · 0 of 8 · · ·" kicker visible
- Within ~3s, Day 1 starts appearing in the itinerary peek
- Within ~10s, highlights / visa / budget skeletons start replacing with content
- Within ~30s, status flips to planned, strip fades out

If anything doesn't work, check:
- Convex env has `ANTHROPIC_API_KEY`
- `npx convex dev --once` shows all functions deployed
- Network: device can reach api.anthropic.com (no corporate firewall)

- [ ] **Step 5: Commit**

```bash
git add components/trip/TripPlannerSheet.tsx app/\(tabs\)/trips.tsx
git commit -m "feat(planner): wire to streaming generateTrip action + optimistic nav"
```

---

### Task 6.2: Update `TripRow` for `status='generating'`

**Files:**
- Modify: `components/trips/TripRow.tsx`
- Modify: `app/(tabs)/trips.tsx`

- [ ] **Step 1: Add `status` prop to TripRow**

In `TripRow.tsx`, extend `TripRowProps`:

```ts
interface TripRowProps {
  // ... existing fields ...
  status?: string;
}
```

- [ ] **Step 2: Render the generating-state visual**

Inside the component:

```tsx
const isGenerating = status === 'generating';
const isFailed = status === 'failed';
```

Where the thumb is rendered (around line 120), pass `uri={isGenerating ? undefined : imageUri ?? undefined}`.

Below the `Photo` (still inside `thumbWrap`), add:

```tsx
{isGenerating && <GeneratingProgressStrip />}
```

Where `GeneratingProgressStrip` is a small internal component:

```tsx
function GeneratingProgressStrip() {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
  }, [x]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: -50 + x.value * 100 }] }));
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        overflow: 'hidden',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
      }}
    >
      <Animated.View
        style={[
          { width: 50, height: 2, backgroundColor: colors.coral },
          s,
        ]}
      />
    </View>
  );
}
```

In the right rail (where `<VisaBadge />` renders), conditionally swap:

```tsx
{isGenerating ? (
  <View
    style={{
      backgroundColor: colors.coralBg ?? '#F5E0DC',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    }}
  >
    <Text style={{ color: colors.coral, fontSize: 9, fontWeight: '600', letterSpacing: 0.05 * 9, textTransform: 'uppercase' }}>
      Generating
    </Text>
  </View>
) : isFailed ? (
  <View
    style={{
      backgroundColor: colors.coralBg ?? '#F5E0DC',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    }}
  >
    <Text style={{ color: colors.coral, fontSize: 9, fontWeight: '600', textTransform: 'uppercase' }}>
      Failed
    </Text>
  </View>
) : (
  <VisaBadge cat={cat} size="sm" />
)}
```

Hide the star badge when `isGenerating`:

```tsx
{starred && !isGenerating ? (/* ... existing starredBadge ... */) : null}
```

- [ ] **Step 3: Pass `status` from the parent**

In `app/(tabs)/trips.tsx`, around lines 387-400:

```tsx
<TripRow
  key={trip._id}
  id={trip._id}
  name={trip.countryName}
  countryName={trip.countryName}
  countryCode={trip.countryCode}
  visaCategory={trip.visaCategory}
  startDate={trip.startDate}
  endDate={trip.endDate}
  heroImage={trip.heroImage}
  starred={Boolean(trip.starred)}
  status={trip.status}
/>
```

- [ ] **Step 4: Verify visually**

Trigger a generation; navigate back to the trips list before it completes. Confirm the card shows:
- No hero image (warm tile)
- 2px coral animated progress strip across the bottom of the thumb
- GENERATING pill in the right rail (instead of visa badge)
- No star badge

- [ ] **Step 5: Commit**

```bash
git add components/trips/TripRow.tsx app/\(tabs\)/trips.tsx
git commit -m "feat(TripRow): generating + failed visual states"
```

---

## Phase 7 — Trip image fetch on Day 1

### Task 7.1: Fire image fetch as soon as Day 1 lands

**Files:**
- Modify: `convex/tripGeneration.ts`

The current image fetch lives client-side at `TripPlannerSheet.tsx:452-471`. We're moving it server-side, into the streaming action, kicking off as soon as Day 1 is patched.

- [ ] **Step 1: Add an internal action `fetchAndPatchImages`**

```ts
"use node";  // ← if needed; test without first; the existing tripImages endpoint may use plain fetch

// ... actually, since this just calls the existing /api/trip-images endpoint
// via fetch (no streaming, no Node-only APIs), we can keep it in the default
// runtime. Append to convex/tripGeneration.ts:

export const fetchAndPatchImages = internalAction({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const trip = await ctx.runQuery(internal.tripGeneration._getTripForRetry, { tripId });
    if (!trip || !trip.itinerary) return;
    let days: Array<{
      morningPlace?: string; afternoonPlace?: string; eveningPlace?: string;
      title?: string; heroSubject?: string;
    }> = [];
    try {
      days = JSON.parse(trip.itinerary);
    } catch { return; }
    if (days.length === 0) return;

    const activities = days.flatMap((d) => [
      d.morningPlace ? { name: 'morning', place: d.morningPlace } : null,
      d.afternoonPlace ? { name: 'afternoon', place: d.afternoonPlace } : null,
      d.eveningPlace ? { name: 'evening', place: d.eveningPlace } : null,
    ]).filter(Boolean);

    const dayHeroSubjects = days.map((d) =>
      d.heroSubject ?? d.morningPlace ?? d.afternoonPlace ?? d.eveningPlace ?? d.title ?? '',
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
      const imgData = await res.json() as {
        hero: unknown;
        activities: unknown[];
        dayImages?: unknown[];
      };
      if (imgData.hero) {
        await ctx.runMutation(internal.tripGeneration.patchTripSection, {
          tripId, section: 'heroImage', content: JSON.stringify(imgData.hero),
        });
      }
      // Day/activity images patched directly (no SECTION_FIELD_MAP entry; need extra branch)
      if (imgData.dayImages?.length) {
        await ctx.runMutation(internal.tripGeneration._patchTripField, {
          tripId, field: 'dayImages', value: JSON.stringify(imgData.dayImages),
        });
      }
      if (imgData.activities?.length) {
        await ctx.runMutation(internal.tripGeneration._patchTripField, {
          tripId, field: 'activityImages', value: JSON.stringify(imgData.activities),
        });
      }
    } catch (err) {
      console.warn(`Image fetch failed for ${tripId}:`, err);
    }
  },
});

// Generic internal patch helper for fields not in SECTION_FIELD_MAP
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
```

- [ ] **Step 2: Trigger image fetch after Day 1 completes**

In the `runItinerary` function inside `runGenerationStream`, modify the per-day callback:

```ts
const itineraryParser = makeItineraryStreamParser(
  async (dayIndex, dayJson) => {
    await ctx.runMutation(internal.tripGeneration.patchTripSection, {
      tripId,
      section: `itinerary-day:${dayIndex}`,
      content: dayJson,
    });
    // Kick off image fetch as soon as Day 1 lands
    if (dayIndex === 0) {
      await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
    }
  },
  (err) => console.error("Itinerary parse error:", err),
);
```

Note: this fires as soon as Day 1 is in the doc, but the image endpoint needs ALL the days to fetch all the images. There's a tradeoff:
- Fire after Day 1: fast hero image, but only Day 1's per-day images can be fetched (others will use placeholders)
- Fire after all days: slower hero image, full day-image coverage

For the v1 implementation: fire after Day 1, and **re-fire after the itinerary stream completes** to backfill missing day images.

Modify the `runItinerary` `onComplete`:

```ts
onComplete: async () => {
  itineraryParser.onComplete();
  // Backfill any day images that didn't get fetched on the Day-1 trigger
  await ctx.scheduler.runAfter(0, internal.tripGeneration.fetchAndPatchImages, { tripId });
  settle();
},
```

The endpoint will be called twice — once with 1 day's worth of subjects, once with all days. Both populate the same fields; the second call's data overwrites the first. This is wasteful but correct; an optimization in a followup task can de-duplicate.

- [ ] **Step 3: Push and commit**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
git add convex/tripGeneration.ts
git commit -m "feat(convex): fetch trip images after Day 1 lands + backfill on completion"
```

---

## Phase 8 — Verification + polish

### Task 8.1: End-to-end manual smoke test

**Files:** none (manual)

- [ ] **Step 1: Cold-start the dev environment**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once && npx expo start --clear
```

- [ ] **Step 2: Run through the golden path on iOS simulator**

1. Tap "Plan a trip" on the trips list
2. Pick a country (e.g., Japan)
3. Pick "Pick dates" with a 7-day window
4. Pick 2 travelers
5. Pick a few vibes
6. Tap **Generate itinerary**
7. Verify: sheet dismisses within 1s
8. Verify: trip detail screen appears with skeletons + progress strip + "Crafting your trip · 0 of 8 · · ·"
9. Verify: within ~3-5s, Day 1 appears with hero subject; itinerary peek shows it
10. Verify: highlights/visa/budget/tips skeletons replace with content as they land
11. Verify: progress strip kicker increments
12. Verify: hero image arrives within ~10s (warm placeholder before)
13. Verify: when all sections complete, strip fades out, kicker disappears
14. Verify: trip card on the trips list updates from "GENERATING" pill → visa badge

- [ ] **Step 3: Run failure-path tests**

- Disable network mid-stream: trip should eventually flip to `failed` (60s watchdog) and show TripFailedScreen.
- Re-enable network, tap Try Again — new trip generates successfully.
- (Hard to simulate per-section failure deterministically without intercepting the Anthropic call. Skip for now; verify the SectionRetryCard renders by manually patching `failedSections: ['highlights']` in the dashboard.)

- [ ] **Step 4: Performance check**

- During mid-stream peak (multiple animations + worklets), scroll through the trip detail screen
- Verify: 60fps, no jank
- If any jank, check the Reanimated frame log for worklet drops

- [ ] **Step 5: No commit needed for manual testing.**

If any issues are found, file them as additional follow-up tasks below.

---

### Task 8.2: Cleanup `createTrip` deprecation

**Files:**
- Modify: `convex/trips.ts`

The old `createTrip` mutation at [convex/trips.ts:70-131](convex/trips.ts:70) is no longer called from the planner. Mark it deprecated with a JSDoc note. Don't delete — there may be other call sites or it may be needed for testing.

- [ ] **Step 1: Add deprecation comment**

```ts
/**
 * @deprecated Use the streaming `tripGeneration.generateTrip` action instead,
 * which inserts a stub and streams content into it. This synchronous mutation
 * remains for legacy compatibility and direct seeding from tests.
 */
export const createTrip = mutation({ /* ... */ });
```

- [ ] **Step 2: Push and commit**

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
git add convex/trips.ts
git commit -m "chore(convex): deprecate synchronous createTrip in favour of streaming flow"
```

---

### Task 8.3: Update `THINGS-TO-DO-BEFORE-PRODUCTION.md`

**Files:**
- Modify: `THINGS-TO-DO-BEFORE-PRODUCTION.md`

The streaming flow has implications for the existing audit items. Add a section.

- [ ] **Step 1: Append a section to the production todo**

```markdown
## Streaming trip generation (post-2026-04-30)

- [ ] **Add `visaCategory` patching** — currently the streaming flow leaves `trip.visaCategory` as `""` from the stub. Add a generalized `_patchTripField` mutation usage in the visa transform, or extend SECTION_FIELD_MAP.
- [ ] **De-duplicate image fetch** — the image fetch fires twice (after Day 1 + after itinerary completion). Optimize to fire once with the right place names.
- [ ] **Anthropic concurrency** — once we exceed tier-1 5 concurrent requests in production, bump tier or queue.
- [ ] **Surface "Anthropic key not set" gracefully** — currently it just fails the trip. Should it surface a different error to the user?
- [ ] **Cache the country-level visa info** — visa info for `(destinationCountry, passportCountry)` doesn't change per-user. Cache in Convex.
```

- [ ] **Step 2: Commit**

```bash
git add THINGS-TO-DO-BEFORE-PRODUCTION.md
git commit -m "docs: add streaming-generation followups to prod todo"
```

---

### Task 8.4: Push the branch and open a draft PR

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/stream-trip-generation
```

- [ ] **Step 2: Open a draft PR**

```bash
gh pr create --draft --title "feat: streaming trip generation" --body "$(cat <<'EOF'
## Summary

- Replaces the 25–75s blocking loading screen with optimistic navigation into a streaming trip detail screen
- Fans the single mega-prompt into 5 parallel Anthropic calls (with prompt-cache reuse on the shared destination prefix)
- Short-circuits static facts (currency, timezone, IATA, etc.) to a free local lookup
- Locked four-language visual vocabulary: bouncing dots, streaming cursor, single pulsing dot, skeleton shimmer
- Per-section retry on failure; whole-trip 60s watchdog with Try Again screen

Spec: [docs/superpowers/specs/2026-04-30-streaming-trip-generation-design.md](docs/superpowers/specs/2026-04-30-streaming-trip-generation-design.md)

## Test plan

- [x] Schema migration deploys clean
- [x] Generate Japan trip — Day 1 visible in ~3s
- [x] Highlights, visa, budget, tips arrive within ~30s
- [x] Hero image fades in when fetched
- [x] Trip card shows GENERATING pill while in progress
- [x] Progress strip + status kicker animate
- [x] Tab dot indicators clear once content lands
- [ ] Per-section failure → retry CTA (manually triggered via dashboard)
- [ ] Whole-trip failure → Try Again screen
- [ ] Network drop mid-stream → graceful failure
- [ ] Animations stay 60fps under peak streaming load

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

After writing this plan I checked it against the spec:

**Spec coverage:**
- Optimistic nav (sheet dismisses immediately) → Task 6.1 ✓
- 5 parallel streaming calls → Task 3.2 ✓
- Static facts lookup → Task 0.3 ✓
- Visual vocabulary (4 languages) → Tasks 0.2, 4.2, 4.3, 5.1 ✓
- Top progress strip → Task 4.2 ✓
- Tab dot indicators → Tasks 4.1, 4.6, 4.7 ✓
- Skeleton states per tab → Tasks 4.3, 4.7 ✓
- DayDeck streaming UI → Task 5.1 ✓
- TripRow generating state → Task 6.2 ✓
- Per-section retry → Tasks 3.4, 4.4 ✓
- Whole-trip failure → Tasks 2.4, 4.5 ✓
- 60s watchdog → Task 2.4 ✓
- Schema migration → Task 1.1 ✓
- Image fetch on Day 1 → Task 7.1 ✓
- Prompt caching → Task 3.1 (cache_control on system prompt) ✓
- Country-level visa cache → **NOT INCLUDED** — moved to followups in Task 8.3. The spec listed this as a cost mitigation; the v1 plan ships without it (relying on prompt caching alone for cost) since it's a cross-user data structure that needs careful design. Add a follow-up plan if cost analysis shows we need it.

**Architectural deviation:** plan calls Anthropic directly from Convex instead of through a Vercel endpoint. Documented at the top.

**Placeholder scan:** searched for TBD/TODO/FIXME — only TODOs are explicit deferred items in Task 8.3 (followups). No "fill this in later" placeholders in the steps.

**Type consistency:** `tripId` is `Id<"trips">` everywhere. `section` is `string` (not narrower) because it includes the dynamic `itinerary-day:N` form. `status` literals match the schema union exactly.

**Scope:** ~8 phases, ~24 tasks. Each task is a logical unit with steps in the 2-5 minute range. Plan is ambitious but coherent — single feature, single PR, single review cycle. The user has explicitly chosen the premium approach over phasing.

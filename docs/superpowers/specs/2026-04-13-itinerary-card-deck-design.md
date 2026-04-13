# Itinerary Card Deck — Design Spec

**Date:** 2026-04-13
**Status:** Approved for implementation planning
**Scope:** Redesign the Itinerary tab on the trip detail screen

## Problem

The current Itinerary tab renders a plain vertical list of days, each a `DayHeader` + three `ActivityCard` rows. It's hard to scan, it doesn't feel premium, and it buries the emotional payoff of the trip (the destination itself). The user wants a card-based browsing experience with large imagery per day that feels like an award-winning travel app, not an MVP prototype.

## Goal

Turn the Itinerary tab into a **stacked card deck** where each day is a physical-feeling card with a massive hero image of the most iconic thing happening that day. Swipe through the days, tap to open a full-bleed day detail page.

## Out of scope

- Reordering days
- Inline editing of day content (already handled elsewhere)
- Fullscreen image lightbox
- Changes to the Overview or Logistics tabs
- Backfilling `heroSubject` on existing trips (future enhancement)

## User experience

### The deck

The Itinerary tab shows a stacked card deck. The **active (front) card** is a large portrait-oriented card with:

- Hero image (full-bleed, covering the entire card)
- Day badge top-left: `DAY 1` (white pill, dark text)
- Date pill top-right: `MON · OCT 21` (translucent dark, white text)
- Bottom gradient overlay for text legibility
- Day title (large, bold, e.g. "Arrival in Positano")
- Place with pin icon (small, e.g. "◉ Positano, Italy")

**Two cards peek behind the front card**, fanned to the right with a slight rotation (~3° and ~6°), scaled down slightly (0.94 and 0.88), brightness reduced, so the affordance to swipe is immediately obvious.

Above the deck: a small label `YOUR TRIP · 1 / 7`. Below the deck: a dot indicator row. The active day is a wider pill; others are small dots. Dots are display-only (tap area would conflict with the deck gesture).

### Swiping

- Horizontal pan on the front card tracks the finger
- While dragging: front card tilts `-8°` to `+8°` via `translationX` interpolation; the card directly behind it scales up slightly toward the front position (anticipation)
- On release:
  - If `|translationX| > screenWidth * 0.28` OR velocity > threshold → commit. Front card springs off-screen, array reorders, new front card springs in from the fan position, haptic `selectionAsync()` tick fires.
  - Otherwise → spring back to center.
- **Wrap-around is infinite in both directions.** Swiping past day 7 loops to day 1; swiping left from day 1 goes to day 7. No dead ends.

### Tapping a card

Tapping the front card opens the **day detail screen** via an Expo Router push. A shared-element transition animates the tapped card's hero image to its new position on the detail page. If shared transitions misbehave on Android, fall back to `animation: 'fade_from_bottom'`.

### Day detail screen

A new route at `/trip/[id]/day/[idx]`. Layout:

- **Full-bleed hero image** at the top (~340pt tall) with a subtle dark-to-transparent gradient and a fade-to-background at the bottom
- Back button top-left (white circular pill with blurred background) — uses existing `BackButton` component
- Share button top-right (same treatment)
- Over the hero image: day pill (`DAY 1 · MON OCT 21`), large title, place with pin icon
- Below the hero: a `YOUR DAY` label, then three rows of morning / afternoon / evening activities rendered using the existing `ActivityCard` component
- If present, the day's `tip` renders below as a soft-yellow callout
- **Horizontal pan on the entire detail screen** navigates to the prev/next day with the same wrap-around (so the user isn't forced back to the deck to browse)
- Vertical scroll works normally for long content

### Edge cases

- **1-day trip:** single card, no cards peeking behind, dots hidden, swipe disabled
- **Image load failure:** tinted placeholder card showing the day number large + title. No broken image icons.
- **Old trip missing `heroSubject`:** client lazily falls back to a query built from `${day.title} ${trip.destination}`.
- **Unsplash proxy down during trip generation:** trip still saves with empty `dayImages`. Client renders tinted placeholder cards and shows a "Loading images…" toast. Background retry on next app open.
- **0-day itinerary (defensive):** render the existing "No itinerary yet" empty state, no deck.

## Technical design

### Component tree

```
app/trip/[id].tsx
 └── <SegmentedControl />
     └── Itinerary tab
         └── <DayDeck days={itinerary} dayImages={...} />
             ├── <DayDeckCard /> x 3 (front + 2 peek)
             └── <DayDeckDots count={n} active={idx} />

app/trip/[id]/day/[idx].tsx (NEW route)
 └── <DayDetailScreen day={...} image={...} />
     ├── full-bleed hero with nav buttons
     ├── overlay text block
     ├── <ActivityCard /> x 3 (morning/afternoon/evening, existing component)
     └── <TipCallout /> (inline, only if day.tip)
```

### New files

- `components/trip/DayDeck.tsx` — gesture handler + layered card renderer + wrap-around logic
- `components/trip/DayDeckCard.tsx` — pure display card (hero image, badges, text overlay)
- `components/trip/DayDeckDots.tsx` — dot indicator row
- `app/trip/[id]/day/[idx].tsx` — day detail route
- `components/trip/DayDetailScreen.tsx` — day detail layout (used by the route above)

### Modified files

- `app/trip/[id].tsx` — swap the Itinerary tab's content from the old vertical list to `<DayDeck />`
- `convex/trips.ts` (or the action file that runs trip generation) — update the LLM prompt to emit `heroSubject` per day; update the Unsplash query to `${heroSubject} ${trip.destination}`
- The `ItineraryDay` TypeScript type definition — add `heroSubject: string`

### Deleted / deprecated

- The old `ItineraryContent` vertical renderer inside `app/trip/[id].tsx`
- `components/trip/DayHeader.tsx` — remove if no other screen imports it

### Data model

```ts
type ItineraryDay = {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject: string;  // NEW
};
```

`heroSubject` lives on the day object inside the existing `trips.itinerary` JSON string. No schema migration: the Convex schema still types `itinerary` as `v.string()`, and only the shape parsed on read/write changes. New trips produce it; old trips fall back lazily on the client.

### LLM prompt contract

The trip-generation prompt gains one field in its per-day output schema:

> `heroSubject` (string, required): The single most iconic, photographable subject for this day. Be specific: not "Positano" but "Positano cliff houses from Via Positanesi"; not "Tokyo" but "Shibuya crossing at night". One focused phrase, 3–7 words.

### Image fetch flow

```
generateTrip action (existing):
  1. LLM generates itinerary including heroSubject per day
  2. For each day:
       query = `${day.heroSubject} ${trip.destination}`
       image = fetch(API.unsplash, { query })
       if zero results: query = trip.destination; retry
       if still zero: image = trip.heroImage
       dayImages[i] = image
  3. (Existing) fetch activityImages for morning/afternoon/evening
  4. Persist dayImages + itinerary to trip doc
```

The existing Unsplash proxy at `constants/api.ts` (`/api/unsplash`) is unchanged. Only the query string we send it changes.

### Animation engine

`react-native-reanimated` v3 + `react-native-gesture-handler`, both already in the project. All transforms run on the UI thread via worklets. No new dependencies.

### Navigation

Expo Router with a real route at `/trip/[id]/day/[idx]`. This gives us:
- Native back-gesture support
- Deep linking (users can share a specific day)
- Stack animation primitives (shared element / fade-from-bottom)
- Refresh survival

## Testing plan

- **Manual device test**: generate a 7-day Amalfi Coast trip, swipe through the deck, verify smoothness, wrap-around, haptics, tap-to-open, back gesture, and day-detail-level swipe. Also test a 1-day trip and an offline trip.
- **Type safety**: `bun run typecheck` (or project equivalent) passes with no `any`.
- **Convex security**: no new public functions; if any added, must call `requireAuth` and verify ownership per project CLAUDE.md rules.
- **No gesture unit tests** — reanimated worklets are low-value to unit-test. Verify the data flow (heroSubject → query → image → render → fallback chain) by manual inspection of a generated trip's `dayImages`.

## Styling conventions

- All colors come from `useTheme().colors` — no hardcoded hex/rgba except `#FFFFFF` for white text on the hero
- Date pill and badge use existing theme tokens where they exist; if not, add them to `LightColors` / `DarkColors` in `constants/theme.ts`
- Follow existing bottom sheet and card radii patterns (22–24pt radii)

## Open questions resolved during brainstorming

- **Deck vs carousel vs vertical scroll:** stacked fanned deck (V1)
- **Back cards visibility:** must clearly peek, fanned right with rotation
- **Wrap-around:** yes, infinite both directions
- **Day detail layout:** full-bleed hero (V1)
- **Image provider:** Unsplash only (free, no paid tier needed at any scale, premium aesthetic). Google Places Photos considered but rejected due to 30-day cache limit, ongoing cost, and marginal quality gain for a trip-planning (not booking) app.
- **How images get relevant:** LLM emits `heroSubject` per day used as the Unsplash query prefix
- **Fallback chain:** heroSubject → destination → trip.heroImage → tinted placeholder
- **Day navigation from within detail page:** swipe horizontally, same wrap-around

# Itinerary Card Deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Itinerary tab's vertical day list with a premium swipeable stacked card deck, where each day is a large card with an iconic hero image of the place, and tapping a card opens a full-bleed day detail page.

**Architecture:** Backend LLM emits a new `heroSubject` field per day, `/api/trip-images` is extended to fetch per-day hero images via Pexels, the mobile client persists `dayImages` on the trip, and the Itinerary tab renders a new `DayDeck` component built on `react-native-reanimated` + `react-native-gesture-handler` with a fanned 3-card stack, wrap-around swipe, haptics, and an Expo Router child route for the day detail screen.

**Tech Stack:** React Native, Expo Router, react-native-reanimated v4, react-native-gesture-handler, expo-haptics, expo-linear-gradient, Convex, Next.js (web backend).

**Spec:** `docs/superpowers/specs/2026-04-13-itinerary-card-deck-design.md`

**Two repos:**
- **Web backend:** `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas` (Next.js, source of trip generation + image fetching)
- **Mobile app:** `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile` (this repo)

**Testing note:** The mobile repo has no in-repo test harness (zero `*.test.ts(x)` files, no `test` script). Verification is **TypeScript typecheck + manual device verification** — the same pattern used in previous plans in this repo (see `docs/superpowers/plans/2026-04-05-trip-page-redesign.md`). Do not introduce a test framework as part of this feature.

**Gradients:** The user dislikes gradient *backgrounds* but dark-to-transparent photo scrims on hero images (for text legibility) are a standard premium pattern (Airbnb, Apple Photos) and are used here intentionally on the day cards and day detail hero.

---

## File structure

**Web repo (`visa-atlas`):**
- Modify: `src/app/api/generate-trip/route.ts` — add `heroSubject` to per-day prompt schema
- Modify: `src/app/api/trip-images/route.ts` — accept `dayHeroSubjects`, return `dayImages`

**Mobile repo (`visa-atlas-mobile`):**
- Create: `components/trip/DayDeckCard.tsx` — pure-display card (image + badges + overlay + title)
- Create: `components/trip/DayDeckDots.tsx` — dot indicator row
- Create: `components/trip/DayDeck.tsx` — gesture handler, layered render, wrap-around, haptics
- Create: `components/trip/DayDetailScreen.tsx` — full-bleed hero day detail layout
- Create: `app/trip/[id]/day/[idx].tsx` — Expo Router child route for day detail
- Modify (rename + edit): `app/trip/[id].tsx` → `app/trip/[id]/index.tsx` (must become a directory so child routes can exist)
- Modify: `components/trip/TripPlannerSheet.tsx` — send `dayHeroSubjects` in trip-images request, persist `dayImages` on createTrip
- Delete: `components/trip/DayHeader.tsx` (no other importer)

---

### Task 1: Add `heroSubject` to the trip generation prompt (web repo)

**Repo:** `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas`

**Files:**
- Modify: `src/app/api/generate-trip/route.ts:100-112`

**Context:** The LLM prompt currently asks for a per-day JSON object with `day, title, morning, morningPlace, afternoon, afternoonPlace, evening, eveningPlace, tip, imageSearch, activitySearch`. We add one more field: `heroSubject` — the single most iconic, photographable subject for that day. This drives a dramatically better Pexels/Unsplash query.

- [ ] **Step 1: Update the prompt JSON structure**

Open `src/app/api/generate-trip/route.ts`. Find the per-day JSON example around line 100-112. Add `heroSubject` **after** `tip` and **before** `imageSearch`.

Change from:

```
  "tip": "Local insider tip for this day",
  "imageSearch": "Best Google Images search term ...",
```

To:

```
  "tip": "Local insider tip for this day",
  "heroSubject": "The single most iconic, photographable subject for this day — a specific landmark or view, not a city name. E.g. 'Positano cliff houses from Via Positanesi', not 'Positano'. 'Shibuya crossing at night', not 'Tokyo'. One focused phrase, 3-7 words.",
  "imageSearch": "Best Google Images search term ...",
```

- [ ] **Step 2: Commit**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas
git add src/app/api/generate-trip/route.ts
git commit -m "feat: add heroSubject to per-day trip generation prompt"
```

---

### Task 2: Extend `/api/trip-images` to fetch per-day hero images (web repo)

**Repo:** `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas`

**Files:**
- Modify: `src/app/api/trip-images/route.ts`

**Context:** The endpoint currently accepts `{ countryName, capital, activities }` and returns `{ hero, activities }`. We extend it to also accept an optional `dayHeroSubjects: string[]` (one per day) and return an additional `dayImages: Array<{url, thumb, credit, creditUrl} | null>`. Each day image is fetched via Pexels using the query `"${heroSubject} ${capital}"`, with fallback to `"${capital} ${countryName}"` on empty results.

- [ ] **Step 1: Add dayHeroSubjects to the request type**

Find the request body parsing block (around the existing `const { countryName, capital, activities }` destructure). Change to:

```ts
const { countryName, capital, activities, dayHeroSubjects } = (await req.json()) as {
  countryName: string;
  capital: string;
  activities: Array<{ name: string; place: string }>;
  dayHeroSubjects?: string[];
};
```

- [ ] **Step 2: Add a helper that fetches a single day hero image**

Right below the existing `fetchPexelsHero` (or equivalent — the function that fetches the trip-wide hero) add:

```ts
async function fetchDayHero(
  subject: string,
  fallbackQuery: string,
): Promise<{ url: string; thumb: string; credit: string; creditUrl: string } | null> {
  const tryQuery = async (q: string) => {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=3&orientation=portrait`,
      { headers: { Authorization: process.env.PEXELS_API_KEY ?? "" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: Array<{
        src: { large2x: string; medium: string };
        photographer: string;
        photographer_url: string;
      }>;
    };
    const photo = data.photos?.[0];
    if (!photo) return null;
    return {
      url: photo.src.large2x,
      thumb: photo.src.medium,
      credit: photo.photographer,
      creditUrl: photo.photographer_url,
    };
  };

  const primary = await tryQuery(subject);
  if (primary) return primary;
  return tryQuery(fallbackQuery);
}
```

- [ ] **Step 3: Fetch dayImages in parallel with the existing hero+activities**

In the main handler, alongside the existing `Promise.all` calls, add:

```ts
const dayImages = dayHeroSubjects && dayHeroSubjects.length > 0
  ? await Promise.all(
      dayHeroSubjects.map((subject) =>
        fetchDayHero(
          `${subject} ${capital}`,
          `${capital} ${countryName}`,
        ),
      ),
    )
  : [];
```

- [ ] **Step 4: Include dayImages in the response**

Find the final `return NextResponse.json({ hero, activities: activityResults })` (or equivalent). Change to:

```ts
return NextResponse.json({ hero, activities: activityResults, dayImages });
```

- [ ] **Step 5: Commit**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas
git add src/app/api/trip-images/route.ts
git commit -m "feat: extend /api/trip-images with dayHeroSubjects and dayImages"
```

---

### Task 3: Add `heroSubject` to mobile `ItineraryDay` type and persist `dayImages` on trip creation

**Repo:** `/Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile`

**Files:**
- Modify: `app/trip/[id].tsx:78-88` (ItineraryDay interface)
- Modify: `components/trip/TripPlannerSheet.tsx:240-302` (trip creation fetch block)

**Context:** `createTrip` in `convex/trips.ts:91` already accepts `dayImages: v.optional(v.string())`, so no Convex change is needed. The client just needs to start sending it. We also add `heroSubject?: string` to the `ItineraryDay` interface so it's optional (old trips continue to work) and extract the list of subjects before calling `/api/trip-images`.

- [ ] **Step 1: Add `heroSubject` to the ItineraryDay interface**

Open `app/trip/[id].tsx`. At lines 78-88, change:

```ts
interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
}
```

To:

```ts
interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject?: string;
}
```

- [ ] **Step 2: Send dayHeroSubjects and persist dayImages in TripPlannerSheet**

Open `components/trip/TripPlannerSheet.tsx`. Replace the block at lines 260-302 (the `// ── Fetch images ──` section through the `createTrip` call) with:

```ts
        // ── Fetch images (hero + per-day + per-activity) ─────────────────────
        let heroImageJson: string | undefined;
        let dayImagesJson: string | undefined;
        let activityImagesJson: string | undefined;
        try {
          type ItineraryDay = {
            morningPlace?: string;
            afternoonPlace?: string;
            eveningPlace?: string;
            title?: string;
            heroSubject?: string;
          };
          const itineraryDays: ItineraryDay[] = data.itinerary
            ? (JSON.parse(data.itinerary) as ItineraryDay[])
            : [];
          const activities = itineraryDays.flatMap((d) => [
            d.morningPlace ? { name: 'morning', place: d.morningPlace } : null,
            d.afternoonPlace ? { name: 'afternoon', place: d.afternoonPlace } : null,
            d.eveningPlace ? { name: 'evening', place: d.eveningPlace } : null,
          ]).filter(Boolean);

          // Build per-day hero subjects with graceful fallback for trips where
          // the LLM didn't emit heroSubject.
          const dayHeroSubjects = itineraryDays.map(
            (d) =>
              d.heroSubject ??
              d.morningPlace ??
              d.afternoonPlace ??
              d.eveningPlace ??
              d.title ??
              '',
          );

          const imgRes = await fetch(endpoints.tripImages, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              countryName: data.countryName,
              capital: data.capital,
              activities,
              dayHeroSubjects,
            }),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json() as {
              hero: unknown;
              activities: unknown[];
              dayImages?: unknown[];
            };
            if (imgData.hero) heroImageJson = JSON.stringify(imgData.hero);
            if (imgData.activities?.length) activityImagesJson = JSON.stringify(imgData.activities);
            if (imgData.dayImages?.length) dayImagesJson = JSON.stringify(imgData.dayImages);
          }
        } catch {
          // Images are non-critical — proceed without them
        }

        const tripId = await createTrip({
          ...data,
          status: 'planned' as const,
          companions: party !== 'solo' ? JSON.stringify({ party }) : undefined,
          heroImage: heroImageJson,
          dayImages: dayImagesJson,
          activityImages: activityImagesJson,
        });
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Expected: no new errors in `TripPlannerSheet.tsx` or `app/trip/[id].tsx`. Pre-existing errors elsewhere are out of scope; note any new ones introduced by this change and fix them.

- [ ] **Step 4: Commit**

```bash
git add app/trip/[id].tsx components/trip/TripPlannerSheet.tsx
git commit -m "feat: send dayHeroSubjects and persist dayImages on trip creation"
```

---

### Task 4: Create `DayDeckCard` component (mobile)

**Files:**
- Create: `components/trip/DayDeckCard.tsx`

**Context:** A pure-display portrait card. Shows: hero image (full-bleed), day pill top-left (white, dark text), date pill top-right (translucent dark, white text), gradient scrim at bottom, large title, place with pin icon. The card has no gesture or tap logic — the parent (`DayDeck`) wraps it. `showContent` controls whether the text overlay renders (back cards don't render text to avoid noise behind the front card).

- [ ] **Step 1: Create the file**

Create `components/trip/DayDeckCard.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;

export interface DayDeckCardProps {
  dayNumber: number;
  title: string;
  place?: string;
  date?: string;
  image: DayImage;
  showContent?: boolean;
}

function DayDeckCard({
  dayNumber,
  title,
  place,
  date,
  image,
  showContent = false,
}: DayDeckCardProps) {
  const { colors } = useTheme();

  const fallbackBg = colors.surfaceLight;

  return (
    <View style={[styles.card, { backgroundColor: fallbackBg }]}>
      {image?.url ? (
        <ImageBackground
          source={{ uri: image.url }}
          style={StyleSheet.absoluteFill}
          imageStyle={styles.image}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.25, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Text style={[styles.placeholderDay, { color: colors.textMuted }]}>
            {`DAY ${dayNumber}`}
          </Text>
        </View>
      )}

      {showContent && (
        <>
          <View style={styles.topRow}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{`DAY ${dayNumber}`}</Text>
            </View>
            {date ? (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{date.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottom}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {place ? (
              <View style={styles.placeRow}>
                <MapPin size={12} color="#FFFFFF" />
                <Text style={styles.placeText} numberOfLines={1}>
                  {place}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

export default React.memo(DayDeckCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl ?? 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  image: {
    borderRadius: Radius.xl ?? 24,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderDay: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 48,
    letterSpacing: 2,
  },
  topRow: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayBadge: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dayBadgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#1A1A1A',
    letterSpacing: 0.6,
  },
  datePill: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  datePillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  bottom: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  placeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    opacity: 0.95,
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Expected: no new errors. If `Radius.xl` does not exist, replace the `?? 24` fallback with a direct `24` (the nullish-coalescing operator handles the missing key without a type error).

- [ ] **Step 3: Commit**

```bash
git add components/trip/DayDeckCard.tsx
git commit -m "feat: add DayDeckCard component for itinerary card deck"
```

---

### Task 5: Create `DayDeckDots` indicator component (mobile)

**Files:**
- Create: `components/trip/DayDeckDots.tsx`

- [ ] **Step 1: Create the file**

Create `components/trip/DayDeckDots.tsx`:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';

interface DayDeckDotsProps {
  count: number;
  activeIndex: number;
}

function DayDeckDots({ count, activeIndex }: DayDeckDotsProps) {
  const { colors } = useTheme();

  if (count <= 1) return null;

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? colors.foreground : colors.border,
                width: isActive ? 18 : 6,
                borderRadius: isActive ? 3 : 3,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default React.memo(DayDeckDots);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    height: 6,
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

If `colors.border` or `colors.foreground` doesn't exist on the theme, read `constants/theme.ts` and substitute the correct color token names (likely `colors.borderMuted` / `colors.text`). Do not introduce hardcoded hex colors.

- [ ] **Step 3: Commit**

```bash
git add components/trip/DayDeckDots.tsx
git commit -m "feat: add DayDeckDots indicator row for itinerary deck"
```

---

### Task 6: Create `DayDeck` gesture + layered card component (mobile)

**Files:**
- Create: `components/trip/DayDeck.tsx`

**Context:** The core component. Renders three absolute-positioned cards (active + 2 peek-behind fanned right with rotation), handles pan gesture with spring physics, haptic tick on day change, wrap-around in both directions, tap-to-open routing to `/trip/[id]/day/[idx]`.

- [ ] **Step 1: Create the file**

Create `components/trip/DayDeck.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import DayDeckCard, { type DayImage } from './DayDeckCard';
import DayDeckDots from './DayDeckDots';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';

export interface DayDeckDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject?: string;
}

interface DayDeckProps {
  tripId: string;
  days: DayDeckDay[];
  dayImages: DayImage[];
  tripStartDate?: number;
  destination?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_HEIGHT = 440;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const VELOCITY_THRESHOLD = 600;

function formatDayDate(startDate: number | undefined, dayOffset: number): string | undefined {
  if (!startDate) return undefined;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function pickPlace(day: DayDeckDay): string | undefined {
  return day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace;
}

function DayDeck({ tripId, days, dayImages, tripStartDate, destination }: DayDeckProps) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const translationX = useSharedValue(0);

  const numDays = days.length;

  const advance = useCallback(
    (dir: 1 | -1) => {
      setActiveIndex((idx) => (idx + dir + numDays) % numDays);
      Haptics.selectionAsync().catch(() => {});
    },
    [numDays],
  );

  const openDay = useCallback(() => {
    router.push(`/trip/${tripId}/day/${activeIndex}`);
  }, [tripId, activeIndex]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      translationX.value = e.translationX;
    })
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if ((past || fast) && numDays > 1) {
        const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
        runOnJS(advance)(dir);
      }
      translationX.value = withSpring(0, { damping: 18, stiffness: 170 });
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(openDay)();
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      {
        rotateZ: `${interpolate(
          translationX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-8, 0, 8],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));

  if (numDays === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No itinerary available</Text>
      </View>
    );
  }

  const idx0 = activeIndex;
  const idx1 = (activeIndex + 1) % numDays;
  const idx2 = (activeIndex + 2) % numDays;

  const showStack = numDays > 1;

  return (
    <View style={styles.container}>
      <View style={styles.counter}>
        <Text style={[styles.counterLabel, { color: colors.textMuted }]}>YOUR TRIP</Text>
        <Text style={[styles.counterValue, { color: colors.foreground }]}>
          {`${activeIndex + 1} / ${numDays}`}
        </Text>
      </View>

      <View style={styles.deckArea}>
        {showStack && (
          <View style={[styles.cardSlot, styles.slot2]} pointerEvents="none">
            <DayDeckCard
              dayNumber={days[idx2].day}
              title={days[idx2].title}
              image={dayImages[idx2] ?? null}
            />
          </View>
        )}
        {showStack && (
          <View style={[styles.cardSlot, styles.slot1]} pointerEvents="none">
            <DayDeckCard
              dayNumber={days[idx1].day}
              title={days[idx1].title}
              image={dayImages[idx1] ?? null}
            />
          </View>
        )}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.cardSlot, styles.slotFront, frontAnimatedStyle]}>
            <DayDeckCard
              dayNumber={days[idx0].day}
              title={days[idx0].title}
              place={pickPlace(days[idx0]) ?? destination}
              date={formatDayDate(tripStartDate, idx0)}
              image={dayImages[idx0] ?? null}
              showContent
            />
          </Animated.View>
        </GestureDetector>
      </View>

      <DayDeckDots count={numDays} activeIndex={activeIndex} />

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        ← swipe to flick through days →
      </Text>
    </View>
  );
}

export default React.memo(DayDeck);

const FRONT_LEFT = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 32,
  },
  counter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.xl,
    marginBottom: 14,
  },
  counterLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
  },
  counterValue: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
  },
  deckArea: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT + 40,
  },
  cardSlot: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  slot2: {
    left: FRONT_LEFT + 52,
    top: 22,
    transform: [{ rotate: '6deg' }, { scale: 0.88 }],
    opacity: 0.85,
  },
  slot1: {
    left: FRONT_LEFT + 26,
    top: 10,
    transform: [{ rotate: '3deg' }, { scale: 0.94 }],
    opacity: 0.95,
  },
  slotFront: {
    left: FRONT_LEFT,
    top: 0,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 12,
    letterSpacing: 0.4,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Expected: no new errors. If `FontFamily`, `FontSize`, `Spacing` don't match the actual exports in `constants/theme.ts`, adjust imports/usages accordingly — do not change the component structure, only the style tokens.

- [ ] **Step 3: Commit**

```bash
git add components/trip/DayDeck.tsx
git commit -m "feat: add DayDeck stacked card component with swipe + haptics"
```

---

### Task 7: Convert `app/trip/[id].tsx` to a directory with `index.tsx`

**Files:**
- Move: `app/trip/[id].tsx` → `app/trip/[id]/index.tsx`

**Context:** Expo Router's file-based routing requires `[id]` to be a directory if we want to add a child route like `[id]/day/[idx].tsx`. This task is purely a file rename — no code changes inside the file. Commit the rename cleanly so later tasks edit a small diff.

- [ ] **Step 1: Use `git mv` to preserve history**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
mkdir -p app/trip/\[id\]
git mv app/trip/\[id\].tsx app/trip/\[id\]/index.tsx
```

- [ ] **Step 2: Run typecheck to confirm the import paths still resolve**

```bash
bunx tsc --noEmit
```

Expected: no new errors. All imports inside the moved file use `@/...` aliases so they resolve the same way. The other tab routes and any sibling files (`app/trip/invite.tsx`) are untouched.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: convert app/trip/[id].tsx to directory for child routes"
```

---

### Task 8: Create `DayDetailScreen` component (mobile)

**Files:**
- Create: `components/trip/DayDetailScreen.tsx`

**Context:** The layout rendered by the `app/trip/[id]/day/[idx].tsx` route. Full-bleed hero image at top (~340pt), dark-to-transparent-to-background gradient scrim, back button top-left and share button top-right, day pill + big title over the hero, then morning/afternoon/evening activity cards below (reuses existing `ActivityCard`), then optional tip callout.

The screen also handles horizontal pan for prev/next day navigation (with wrap-around), so users don't have to bounce back to the deck.

- [ ] **Step 1: Create the file**

Create `components/trip/DayDetailScreen.tsx`:

```tsx
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Share2, MapPin, Lightbulb } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ActivityCard from '@/components/trip/ActivityCard';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

export interface DayDetailDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
}

type DayImage = { url: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = { url: string; thumb: string; credit: string; source: string } | null;

interface DayDetailScreenProps {
  day: DayDetailDay;
  dayIndex: number;
  numDays: number;
  heroImage: DayImage;
  morningImage: ActivityImage;
  afternoonImage: ActivityImage;
  eveningImage: ActivityImage;
  destination?: string;
  tripStartDate?: number;
  onBack: () => void;
  onShare: () => void;
  onNavigateDay: (newIndex: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 340;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;
const VELOCITY_THRESHOLD = 550;

function formatDate(start: number | undefined, offset: number): string | undefined {
  if (!start) return undefined;
  const d = new Date(start);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

function DayDetailScreen({
  day,
  dayIndex,
  numDays,
  heroImage,
  morningImage,
  afternoonImage,
  eveningImage,
  destination,
  tripStartDate,
  onBack,
  onShare,
  onNavigateDay,
}: DayDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const go = useCallback(
    (dir: 1 | -1) => {
      if (numDays <= 1) return;
      const next = (dayIndex + dir + numDays) % numDays;
      Haptics.selectionAsync().catch(() => {});
      onNavigateDay(next);
    },
    [dayIndex, numDays, onNavigateDay],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
      const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (past || fast) {
        const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
        runOnJS(go)(dir);
      }
    });

  const place = day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace ?? destination;
  const dateLabel = formatDate(tripStartDate, dayIndex);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces
        >
          <View style={styles.heroContainer}>
            {heroImage?.url ? (
              <ImageBackground
                source={{ uri: heroImage.url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0.35)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0.4)',
                    colors.background,
                  ]}
                  locations={[0, 0.22, 0.45, 0.75, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </ImageBackground>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceLight }]} />
            )}

            <View style={[styles.topBar, { top: insets.top + 8 }]}>
              <Pressable
                accessibilityLabel="Go back"
                onPress={onBack}
                style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
              >
                <ChevronLeft size={22} color="#1A1A1A" />
              </Pressable>
              <Pressable
                accessibilityLabel="Share day"
                onPress={onShare}
                style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
              >
                <Share2 size={18} color="#1A1A1A" />
              </Pressable>
            </View>

            <View style={styles.heroOverlay}>
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>
                  {dateLabel ? `DAY ${day.day} · ${dateLabel}` : `DAY ${day.day}`}
                </Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {day.title}
              </Text>
              {place ? (
                <View style={styles.heroPlaceRow}>
                  <MapPin size={14} color="#FFFFFF" />
                  <Text style={styles.heroPlaceText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.body}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>YOUR DAY</Text>
            <View style={{ gap: Spacing.sm }}>
              <ActivityCard
                timeSlot="morning"
                description={day.morning}
                placeName={day.morningPlace}
                imageUrl={morningImage?.url}
              />
              <ActivityCard
                timeSlot="afternoon"
                description={day.afternoon}
                placeName={day.afternoonPlace}
                imageUrl={afternoonImage?.url}
              />
              <ActivityCard
                timeSlot="evening"
                description={day.evening}
                placeName={day.eveningPlace}
                imageUrl={eveningImage?.url}
              />
            </View>

            {day.tip ? (
              <View
                style={[
                  styles.tipCard,
                  Shadows.subtle,
                  { backgroundColor: colors.surfaceLight },
                ]}
              >
                <Lightbulb size={14} color={colors.textMuted} />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{day.tip}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </GestureDetector>
  );
}

export default React.memo(DayDetailScreen);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  heroContainer: {
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  heroOverlay: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 28,
  },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  dayPillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#1A1A1A',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  heroPlaceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    opacity: 0.96,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    marginTop: -8,
  },
  sectionLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.lg ?? 16,
    marginTop: Spacing.md,
  },
  tipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Fix any import mismatches (e.g. if `Radius.lg`, `Shadows.subtle`, or color tokens have different names — read `constants/theme.ts` and substitute).

- [ ] **Step 3: Commit**

```bash
git add components/trip/DayDetailScreen.tsx
git commit -m "feat: add DayDetailScreen component with hero and swipe navigation"
```

---

### Task 9: Create the `/trip/[id]/day/[idx]` Expo Router child route

**Files:**
- Create: `app/trip/[id]/day/[idx].tsx`

**Context:** Thin route file that reads `id` and `idx` from params, queries the trip from Convex, parses the itinerary + dayImages + activityImages, and renders `DayDetailScreen`. Navigation between days updates the route param so back-gesture history remains coherent.

- [ ] **Step 1: Create the route directory**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
mkdir -p app/trip/\[id\]/day
```

- [ ] **Step 2: Create the route file**

Create `app/trip/[id]/day/[idx].tsx`:

```tsx
import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import DayDetailScreen, { type DayDetailDay } from '@/components/trip/DayDetailScreen';
import { useTheme } from '@/contexts/theme-context';

type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = { url: string; thumb: string; credit: string; source: string } | null;

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export default function DayDetailRoute() {
  const { id, idx } = useLocalSearchParams<{ id: string; idx: string }>();
  const { colors } = useTheme();

  const tripId = id as Id<'trips'>;
  const dayIndex = Number(idx ?? '0');

  const trip = useQuery(api.trips.getTrip, tripId ? { tripId } : 'skip');

  const itinerary = useMemo<DayDetailDay[]>(
    () => safeParse<DayDetailDay[]>(trip?.itinerary, []),
    [trip?.itinerary],
  );
  const dayImages = useMemo<DayImage[]>(
    () => safeParse<DayImage[]>(trip?.dayImages, []),
    [trip?.dayImages],
  );
  const activityImages = useMemo<ActivityImage[]>(
    () => safeParse<ActivityImage[]>(trip?.activityImages, []),
    [trip?.activityImages],
  );

  const onBack = useCallback(() => {
    router.back();
  }, []);

  const onNavigateDay = useCallback(
    (newIndex: number) => {
      router.setParams({ idx: String(newIndex) });
    },
    [],
  );

  const onShare = useCallback(async () => {
    const day = itinerary[dayIndex];
    if (!day) return;
    await Share.share({
      message: `Day ${day.day}: ${day.title}`,
    }).catch(() => {});
  }, [itinerary, dayIndex]);

  if (!trip || itinerary.length === 0) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  const clampedIndex = Math.max(0, Math.min(dayIndex, itinerary.length - 1));
  const day = itinerary[clampedIndex];

  return (
    <DayDetailScreen
      day={day}
      dayIndex={clampedIndex}
      numDays={itinerary.length}
      heroImage={dayImages[clampedIndex] ?? null}
      morningImage={activityImages[clampedIndex * 3] ?? null}
      afternoonImage={activityImages[clampedIndex * 3 + 1] ?? null}
      eveningImage={activityImages[clampedIndex * 3 + 2] ?? null}
      destination={trip.countryName}
      tripStartDate={trip.startDate as number | undefined}
      onBack={onBack}
      onShare={onShare}
      onNavigateDay={onNavigateDay}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Expected: no new errors. If `api.trips.getTrip` has a different name (e.g. `api.trips.get` or `api.trips.getById`), read `convex/trips.ts` and substitute the correct export. If the trip doc doesn't have `startDate` as a field, drop that prop and the date display will gracefully degrade.

- [ ] **Step 4: Commit**

```bash
git add app/trip/\[id\]/day/\[idx\].tsx
git commit -m "feat: add day detail child route at /trip/[id]/day/[idx]"
```

---

### Task 10: Wire `DayDeck` into the Itinerary tab and remove the old list

**Files:**
- Modify: `app/trip/[id]/index.tsx` (renamed from the original `[id].tsx`)

**Context:** Replace the old `ItineraryContent` call and remove the `ItineraryContent` function definition and the `DayHeader` import. The deck now renders with the parsed itinerary + `dayImages`.

- [ ] **Step 1: Add the DayDeck import at the top**

Open `app/trip/[id]/index.tsx`. Just below the existing `import ActivityCard from '@/components/trip/ActivityCard';` (line 74), add:

```ts
import DayDeck from '@/components/trip/DayDeck';
```

Also **remove** the line:

```ts
import DayHeader from '@/components/trip/DayHeader';
```

- [ ] **Step 2: Replace the Itinerary tab render**

Find the block at lines 554-560:

```tsx
          {activeTab === 'itinerary' && (
            <ItineraryContent
              itinerary={itinerary}
              activityImages={activityImages}
              colors={colors}
            />
          )}
```

Replace with:

```tsx
          {activeTab === 'itinerary' && (
            <DayDeck
              tripId={trip._id}
              days={itinerary}
              dayImages={dayImages}
              tripStartDate={trip.startDate as number | undefined}
              destination={trip.countryName}
            />
          )}
```

- [ ] **Step 3: Delete the old `ItineraryContent` function**

In the same file, delete the entire `ItineraryContent` function at lines 770-831 (from `function ItineraryContent({` through the closing `}`). Do not delete the `LogisticsContent` function that follows it.

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bunx tsc --noEmit
```

Expected: no new errors. If `trip._id` isn't accessible (check the existing code at this point in the file — `trip` is the Convex query result), use the existing `id` param from `useLocalSearchParams` instead: `tripId={id as Id<'trips'>}`.

- [ ] **Step 5: Commit**

```bash
git add app/trip/\[id\]/index.tsx
git commit -m "feat: render Itinerary tab with DayDeck and remove old list renderer"
```

---

### Task 11: Delete the now-unused `DayHeader` component

**Files:**
- Delete: `components/trip/DayHeader.tsx`

**Context:** The exploration confirmed `DayHeader` is only imported by `app/trip/[id].tsx`. Task 10 removed that import, so the file is now dead code.

- [ ] **Step 1: Confirm no other importers**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
grep -rn "from '@/components/trip/DayHeader'" app components convex 2>/dev/null
grep -rn "from '\\./DayHeader'" components 2>/dev/null
```

Expected: no output (or only hits inside the file we're about to delete). If another file imports it, stop and investigate — do not delete.

- [ ] **Step 2: Delete the file**

```bash
git rm components/trip/DayHeader.tsx
```

- [ ] **Step 3: Run typecheck**

```bash
bunx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused DayHeader component"
```

---

### Task 12: Manual device verification

**Files:** none (pure manual test)

**Context:** The project has no automated gesture/UI tests. Verification is on-device.

- [ ] **Step 1: Start the iOS simulator build**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
bun run ios
```

(If `bun run ios` isn't aliased, use `bunx expo run:ios` — check `package.json` scripts.)

- [ ] **Step 2: Generate a fresh trip and verify**

In the running app:

1. Create a **new** 7-day trip (e.g. "Italy", any options) via the trip planner sheet. This exercises the updated `TripPlannerSheet.tsx` flow and hits the new backend endpoint fields.
2. Open the trip → switch to the **Itinerary** tab.
3. Verify:
   - The stacked deck is visible with the active card in front and two cards fanned to the right behind it.
   - The active card shows the day badge, date pill, big title, and place with pin icon on top of a photo.
   - Swiping left advances to Day 2; swiping right from Day 1 wraps to Day 7.
   - A haptic tick fires on each day change.
   - The card spring-backs smoothly on incomplete swipes (< 28% of screen width).
   - The dots below update with the active day shown as a wider pill.
4. Tap the front card → the day detail page opens.
5. On the day detail page, verify:
   - Full-bleed hero image at top with title, date pill, and place overlaid.
   - Back button (top-left) returns to the deck.
   - Morning / Afternoon / Evening activity cards render below with their images.
   - Tip callout shows below if present.
   - Horizontal swipe on the detail page navigates to the next/prev day with wrap-around.
6. Test a **1-day** trip: create one → deck renders a single card with no peek behind, no dots, swiping is a no-op.
7. Test with airplane mode on during trip generation: the trip still saves; the deck shows tinted placeholder cards with the day number visible.

- [ ] **Step 2b: Verify an existing (pre-change) trip still works**

Open a trip generated before this change. It won't have `heroSubject` or `dayImages` — verify:
- The deck still renders (cards show the day number as a tinted placeholder)
- Tapping the card still opens the day detail page
- No crashes, no missing data errors

- [ ] **Step 3: Final typecheck**

```bash
bunx tsc --noEmit
```

Expected: clean relative to the pre-existing baseline.

- [ ] **Step 4: Commit only if anything was fixed during verification**

If verification surfaced issues and required code changes, commit them with descriptive messages. Otherwise, no commit for this task.

---

## Rollback plan

If the deck regresses the Itinerary experience in production:

1. Revert commits from Task 10 and Task 11 (`git revert`).
2. The web repo changes (Tasks 1-2) are **additive and non-breaking** — `heroSubject` is an extra optional field, `dayHeroSubjects` is an optional request param, `dayImages` is an extra response field. They can stay in production safely even if the mobile client is rolled back.
3. The directory rename from Task 7 can be left in place; Expo Router handles both `app/trip/[id].tsx` and `app/trip/[id]/index.tsx` identically for the parent route.

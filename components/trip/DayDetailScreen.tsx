import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Pencil, Share, Sparkles } from 'lucide-react-native';
import { FontFamily } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { DayTimeline, type SlotImage } from '@/components/trip/day/DayTimeline';
import { PullQuote } from '@/components/trip/day/PullQuote';
import { DayTweakChips } from '@/components/trip/day/DayTweakChips';
import { DayBookingsStrip, type DayStripBooking } from '@/components/trip/day/DayBookingsStrip';
import DayMapStrip from '@/components/trip/DayMapStrip';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { tabSlideIn } from '@/utils/tabAnimation';
import { hapticSelect } from '@/utils/haptics';
import {
  type ItineraryDay,
  type DiningGuide,
  type StopSlot,
  hasStructuredStops,
  stopsForSlot,
} from '@/types/itinerary';

/** The day screen consumes the shared itinerary contract (types/itinerary.ts)
 *  — alias retained for existing import sites. */
export type DayDetailDay = ItineraryDay;

type DayImage = { url: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = SlotImage;

interface DayDetailScreenProps {
  day: DayDetailDay;
  /** Position in the FILTERED parseItineraryDays array — drives prev/next
   *  paging and the swipe animation keys ONLY. */
  dayIndex: number;
  /** Position in the STORED trips.itinerary array (`day.day - 1`) —
   *  drives everything server-addressed or calendar-based: tweakDay,
   *  the bookings strip and the start-date offset. Diverges from
   *  `dayIndex` when a null hole was filtered out of the stored array. */
  storedDayIndex: number;
  numDays: number;
  heroImage: DayImage;
  morningImage: ActivityImage;
  afternoonImage: ActivityImage;
  eveningImage: ActivityImage;
  destination?: string;
  tripStartDate?: string;
  /** Parsed `trips.diningGuide` — lunch/dinner suggestions woven into the
   *  timeline. null hides the dining inserts entirely. */
  diningGuide: DiningGuide | null;
  onBack: () => void;
  onShare: () => void;
  onEdit?: () => void;
  onNavigateDay: (newIndex: number) => void;
  /** Open AI chat scoped to this specific day. */
  onTweakWithAI?: () => void;
  /** Convex trip id — enables the one-tap tweak chips (DayTweakChips owns
   *  the mutation). Absent → the chip row doesn't render. */
  tripId?: Id<'trips'>;
  /** True while `trip.retryingSections` contains
   *  `itinerary-day:${storedDayIndex}` — a server-side tweakDay rewrite
   *  for THIS day is in flight. */
  isDayRewriting?: boolean;
  /** Trip bookings — rows whose dates cover this day render at the top of
   *  the timeline. */
  bookings?: DayStripBooking[];
}

const HERO_HEIGHT = 280;
const SHEET_TOP = 260;

// Swipe-to-page commit thresholds — UIScrollView paging semantics: a
// decisive flick commits even on short travel, otherwise distance decides.
// Distance matches DayDeck's commitThresholdPx so both day-paging surfaces
// feel identical under the finger.
const SWIPE_COMMIT_DISTANCE = 60;
const SWIPE_COMMIT_VELOCITY = 500;

// ── Helpers ──────────────────────────────────────────────────────────

function formatDaySubtitle(
  startDate: string | undefined,
  dayIndex: number,
  stopCount: number,
): string {
  const parts: string[] = [];

  if (startDate) {
    const d = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + dayIndex);
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      parts.push(`${month} ${day} · ${weekday}`);
    }
  }

  if (stopCount > 0) {
    parts.push(`${stopCount} ${stopCount === 1 ? 'stop' : 'stops'}`);
  }

  return parts.join(' · ');
}

function deriveDayTitle(day: DayDetailDay): string {
  if (day.title && day.title.trim().length > 0) return day.title;

  const placeNames = [day.morningPlace, day.afternoonPlace, day.eveningPlace].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  );

  if (placeNames.length >= 2) {
    return `${placeNames[0]} & ${placeNames[1]}`;
  }
  if (placeNames.length === 1) {
    return placeNames[0];
  }

  return `Day ${day.day}`;
}

/** Stops shown in the subtitle: valid structured stops when the day has
 *  them, otherwise the count of non-empty prose slots (legacy days). */
function countDayStops(day: DayDetailDay): number {
  if (hasStructuredStops(day)) {
    const slots: StopSlot[] = ['morning', 'afternoon', 'evening'];
    return slots.reduce((n, slot) => n + stopsForSlot(day, slot).length, 0);
  }
  return [day.morning, day.afternoon, day.evening].filter(
    (t) => (t ?? '').trim().length > 0,
  ).length;
}

// Only real itinerary tips render — no fabricated fallback. The old
// "Visit X before 9 AM…" filler presented invented advice as local
// knowledge; a day without a tip simply has no pull-quote.
function deriveTip(day: DayDetailDay): string {
  if (day.localTip && day.localTip.trim().length > 0) return day.localTip;
  if (day.tip && day.tip.trim().length > 0) return day.tip;
  return '';
}

// ── Tone for hero placeholder ─────────────────────────────────────────

const HERO_TONES: PhotoTone[] = ['forest', 'ocean', 'sunset', 'warm', 'mountain'];

function heroToneFromDestination(destination: string | undefined): PhotoTone {
  if (!destination) return 'forest';
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash += destination.charCodeAt(i);
  }
  return HERO_TONES[hash % HERO_TONES.length];
}

// ── Main screen ──────────────────────────────────────────────────────

function DayDetailScreen({
  day,
  dayIndex,
  storedDayIndex,
  numDays,
  heroImage,
  morningImage,
  afternoonImage,
  eveningImage,
  destination,
  tripStartDate,
  diningGuide,
  onBack,
  onShare,
  onEdit,
  onNavigateDay,
  onTweakWithAI,
  tripId,
  isDayRewriting,
  bookings,
}: DayDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Day paging: one handler shared by header chevrons + horizontal swipe.
  // Clamped no-op at the first/last day; selection haptic only when the day
  // actually changes (same vocabulary as DayDeck's chevrons).
  const hasNavigatedRef = useRef(false);
  const goToDay = useCallback(
    (target: number) => {
      if (target < 0 || target > numDays - 1 || target === dayIndex) return;
      hasNavigatedRef.current = true;
      hapticSelect();
      onNavigateDay(target);
    },
    [dayIndex, numDays, onNavigateDay],
  );

  // Track the previous index so the fade-slide knows which side to enter
  // from — same ref pattern as the trip-detail tab swap.
  const prevIndexRef = useRef(dayIndex);
  const navDirection = dayIndex >= prevIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevIndexRef.current = dayIndex;
  }, [dayIndex]);
  // Skip the entering animation on the very first mount — the screen push
  // (slide_from_right) already animates the whole page in; only user-driven
  // day changes get the directional content swap.
  const dayEntering = hasNavigatedRef.current
    ? tabSlideIn(navDirection * 18)
    : undefined;

  // Horizontal page swipe (Apple Photos / Books feel). activeOffsetX ±20 +
  // failOffsetY ±15 keep vertical scrolling of the day content untouched —
  // the pan only activates on a clearly horizontal drag and fails as soon
  // as the drag turns vertical, handing the touch to the ScrollView.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .onEnd((e) => {
          const byVelocity = Math.abs(e.velocityX) > SWIPE_COMMIT_VELOCITY;
          const byDistance = Math.abs(e.translationX) > SWIPE_COMMIT_DISTANCE;
          if (!byVelocity && !byDistance) return;
          // A decisive flick wins over net travel (matches iOS paging:
          // dragging right then flicking left still pages forward).
          const sign = byVelocity ? e.velocityX : e.translationX;
          // Swipe LEFT → next day, swipe RIGHT → previous day.
          const dir = sign < 0 ? 1 : -1;
          runOnJS(goToDay)(dayIndex + dir);
        }),
    [goToDay, dayIndex],
  );

  const stopCount = useMemo(() => countDayStops(day), [day]);

  const dayTitle = useMemo(() => deriveDayTitle(day), [day]);
  // Calendar offset is stored-domain: startDate + (day.day - 1) days.
  const subtitle = useMemo(
    () => formatDaySubtitle(tripStartDate, storedDayIndex, stopCount),
    [tripStartDate, storedDayIndex, stopCount],
  );
  const tip = useMemo(() => deriveTip(day), [day]);
  const heroTone = useMemo(() => heroToneFromDestination(destination), [destination]);

  return (
    <GestureDetector gesture={swipeGesture}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HERO (fixed, not scrollable) ────────────────────────────── */}
      <View style={styles.hero}>
        {/* Day media + title page with the swipe (keyed remount per day);
            the top bar stays mounted — Apple Books pattern: chrome is
            fixed, page content slides. */}
        <Animated.View
          key={`hero-${dayIndex}`}
          entering={dayEntering}
          style={StyleSheet.absoluteFill}
        >
        {heroImage?.url ? (
          <ImageBackground
            source={{ uri: heroImage.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          >
            {/* Scrim: dark top + dark bottom, transparent middle for legibility */}
            <LinearGradient
              colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
              locations={[0, 0.35, 0.60, 1]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        ) : (
          <Photo
            tone={heroTone}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* ── Hero bottom: kicker + italic title + coral squiggle ── */}
        <View style={styles.heroBottom}>
          {subtitle.length > 0 ? (
            <Text
              style={[
                Type.kickerSm,
                {
                  color: 'rgba(255,255,255,0.92)',
                  fontSize: 10,
                  letterSpacing: 10 * 0.18,
                },
              ]}
              numberOfLines={1}
            >
              {(destination ?? '').toUpperCase()}
              {destination && subtitle ? ' · ' : ''}
              {subtitle.split(' · ')[0]?.toUpperCase()}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 30,
              fontWeight: '500',
              letterSpacing: -30 * 0.02,
              color: '#FFFFFF',
              marginTop: 4,
              lineHeight: 32,
            }}
            numberOfLines={2}
          >
            {(() => {
              const titleWords = dayTitle.split(/\s+/);
              if (titleWords.length === 1) {
                return (
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {dayTitle}
                  </Text>
                );
              }
              const head = titleWords.slice(0, -1).join(' ');
              const tail = titleWords[titleWords.length - 1];
              return (
                <>
                  {head}{' '}
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {tail}
                  </Text>
                </>
              );
            })()}
          </Text>
          <Squiggle width={120} color={colors.coral} style={{ marginTop: 4 }} />
        </View>
        </Animated.View>

        {/* ── Top bar (safe-area-pinned, 18px horizontal) — stays mounted
            across day changes (only the pill label updates), rendered after
            the paging media so it sits on top. insets.top, not a hardcoded
            52 — a fixed offset overlaps the Dynamic Island on Pro Max
            phones and floats too low on SE-class devices. ── */}
        <View style={[styles.topBar, { top: insets.top + 4 }]}>
          <CircleBtn
            solid
            onPress={onBack}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
          </CircleBtn>

          {/* Day navigator — chevron buttons flank the count, all in one
              glass pill so it reads as a single widget. Edge chevrons fade
              when there's no further day in that direction. */}
          <View style={styles.dayNav}>
            <Pressable
              onPress={() => goToDay(dayIndex - 1)}
              disabled={dayIndex <= 0}
              accessibilityLabel="Previous day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayNavBtn,
                {
                  opacity: dayIndex <= 0 ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronLeft size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
            <View style={styles.dayNavLabel}>
              {/* day.day (authoritative day number) drives the label, not
                  the filtered-array position. */}
              <Text style={styles.dayNavText}>{`Day ${day.day ?? dayIndex + 1} of ${numDays}`}</Text>
            </View>
            <Pressable
              onPress={() => goToDay(dayIndex + 1)}
              disabled={dayIndex >= numDays - 1}
              accessibilityLabel="Next day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayNavBtn,
                {
                  opacity: dayIndex >= numDays - 1 ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.topBarActions}>
            <CircleBtn
              solid
              onPress={onShare}
              accessibilityLabel="Share day"
            >
              <Share size={16} color={colors.ink} strokeWidth={2} />
            </CircleBtn>
            <CircleBtn
              solid
              onPress={onEdit}
              accessibilityLabel="Edit day"
            >
              <Pencil size={16} color={colors.ink} strokeWidth={2} />
            </CircleBtn>
          </View>
        </View>
      </View>

      {/* ── SHEET (overlaps hero from top 260) ─────────────────────── */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            top: SHEET_TOP,
          },
        ]}
      >
        {/* Grab handle */}
        <View style={styles.grabHandleWrapper}>
          <View
            style={[
              styles.grabHandle,
              { backgroundColor: colors.inkFaint, opacity: 0.5 },
            ]}
          />
        </View>

        {/* Keyed per day: pages with the swipe and resets scroll to the
            top of the incoming day (Apple Photos behaviour). */}
        <Animated.View
          key={`sheet-${dayIndex}`}
          entering={dayEntering}
          style={styles.sheetBody}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Bookings woven into the day — flights departing today, stays
              covering it. Renders nothing without a startDate or matches. */}
          <DayBookingsStrip
            bookings={bookings}
            tripStartDate={tripStartDate}
            dayIndex={storedDayIndex}
          />

          {/* Slot-grouped timeline — structured stops with dining woven in;
              legacy days fall back to chunked-prose slot rows inside. */}
          <DayTimeline
            day={day}
            diningGuide={diningGuide}
            destination={destination}
            morningImage={morningImage}
            afternoonImage={afternoonImage}
            eveningImage={eveningImage}
          />


          {/* Destination mini-map + open-in-Maps rows (renders nothing
              when the day has no named places) */}
          <DayMapStrip day={day} destination={destination} />

          {/* Pull quote — only when the itinerary actually has a tip */}
          {tip ? <PullQuote tip={tip} /> : null}

          {/* One-tap day rewrites — soft chips firing tweakDay; swaps to a
              "Rewriting this day…" pill while the server run is in flight. */}
          {tripId ? (
            <DayTweakChips
              tripId={tripId}
              // tweakDay addresses the STORED itinerary array server-side.
              dayIndex={storedDayIndex}
              isRewriting={isDayRewriting ?? false}
            />
          ) : null}

          {/* Tweak this day — AI chat scoped to this specific day */}
          {onTweakWithAI ? (
            <Pressable
              onPress={onTweakWithAI}
              style={({ pressed }) => [
                styles.aiCta,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.aiCtaIcon, { backgroundColor: colors.coralBg }]}>
                <Sparkles size={16} color={colors.coralDeep} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Type.kickerSm,
                    { color: colors.coralDeep, fontSize: 9, letterSpacing: 9 * 0.18 },
                  ]}
                >
                  AI ASSISTANT
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 16,
                    fontWeight: '500',
                    color: colors.ink,
                    marginTop: 2,
                    letterSpacing: -16 * 0.012,
                  }}
                >
                  Tweak this day
                </Text>
              </View>
              <Text
                style={[
                  Type.kickerSm,
                  { color: colors.inkMute, fontSize: 9 },
                ]}
              >
                CHAT →
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        </Animated.View>
      </View>
    </View>
    </GestureDetector>
  );
}

export default React.memo(DayDetailScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Hero ───
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 2,
  },
  dayNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavLabel: {
    paddingHorizontal: 4,
  },
  dayNavText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  aiCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  aiCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 18,
  },

  // ── Sheet ───
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grabHandleWrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetBody: {
    // Fills the sheet below the grab handle so the keyed remount per day
    // doesn't change the ScrollView's available height.
    flex: 1,
  },
  sheetContent: {
    paddingTop: 10,
    paddingHorizontal: 22,
  },
});

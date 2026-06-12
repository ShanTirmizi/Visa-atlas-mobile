import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import DayDeckCard, { type DayImage } from './DayDeckCard';
import { DAY_DECK_PHYSICS } from './DayDeck.constants';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { PillButton } from '@/components/ui/PillButton';
import { Squiggle } from '@/components/ui/Squiggle';
import { TypingDots } from '@/components/ui/TypingDots';
import type { ItineraryDay, StopPhotoSet, StopSlot } from '@/types/itinerary';
import { usePhotoViewer } from '@/components/photos/PhotoViewer';
import { buildDayAlbum, type AlbumImageSource } from '@/utils/photoAlbum';

/** The deck consumes the shared itinerary-day contract (types/itinerary.ts)
 *  — alias retained for existing import sites. */
export type DayDeckDay = ItineraryDay;

interface DayDeckProps {
  tripId: string;
  /** Parsed itinerary days. Tolerates null/undefined holes — out-of-order
   *  per-day patches during streaming can pad the server-side array, and a
   *  malformed day may be skipped entirely. Holes are filtered before
   *  render; day labels come from `day.day`, so filtering is safe. */
  days: Array<DayDeckDay | null | undefined>;
  dayImages: DayImage[];
  /** Parsed `trips.activityImages` (3 per stored day) — slot anchor shots
   *  for the per-day photo album behind the card's photos pill. */
  activityImages?: AlbumImageSource[];
  /** Parsed `trips.stopPhotos` — per-stop Google Places photos. */
  stopPhotos?: StopPhotoSet[];
  tripHeroImage?: DayImage;
  tripStartDate?: string;
  destination?: string;
  /** Tap handler for the inline edit pencil on each day card. The active
   *  index is the JS-side activeIdx, so this always edits the centre day. */
  onEditDay?: (index: number) => void;
  /**
   * If the trip is mid-generation, this is the index of the day currently
   * being written. null/undefined means no day is streaming. The day at
   * this index renders with a typing-dots suffix in the pill and a
   * coral cursor at the end of its currently-streaming activity.
   */
  streamingDayIndex?: number | null;
  /**
   * Total expected days (for the day-dots row). Defaults to days.length
   * when not generating.
   */
  expectedDayCount?: number;
}

// ── Sizing ────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.77), 340);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.3);

function formatDayDate(startDate: string | undefined, dayOffset: number): string | undefined {
  if (!startDate) return undefined;
  const d = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function pickPlace(day: DayDeckDay): string | undefined {
  return day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace;
}

// ── DayDotsRow ────────────────────────────────────────────────────────
// Horizontal row of small dots, one per planned day. Filled dots == done,
// pulsing-with-halo == currently streaming, dim == pending. Only mounted
// while `streamingDayIndex` is non-null (i.e., during generation).
interface DayDotsRowProps {
  total: number;
  currentIndex: number;
  streamingIndex?: number | null;
}

function DayDotsRow({ total, streamingIndex }: DayDotsRowProps) {
  const { colors } = useTheme();
  const completed = streamingIndex ?? 0;
  const remaining = Math.max(0, total - completed);
  return (
    <View style={{ alignItems: 'center', marginTop: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {/* coralDeep at 10pt — coral (#E89B7A) at 9pt on paper bg fails
            contrast for text this small; coralDeep keeps the brand hue. */}
        <Text
          style={{
            fontSize: 10,
            letterSpacing: 0.08 * 10,
            textTransform: 'uppercase',
            color: colors.coralDeep,
            fontFamily: FontFamily.semibold,
          }}
        >
          {completed} of {total} ready · {remaining} more arriving
        </Text>
        <TypingDots color={colors.coralDeep} size="sm" gap={3} />
      </View>
      <View style={styles.dotsRowStreaming}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = streamingIndex != null && i < streamingIndex;
          const isStreaming = i === streamingIndex;
          return (
            <View
              key={i}
              style={[
                styles.dotStreaming,
                isDone && { backgroundColor: colors.coral },
                isStreaming && {
                  backgroundColor: colors.coral,
                  shadowColor: colors.coral,
                  shadowOpacity: 0.5,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 3,
                },
                !isDone && !isStreaming && { backgroundColor: colors.line },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

// ── DeckCardItem ──────────────────────────────────────────────────────
// Renders one card. Only the center card (offset === 0) has a live pan gesture.
// Side cards use spec physics: translateX = offset*50, scale = 1-|o|*0.07,
// opacity = 1-|o|*0.3. The center card also applies drag-based translateX and rotation.
interface DeckCardItemProps {
  dayIdx: number;
  day: DayDeckDay;
  image: DayImage;
  date?: string;
  place?: string;
  /** Threaded down to DayDeckCard so the day-vote heart pill can subscribe
   *  to this trip's votes (Convex dedupes the identical subscription across
   *  visible cards). */
  tripId: string;
  activeIdxJS: number; // JS-side active index, used to compute integer offset
  dragX: SharedValue<number>;
  onCommit: (newIdx: number) => void;
  onTap: () => void;
  numDays: number;
  /** When true, renders a blinking coral cursor at the end of the title —
   *  used on the day currently being written during streaming generation. */
  showCursor?: boolean;
  /** Day-album size + opener for the card's photos pill. */
  photoCount?: number;
  onOpenPhotos?: () => void;
}

function DeckCardItem({
  dayIdx,
  day,
  image,
  date,
  place,
  tripId,
  activeIdxJS,
  dragX,
  onCommit,
  onTap,
  numDays,
  showCursor,
  photoCount,
  onOpenPhotos,
}: DeckCardItemProps) {
  // Integer offset from center (computed on JS side for render decisions)
  const offset = dayIdx - activeIdxJS;
  const isCenter = offset === 0;
  const absOffset = Math.abs(offset);

  const fireHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // Animated style using spec-exact formulas
  const animatedStyle = useAnimatedStyle(() => {
    const o = offset; // integer, stable — this is fine since DeckCardItem remounts per change
    const translateX = o * DAY_DECK_PHYSICS.offsetTranslate + (isCenter ? dragX.value : 0);
    const scale = 1 - Math.abs(o) * DAY_DECK_PHYSICS.scalePerOffset;
    const opacity = 1 - Math.abs(o) * DAY_DECK_PHYSICS.opacityPerOffset;
    const rotation = isCenter ? dragX.value * DAY_DECK_PHYSICS.rotationPerDragPx : 0;
    const zIndex = 100 - absOffset;

    return {
      transform: [
        { translateX },
        { scale },
        { rotateZ: `${rotation}deg` },
      ],
      opacity,
      zIndex,
    };
  });

  // Pan gesture — only active for the center card
  const pan = Gesture.Pan()
    .enabled(isCenter)
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      dragX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > DAY_DECK_PHYSICS.commitThresholdPx && numDays > 1) {
        // drag LEFT = next day (idx decreases to show higher day number)
        // drag RIGHT = previous day
        const dir = Math.sign(e.translationX); // +1 = right (prev), -1 = left (next)
        const raw = activeIdxJS - dir; // per spec: drag left → next = idx + 1; drag right → prev = idx - 1
        const newIdx = Math.max(0, Math.min(numDays - 1, raw));
        dragX.value = withSpring(0, DAY_DECK_PHYSICS.springConfig);
        runOnJS(onCommit)(newIdx);
        runOnJS(fireHaptic)();
      } else {
        dragX.value = withSpring(0, DAY_DECK_PHYSICS.springConfig);
      }
    });

  // Tap gesture — only active for the center card. Opens the day detail.
  // Composed with pan so dragging still works; the tap only fires on a clean tap.
  const tap = Gesture.Tap()
    .enabled(isCenter)
    .maxDuration(250)
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(onTap)();
    });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardSlot, animatedStyle]}>
        <DayDeckCard
          dayNumber={day.day}
          title={day.title}
          place={place}
          date={date}
          image={image}
          showCursor={showCursor}
          tripId={tripId}
          photoCount={photoCount}
          onOpenPhotos={onOpenPhotos}
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ── DayDeck ───────────────────────────────────────────────────────────
function DayDeck({
  tripId,
  days,
  dayImages,
  activityImages,
  stopPhotos,
  tripHeroImage,
  tripStartDate,
  destination,
  streamingDayIndex,
  expectedDayCount,
}: DayDeckProps) {
  const { colors } = useTheme();
  const { openPhotoViewer } = usePhotoViewer();
  const [activeIdx, setActiveIdx] = useState(0);
  const dragX = useSharedValue(0);

  // Drop null/undefined holes (see `days` prop doc) before any indexing.
  const safeDays = useMemo(
    () => (days ?? []).filter((d): d is DayDeckDay => Boolean(d)),
    [days],
  );

  const numDays = safeDays.length;
  const isStreaming = streamingDayIndex !== null && streamingDayIndex !== undefined;
  // If the trip is mid-generation, the spec calls for the day-dots row to
  // visualize ALL planned days (e.g. 1..10), not just the ones written so far.
  const totalDayDots = expectedDayCount ?? numDays;

  const handleCommit = useCallback((newIdx: number) => {
    setActiveIdx(newIdx);
  }, []);

  // Keep the active index in range when the day list shrinks — an
  // itinerary retry clears the array and re-streams days, so a stale
  // index would otherwise point past the deck and render nothing.
  React.useEffect(() => {
    if (activeIdx > 0 && activeIdx > numDays - 1) {
      setActiveIdx(Math.max(0, numDays - 1));
    }
  }, [activeIdx, numDays]);

  const openDay = useCallback(() => {
    router.push(`/trip/${tripId}/day/${activeIdx}`);
  }, [tripId, activeIdx]);

  // Right-chevron should be disabled when there's no next day to advance to
  // AND streaming is still in flight (i.e., the next day exists in the plan
  // but hasn't been written yet). When the trip is fully generated this is
  // simply "we're already on the last day" — that's the existing disabled
  // semantic in DayDetailScreen, no haptic needed there.
  const rightDisabled = activeIdx >= numDays - 1 && isStreaming;
  const leftDisabled = activeIdx <= 0;

  const handlePrevDay = useCallback(() => {
    if (leftDisabled) return;
    setActiveIdx((idx) => Math.max(0, idx - 1));
    Haptics.selectionAsync().catch(() => {});
  }, [leftDisabled]);

  const handleNextDay = useCallback(() => {
    if (rightDisabled) {
      // Day is still being written — block advance and give haptic feedback.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    if (activeIdx >= numDays - 1) return;
    setActiveIdx((idx) => Math.min(numDays - 1, idx + 1));
    Haptics.selectionAsync().catch(() => {});
  }, [rightDisabled, activeIdx, numDays]);

  if (numDays === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.inkMute }]}>No itinerary available</Text>
      </View>
    );
  }

  // Only render cards within ±visibleSideCards of the active index
  const visibleRange = DAY_DECK_PHYSICS.visibleSideCards;
  const visibleCards = safeDays
    .map((day, idx) => ({ day, idx }))
    .filter(({ idx }) => Math.abs(idx - activeIdx) <= visibleRange);

  return (
    <View style={styles.container}>
      {/* ── Editorial header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
          {numDays} {numDays === 1 ? 'DAY' : 'DAYS'}
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 22,
            fontWeight: '500',
            letterSpacing: -22 * 0.018,
            color: colors.ink,
            marginTop: 2,
            lineHeight: 24,
          }}
        >
          Drag the{' '}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
            }}
          >
            centre
          </Text>
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
        <Squiggle width={120} color={colors.coral} style={{ marginTop: 4 }} />
      </View>

      {/* ── Day pill nav (chevrons + label) — shown ONLY during streaming.
          When the trip is fully generated this is noise; pan/swipe is the
          primary nav, and the bottom CTA already shows "Open Day N". The
          pill surfaces the per-day generation status while the model writes. */}
      {isStreaming && (
        <View style={styles.dayPillRow}>
          <View
            style={[
              styles.dayPill,
              {
                backgroundColor: colors.coralBg,
                borderColor: colors.coralSoft,
              },
            ]}
          >
            <Pressable
              onPress={handlePrevDay}
              disabled={leftDisabled}
              accessibilityLabel="Previous day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayPillBtn,
                { opacity: leftDisabled ? 0.35 : pressed ? 0.7 : 1 },
              ]}
            >
              <ChevronLeft size={16} color={colors.coralDeep} strokeWidth={2.4} />
            </Pressable>

            <View style={styles.dayPillLabel}>
              <Text
                style={[
                  styles.dayPillText,
                  { color: colors.coralDeep },
                ]}
              >
                {`Day ${activeIdx + 1} of ${expectedDayCount ?? numDays}`}
              </Text>
              {activeIdx === streamingDayIndex && (
                <>
                  <Text
                    style={[
                      styles.dayPillText,
                      { color: colors.coralDeep, marginLeft: 6 },
                    ]}
                  >
                    {' '}· writing
                  </Text>
                  <View style={{ marginLeft: 6 }}>
                    <TypingDots color={colors.coralDeep} size="sm" gap={3} />
                  </View>
                </>
              )}
            </View>

            <Pressable
              onPress={handleNextDay}
              accessibilityLabel="Next day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayPillBtn,
                { opacity: rightDisabled ? 0.3 : pressed ? 0.7 : 1 },
              ]}
            >
              <ChevronRight size={16} color={colors.coralDeep} strokeWidth={2.4} />
            </Pressable>
          </View>

          <DayDotsRow
            total={totalDayDots}
            currentIndex={activeIdx}
            streamingIndex={streamingDayIndex}
          />
        </View>
      )}

      {/* ── Card Deck ─────────────────────────────────────────────── */}
      <View style={styles.deckArea}>
        {visibleCards.map(({ day, idx }) => {
          // Image/date are keyed on the authoritative day number, not the
          // array position — identical in the steady state (day === idx+1)
          // but stays aligned when a null hole was filtered out mid-stream.
          const dayOffset = (day.day ?? idx + 1) - 1;
          // Day album behind the photos pill — same assembly the day
          // screen uses, so both surfaces open identical galleries. Only
          // the ≤3 visible cards build one; trivial array work.
          const slotImageAt = (slotIdx: number): AlbumImageSource =>
            activityImages?.[dayOffset * 3 + slotIdx] ?? null;
          const album = buildDayAlbum({
            day,
            dayNumber: day.day ?? idx + 1,
            dayImage: dayImages[dayOffset] ?? null,
            slotImages: (['morning', 'afternoon', 'evening'] as StopSlot[]).reduce(
              (acc, slot, slotIdx) => {
                acc[slot] = slotImageAt(slotIdx);
                return acc;
              },
              {} as Partial<Record<StopSlot, AlbumImageSource>>,
            ),
            stopPhotos,
          });
          return (
            <DeckCardItem
              key={idx}
              dayIdx={idx}
              day={day}
              // Per-day image only — never fall back to the trip-level hero,
              // because during streaming the per-day images haven't arrived
              // yet and ALL cards would render the same hero photo (Day 2,
              // 3, 4 of New Zealand all showing the Queenstown hero, etc.).
              // DayDeckCard handles `null` gracefully with its dark photo
              // region, so an unloaded card reads as "image arriving" rather
              // than "wrong image."
              image={dayImages[dayOffset] ?? null}
              place={pickPlace(day) ?? destination}
              date={formatDayDate(tripStartDate, dayOffset)}
              tripId={tripId}
              activeIdxJS={activeIdx}
              dragX={dragX}
              onCommit={handleCommit}
              onTap={openDay}
              numDays={numDays}
              showCursor={isStreaming && idx === streamingDayIndex}
              photoCount={album.length}
              onOpenPhotos={() => openPhotoViewer(album, 0)}
            />
          );
        })}
      </View>

      {/* ── Progress dots — coral on active ───────────────────────── */}
      {numDays > 1 && (
        <View style={styles.dotsRow}>
          {Array.from({ length: numDays }).map((_, i) => {
            const isActive = i === activeIdx;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.dotActive, { backgroundColor: colors.coral }]
                    : [styles.dotInactive, { backgroundColor: colors.lineMid }],
                ]}
              />
            );
          })}
        </View>
      )}

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      <View style={styles.ctaRow}>
        <PillButton
          label={`Open Day ${activeIdx + 1}`}
          onPress={openDay}
          variant="primary"
          fullWidth
        />
      </View>
    </View>
  );
}

export default React.memo(DayDeck);

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    paddingTop: 0,
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 8,
  },
  deckArea: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT + 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cardSlot: {
    position: 'absolute',
    top: 12,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    left: (SCREEN_WIDTH - CARD_WIDTH) / 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
  },
  dotInactive: {
    width: 6,
  },

  // ── Streaming UI: pill nav + per-day dots row ──────────────────────
  dayPillRow: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 2,
  },
  dayPillBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dayPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  dotsRowStreaming: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dotStreaming: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  hint: {
    marginTop: 14,
    textAlign: 'center',
  },
  ctaRow: {
    // Spec: absolute bottom 30, left/right 22. In a scroll-view context we
    // keep it in flow so it doesn't overlap the hint — the parent scroll
    // surface provides the bottom breathing room via container paddingBottom.
    alignSelf: 'stretch',
    marginHorizontal: 22,
    marginTop: 18,
  },
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});

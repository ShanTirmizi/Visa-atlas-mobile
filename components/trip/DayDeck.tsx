import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  type SharedValue,
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
  tripHeroImage?: DayImage;
  tripStartDate?: string;
  destination?: string;
}

// ── Sizing ────────────────────────────────────────────────────────────
// Slightly larger front card, tighter stride. Peeks are subtle slivers on
// each side — the user wanted "poking out from the side," not a carousel.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.68), 310);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.3);
const CARD_STRIDE = Math.round(CARD_WIDTH * 0.32);

const SWIPE_THRESHOLD = CARD_STRIDE * 0.8;
const VELOCITY_THRESHOLD = 650;

// Spring config for the commit motion — slight overshoot, then settle. This
// is what gives the deck its "throw" feel versus a flat carousel slide.
const COMMIT_SPRING = {
  damping: 14,
  stiffness: 140,
  mass: 0.85,
  overshootClamping: false,
  restDisplacementThreshold: 0.2,
  restSpeedThreshold: 2,
} as const;

// Lighter spring for the snap-back (incomplete swipe).
const SNAPBACK_SPRING = {
  damping: 22,
  stiffness: 200,
  mass: 0.9,
} as const;

// Tilt constants for the interactive "card grip" feel during drag.
// TILT_PER_PX controls how much the front card rotates as you drag it —
// 0.08°/px means 100px drag = 8° tilt, feels physical without being extreme.
const TILT_PER_PX = 0.08;
// Peak rotation applied during the commit flourish before settling back.
const COMMIT_PEAK_TILT_DEG = 14;

function formatDayDate(startDate: string | undefined, dayOffset: number): string | undefined {
  if (!startDate) return undefined;
  // startDate is YYYY-MM-DD — append T00:00:00 so Date() parses it as local time.
  const d = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function pickPlace(day: DayDeckDay): string | undefined {
  return day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace;
}

// ── DeckCardItem ──────────────────────────────────────────────────────
// One per day. Stable React key = dayIdx, never remounts. Every visual
// change during a swipe happens inside the worklet with no JS round-trip.
interface DeckCardItemProps {
  dayIdx: number;
  numDays: number;
  day: DayDeckDay;
  image: DayImage;
  date?: string;
  place?: string;
  activeIndex: SharedValue<number>;
  dragX: SharedValue<number>;
  tilt: SharedValue<number>;
}

function DeckCardItem({
  dayIdx,
  numDays,
  day,
  image,
  date,
  place,
  activeIndex,
  dragX,
  tilt,
}: DeckCardItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Wrap-aware signed distance from the active card. For a 10-day trip at
    // activeIndex=9 looking at dayIdx=0, slot becomes +1 (visually one step
    // after day 9), not -9.
    let slot = dayIdx - activeIndex.value;
    const half = numDays / 2;
    if (slot > half) slot -= numDays;
    if (slot <= -half) slot += numDays;

    // Visual offset combines the static slot with the fractional drag. When
    // the user drags right by a full stride, every card's visual offset
    // decreases by 1 in sync — the whole deck shifts as one piece.
    const visualOffset = slot + dragX.value / CARD_STRIDE;
    const abs = Math.abs(visualOffset);

    // Anything past slot ±2.5 is completely hidden so the wrap-around is invisible.
    if (abs > 2.5) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { scale: 0.7 }, { rotateZ: '0deg' }],
        zIndex: 0,
      };
    }

    const translateX = visualOffset * CARD_STRIDE;
    // More dramatic scale curve: back cards are clearly smaller, and the
    // transition from 0.78 → 1.0 gives the new front card a visible "grow
    // into place" as it comes forward.
    const scale = interpolate(abs, [0, 1, 2], [1, 0.87, 0.72], Extrapolation.CLAMP);
    // Slot-based rotation fan — symmetric around center.
    const slotRotate = interpolate(
      visualOffset,
      [-2, -1, 0, 1, 2],
      [-10, -6, 0, 6, 10],
      Extrapolation.CLAMP,
    );
    // Bolder opacity falloff — back cards are visibly faded, emphasizing
    // the depth stack and making the front card the clear focal point.
    const opacity = interpolate(abs, [0, 1, 2], [1, 0.78, 0.15], Extrapolation.CLAMP);
    // Higher zIndex closer to center — front card always draws on top even
    // when the fan rotation would otherwise confuse layer order.
    const zIndex = Math.round(100 - abs * 10);

    // Tinder-style interactive tilt: only applied to whichever card IS
    // currently the front. During drag, tilt grows with finger; on commit,
    // it animates to a dramatic peak and then back to 0. After reset, the
    // new front card has tilt=0 and gets its rotation purely from slotRotate.
    const isFront = dayIdx === activeIndex.value;
    const extraTilt = isFront ? tilt.value : 0;

    return {
      transform: [
        { translateX },
        { scale },
        { rotateZ: `${slotRotate + extraTilt}deg` },
      ],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View style={[styles.cardSlot, animatedStyle]}>
      <DayDeckCard
        dayNumber={day.day}
        title={day.title}
        place={place}
        date={date}
        image={image}
      />
    </Animated.View>
  );
}

const MemoDeckCardItem = React.memo(DeckCardItem);

// ── DayDeck ───────────────────────────────────────────────────────────
function DayDeck({
  tripId,
  days,
  dayImages,
  tripHeroImage,
  tripStartDate,
  destination,
}: DayDeckProps) {
  const { colors } = useTheme();

  // activeIndex lives in TWO places by design: a shared value for the
  // worklet (atomic UI-thread updates), and React state for children that
  // need to re-render (dots, counter).
  const [activeIndexJS, setActiveIndexJS] = useState(0);
  const activeIndex = useSharedValue(0);
  const dragX = useSharedValue(0);
  const tilt = useSharedValue(0);

  const numDays = days.length;

  const fireHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const openDay = useCallback(() => {
    router.push(`/trip/${tripId}/day/${activeIndexJS}`);
  }, [tripId, activeIndexJS]);

  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-14, 14])
      .failOffsetY([-20, 20])
      .onUpdate((e) => {
        dragX.value = e.translationX;
        // Live Tinder tilt — the front card rotates as you drag it, giving
        // the tactile sense of gripping and tipping a physical card.
        tilt.value = e.translationX * TILT_PER_PX;
      })
      .onEnd((e) => {
        const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
        const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

        if ((past || fast) && numDays > 1) {
          // dir: +1 = next day (swiped left), -1 = prev day (swiped right)
          const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
          const target = -dir * CARD_STRIDE;

          // Commit flourish: tilt ramps to a dramatic peak for ~140ms, then
          // settles back to 0 over the remaining ~200ms. By the end, tilt=0
          // so the reset math stays clean — any tilt left over at reset would
          // snap to the new front card and cause a visible pop.
          tilt.value = withSequence(
            withTiming(-dir * COMMIT_PEAK_TILT_DEG, { duration: 140 }),
            withTiming(0, { duration: 200 }),
          );

          // Back-card shift: cards slide one stride via a slightly-springy
          // curve with controlled overshoot. This is what gives the deck the
          // "throw" feel rather than feeling like a linear carousel slide.
          dragX.value = withSpring(target, COMMIT_SPRING, (finished) => {
            if (finished) {
              // Atomic advance: shared value + dragX reset, same frame, same
              // thread. The new front card's slot math places it at the exact
              // position where the old front card visually is, so no pop.
              const newIdx = (activeIndex.value + dir + numDays) % numDays;
              activeIndex.value = newIdx;
              dragX.value = 0;
              tilt.value = 0;
              runOnJS(setActiveIndexJS)(newIdx);
              runOnJS(fireHaptic)();
            }
          });
        } else {
          // Incomplete — spring everything back.
          dragX.value = withSpring(0, SNAPBACK_SPRING);
          tilt.value = withSpring(0, SNAPBACK_SPRING);
        }
      });

    const tap = Gesture.Tap()
      .maxDistance(14)
      .onEnd((_e, success) => {
        if (success) runOnJS(openDay)();
      });

    return Gesture.Exclusive(pan, tap);
  }, [numDays, fireHaptic, openDay, activeIndex, dragX, tilt]);

  if (numDays === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No itinerary available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.counter}>
        <Text style={[styles.counterLabel, { color: colors.textMuted }]}>YOUR TRIP</Text>
        <Text style={[styles.counterValue, { color: colors.foreground }]}>
          {`${activeIndexJS + 1} / ${numDays}`}
        </Text>
      </View>

      <GestureDetector gesture={composedGesture}>
        <View style={styles.deckArea}>
          {days.map((day, dayIdx) => (
            <MemoDeckCardItem
              key={dayIdx}
              dayIdx={dayIdx}
              numDays={numDays}
              day={day}
              image={dayImages[dayIdx] ?? tripHeroImage ?? null}
              place={pickPlace(day) ?? destination}
              date={formatDayDate(tripStartDate, dayIdx)}
              activeIndex={activeIndex}
              dragX={dragX}
              tilt={tilt}
            />
          ))}
        </View>
      </GestureDetector>

      <DayDeckDots count={numDays} activeIndex={activeIndexJS} />

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        swipe to browse days · tap to open
      </Text>
    </View>
  );
}

export default React.memo(DayDeck);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 28,
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
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 18,
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

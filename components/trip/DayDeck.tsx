import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
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
// Smaller front card so there's breathing room and the peeks look intentional.
// 0.62 of screen width is the sweet spot for a "premium deck" feel — big
// enough to read, small enough to show siblings.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.64), 300);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.32);

// Horizontal stride between adjacent slots. With stride ≈ 40% of card width
// the next card peeks out by roughly 30% behind the front card on each side.
const CARD_STRIDE = Math.round(CARD_WIDTH * 0.42);

const SWIPE_THRESHOLD = CARD_STRIDE * 0.55;
const VELOCITY_THRESHOLD = 650;

// Apple-style "emphasized decelerate" cubic bezier — fast initial motion,
// gentle landing. This is the curve UIKit uses for most system transitions.
const COMMIT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

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
// One per day. Stable React key = dayIdx, never remounts. Everything that
// changes during a swipe is inside the worklet.
interface DeckCardItemProps {
  dayIdx: number;
  numDays: number;
  day: DayDeckDay;
  image: DayImage;
  date?: string;
  place?: string;
  activeIndex: SharedValue<number>;
  dragX: SharedValue<number>;
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
}: DeckCardItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Wrap-aware signed distance from the active card.
    // For numDays=10 and activeIndex=9 looking at dayIdx=0:
    //   raw = 0 - 9 = -9, but 0 is visually "one after" 9, so slot should be +1.
    //   We shift by numDays when the raw distance crosses the half-point.
    let slot = dayIdx - activeIndex.value;
    const half = numDays / 2;
    if (slot > half) slot -= numDays;
    if (slot <= -half) slot += numDays;

    // Visual offset: slot plus the fraction of a stride the finger has dragged.
    // Drag right (dragX > 0) → visualOffset decreases for cards with positive
    // slot and increases for cards with negative slot — i.e., the whole deck
    // shifts right as one piece, exactly following the finger.
    const visualOffset = slot + dragX.value / CARD_STRIDE;
    const abs = Math.abs(visualOffset);

    // Off-screen cards: fully transparent, minimal transform cost.
    if (abs > 2.6) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { scale: 0.9 }, { rotateZ: '0deg' }],
        zIndex: 0,
      };
    }

    const translateX = visualOffset * CARD_STRIDE;
    // Scale: 1.0 at center, 0.9 at ±1, 0.78 at ±2.
    const scale = interpolate(abs, [0, 1, 2], [1, 0.9, 0.78], Extrapolation.CLAMP);
    // Rotation: symmetric fan, ±6° at ±1, ±9° at ±2.
    const rotate = interpolate(
      visualOffset,
      [-2, -1, 0, 1, 2],
      [-9, -6, 0, 6, 9],
      Extrapolation.CLAMP,
    );
    // Opacity: 1 at center, 0.85 at ±1, 0 at ±2 (invisible beyond 2 slots).
    const opacity = interpolate(abs, [0, 1, 1.9], [1, 0.85, 0], Extrapolation.CLAMP);
    // zIndex: higher when closer to center, so the front card always draws
    // on top regardless of render order.
    const zIndex = Math.round(100 - abs * 10);

    return {
      transform: [
        { translateX },
        { scale },
        { rotateZ: `${rotate}deg` },
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

  // activeIndex lives in TWO places by design:
  //  - A shared value for the worklet (atomic UI-thread updates, no race)
  //  - React state for UI children that need it (dots, counter)
  // Both are updated in the commit callback: the shared value synchronously
  // (same frame as the dragX reset, so the transforms don't flicker) and the
  // React state via runOnJS (for the dots/counter to re-render).
  const [activeIndexJS, setActiveIndexJS] = useState(0);
  const activeIndex = useSharedValue(0);
  const dragX = useSharedValue(0);

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
      })
      .onEnd((e) => {
        const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
        const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

        if ((past || fast) && numDays > 1) {
          // dir: +1 = next day (user swiped left), -1 = prev day (swiped right)
          const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
          // Target position: continue the drag in the same direction by one
          // stride. For a left swipe (dir=+1, translationX<0), target is negative.
          // For a right swipe (dir=-1, translationX>0), target is positive.
          const target = -dir * CARD_STRIDE;
          dragX.value = withTiming(
            target,
            { duration: 320, easing: COMMIT_EASING },
            (finished) => {
              if (finished) {
                // Atomic update: shared value first (UI thread, same frame),
                // then dragX reset (no-op visually because the new slot math
                // places cards exactly where they already are).
                const newIdx = (activeIndex.value + dir + numDays) % numDays;
                activeIndex.value = newIdx;
                dragX.value = 0;
                runOnJS(setActiveIndexJS)(newIdx);
                runOnJS(fireHaptic)();
              }
            },
          );
        } else {
          dragX.value = withSpring(0, {
            damping: 22,
            stiffness: 180,
            mass: 0.9,
          });
        }
      });

    const tap = Gesture.Tap()
      .maxDistance(14)
      .onEnd((_e, success) => {
        if (success) runOnJS(openDay)();
      });

    return Gesture.Exclusive(pan, tap);
  }, [numDays, fireHaptic, openDay, activeIndex, dragX]);

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

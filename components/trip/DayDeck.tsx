import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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
// Card size is unchanged — the visual hierarchy that works. Only the
// commit mechanics change in this pass.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.77), 340);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.3);
const CARD_STRIDE = Math.round(CARD_WIDTH * 0.11);
const STACK_DROP = 5;

// Lower threshold — commits trigger at 40% of a stride instead of 140%.
// Combined with rubber-band clamping, this means a short deliberate swipe
// commits cleanly while an aimless wiggle snaps back.
const SWIPE_THRESHOLD = CARD_STRIDE * 0.4;
const VELOCITY_THRESHOLD = 500;

// Commit spring — the NATURAL settle animation that runs after the atomic
// activeIndex update. No overshoot, no bounce — just a premium decelerating
// glide to the new rest position. This is what Revolut/Wallet feel like.
const COMMIT_SPRING = {
  damping: 26,
  stiffness: 180,
  mass: 0.9,
  overshootClamping: false,
  restDisplacementThreshold: 0.1,
  restSpeedThreshold: 1,
} as const;

// Snap-back spring for incomplete drags (lighter, a touch of bounce).
const SNAPBACK_SPRING = {
  damping: 20,
  stiffness: 200,
  mass: 0.9,
} as const;

// Maximum drag distance (absolute). Users can physically pull past this,
// but each pixel beyond gets exponentially damped, so the cards feel like
// they're on an elastic cord. Prevents the "dragged 300px then card slides
// backwards to STRIDE" problem the previous version had.
const DRAG_CLAMP = CARD_STRIDE * 1.4;

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

// Rubber-band resistance beyond the soft clamp. Linearly applied for 40px
// past the clamp, then asymptotic — users can physically pull further but
// each additional pixel does less and less.
function rubberBand(raw: number, clamp: number): number {
  'worklet';
  if (Math.abs(raw) <= clamp) return raw;
  const excess = Math.abs(raw) - clamp;
  const damped = (excess * 40) / (excess + 40);
  return Math.sign(raw) * (clamp + damped);
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
    let slot = dayIdx - activeIndex.value;
    const half = numDays / 2;
    if (slot > half) slot -= numDays;
    if (slot <= -half) slot += numDays;

    // Visual offset from center, continuous during drag and animations.
    // Critically: because the commit does an atomic `activeIndex += dir,
    // dragX += dir*STRIDE` swap, visualOffset stays continuous across the
    // commit — no jumps, no pops.
    const visualOffset = slot + dragX.value / CARD_STRIDE;
    const abs = Math.abs(visualOffset);

    // Anything past slot ±2.5 is invisible so wrap-around is seamless.
    if (abs > 2.5) {
      return {
        opacity: 0,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { scale: 0.7 },
          { rotateZ: '0deg' },
        ],
        zIndex: 0,
      };
    }

    const translateX = visualOffset * CARD_STRIDE;
    const translateY = abs * STACK_DROP;
    const scale = interpolate(abs, [0, 1, 2], [1, 0.86, 0.74], Extrapolation.CLAMP);
    const rotate = interpolate(
      visualOffset,
      [-2, -1, 0, 1, 2],
      [-5, -3, 0, 3, 5],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(abs, [0, 1, 2], [1, 0.68, 0.2], Extrapolation.CLAMP);
    const zIndex = Math.round(100 - abs * 10);

    return {
      transform: [
        { translateX },
        { translateY },
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

  // activeIndex lives in TWO places: a shared value for the worklet (atomic
  // UI-thread updates, no race) and React state for children that re-render
  // (dots, counter). The worklet is the source of truth; setState is an
  // after-the-fact echo for JS-visible children.
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
        // Apply rubber-band resistance beyond the soft clamp. This is why
        // the deck feels physical — you CAN drag past the commit point,
        // but each pixel past gets exponentially damped like an elastic.
        dragX.value = rubberBand(e.translationX, DRAG_CLAMP);
      })
      .onEnd((e) => {
        const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
        const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

        if ((past || fast) && numDays > 1) {
          // ── ATOMIC COMMIT ─────────────────────────────────────────
          // Instead of animating dragX to ±STRIDE (which can move BACKWARDS
          // if the user over-dragged), we do the commit as a single atomic
          // swap: increment activeIndex AND decrement dragX by one stride
          // in the commit direction. The math of visualOffset = slot +
          // dragX/STRIDE cancels, so every card's visual position is
          // EXACTLY identical before and after the swap. No pop.
          //
          // Then we spring dragX from its new (smaller) value to 0. The
          // cards settle into their new rest positions by continuing the
          // motion the user's finger already started. There is no moment
          // where the cards move backwards against the drag direction —
          // which is precisely what was making the old commit feel cheap.
          const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
          const newIdx = (activeIndex.value + dir + numDays) % numDays;
          activeIndex.value = newIdx;
          dragX.value = dragX.value + dir * CARD_STRIDE;
          dragX.value = withSpring(0, COMMIT_SPRING);
          runOnJS(setActiveIndexJS)(newIdx);
          runOnJS(fireHaptic)();
        } else {
          // Incomplete — spring back to rest.
          dragX.value = withSpring(0, SNAPBACK_SPRING);
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

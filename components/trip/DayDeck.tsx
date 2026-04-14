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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.74, 320);
const CARD_HEIGHT = Math.min(Math.round(CARD_WIDTH * 1.44), 500);
// Horizontal stride between adjacent card slots in the fan — the drag distance
// that corresponds to "one slot" of motion. Tuned so peek cards are visible but
// the front card clearly dominates.
const CARD_STRIDE = CARD_WIDTH * 0.56;

const SWIPE_THRESHOLD = CARD_STRIDE * 0.45;
const VELOCITY_THRESHOLD = 600;

// Render a 7-card window: 3 behind on each side plus the front card.
// Keeping the window wider than the visible area means cards never pop into
// existence when the user drags — there's always a card ready to take each slot.
const SLOT_RANGE = [-3, -2, -1, 0, 1, 2, 3] as const;

// Apple-style ease-out curve — quick initial acceleration, gentle settle.
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

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

interface DeckSlotProps {
  slot: number;
  day: DayDeckDay;
  image: DayImage;
  date?: string;
  place?: string;
  dragX: SharedValue<number>;
  isActive: boolean;
}

function DeckSlot({ slot, day, image, date, place, dragX, isActive }: DeckSlotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Fractional offset from center: negative = left of active, positive = right.
    // As the user drags right (dragX positive), every slot's effective offset
    // decreases, so the whole deck shifts right in lockstep with the finger.
    const offset = slot - dragX.value / CARD_STRIDE;
    const abs = Math.abs(offset);

    const translateX = offset * CARD_STRIDE;
    // Scale falls off smoothly with distance — front card is full size, each
    // slot out loses 6%. Clamped so far-off cards don't invert.
    const scale = interpolate(abs, [0, 3], [1, 0.8], Extrapolation.CLAMP);
    // Fan rotation: cards tilt outward from the center, symmetric around 0.
    const rotate = interpolate(offset, [-3, 0, 3], [-10, 0, 10], Extrapolation.CLAMP);
    // Opacity fades with distance — the front card is fully opaque, slot ±3
    // is nearly transparent so wrap-around transitions are invisible.
    const opacity = interpolate(abs, [0, 1, 2, 3], [1, 0.92, 0.65, 0], Extrapolation.CLAMP);
    // Higher zIndex on cards closer to center so the fan layers correctly
    // whether you swipe left or right.
    const zIndex = Math.round(100 - abs * 10);

    return {
      transform: [{ translateX }, { scale }, { rotateZ: `${rotate}deg` }],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View style={[styles.cardSlot, animatedStyle]} pointerEvents={isActive ? 'auto' : 'none'}>
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

function DayDeck({
  tripId,
  days,
  dayImages,
  tripHeroImage,
  tripStartDate,
  destination,
}: DayDeckProps) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const dragX = useSharedValue(0);

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
          // Commit: slide the deck one full stride in the swipe direction with
          // Apple-style cubic easing. When the slide finishes we advance the
          // active index and reset dragX to 0 *synchronously* — because the new
          // active index places cards exactly where they visually are right now,
          // the reset is invisible (no pop, no jump, no relayout flicker).
          const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
          const target = -dir * CARD_STRIDE;
          dragX.value = withTiming(
            target,
            { duration: 320, easing: COMMIT_EASING },
            (finished) => {
              if (finished) {
                runOnJS(advance)(dir);
                dragX.value = 0;
              }
            },
          );
        } else {
          // Incomplete swipe — a gentle spring back to rest. Slightly heavier
          // mass than default so it doesn't bounce aggressively.
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
  }, [numDays, advance, openDay, dragX]);

  if (numDays === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No itinerary available</Text>
      </View>
    );
  }

  const renderedSlots = numDays === 1 ? ([0] as const) : SLOT_RANGE;

  return (
    <View style={styles.container}>
      <View style={styles.counter}>
        <Text style={[styles.counterLabel, { color: colors.textMuted }]}>YOUR TRIP</Text>
        <Text style={[styles.counterValue, { color: colors.foreground }]}>
          {`${activeIndex + 1} / ${numDays}`}
        </Text>
      </View>

      <GestureDetector gesture={composedGesture}>
        <View style={styles.deckArea}>
          {renderedSlots.map((slot) => {
            const dayIdx = wrap(activeIndex + slot, numDays);
            const day = days[dayIdx];
            const image = dayImages[dayIdx] ?? tripHeroImage ?? null;
            return (
              <DeckSlot
                key={`${dayIdx}-${slot}`}
                slot={slot}
                day={day}
                image={image}
                place={pickPlace(day) ?? destination}
                date={formatDayDate(tripStartDate, dayIdx)}
                dragX={dragX}
                isActive={slot === 0}
              />
            );
          })}
        </View>
      </GestureDetector>

      <DayDeckDots count={numDays} activeIndex={activeIndex} />

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        swipe to flick through days · tap to open
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
    height: CARD_HEIGHT + 48,
    alignItems: 'center',
  },
  cardSlot: {
    position: 'absolute',
    top: 16,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    // horizontally centered via alignItems on deckArea; translateX animates from 0
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

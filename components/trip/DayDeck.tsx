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

  const composedGesture = useMemo(() => {
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
          const flyTo = dir === 1 ? -SCREEN_WIDTH : SCREEN_WIDTH;
          translationX.value = withTiming(flyTo, { duration: 220 }, (finished) => {
            if (finished) {
              runOnJS(advance)(dir);
              translationX.value = 0;
            }
          });
        } else {
          translationX.value = withSpring(0, { damping: 18, stiffness: 170 });
        }
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(10)
      .onEnd((_e, success) => {
        if (success) runOnJS(openDay)();
      });

    return Gesture.Exclusive(panGesture, tapGesture);
  }, [numDays, advance, openDay, translationX]);

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

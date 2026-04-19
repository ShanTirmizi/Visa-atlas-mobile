import React, { useState, useCallback } from 'react';
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
import { router } from 'expo-router';
import DayDeckCard, { type DayImage } from './DayDeckCard';
import { DAY_DECK_PHYSICS } from './DayDeck.constants';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { PillButton } from '@/components/ui/PillButton';

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
  activeIdxJS: number; // JS-side active index, used to compute integer offset
  dragX: SharedValue<number>;
  onCommit: (newIdx: number) => void;
  onTap: () => void;
  numDays: number;
}

function DeckCardItem({
  dayIdx,
  day,
  image,
  date,
  place,
  activeIdxJS,
  dragX,
  onCommit,
  onTap,
  numDays,
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
  tripHeroImage,
  tripStartDate,
  destination,
}: DayDeckProps) {
  const { colors } = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const dragX = useSharedValue(0);

  const numDays = days.length;

  const handleCommit = useCallback((newIdx: number) => {
    setActiveIdx(newIdx);
  }, []);

  const openDay = useCallback(() => {
    router.push(`/trip/${tripId}/day/${activeIdx}`);
  }, [tripId, activeIdx]);

  if (numDays === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.inkMute }]}>No itinerary available</Text>
      </View>
    );
  }

  // Only render cards within ±visibleSideCards of the active index
  const visibleRange = DAY_DECK_PHYSICS.visibleSideCards;
  const visibleCards = days
    .map((day, idx) => ({ day, idx }))
    .filter(({ idx }) => Math.abs(idx - activeIdx) <= visibleRange);

  return (
    <View style={styles.container}>
      {/* ── Card Deck ─────────────────────────────────────────────── */}
      <View style={styles.deckArea}>
        {visibleCards.map(({ day, idx }) => (
          <DeckCardItem
            key={idx}
            dayIdx={idx}
            day={day}
            image={dayImages[idx] ?? tripHeroImage ?? null}
            place={pickPlace(day) ?? destination}
            date={formatDayDate(tripStartDate, idx)}
            activeIdxJS={activeIdx}
            dragX={dragX}
            onCommit={handleCommit}
            onTap={openDay}
            numDays={numDays}
          />
        ))}
      </View>

      {/* ── Progress dots ─────────────────────────────────────────── */}
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
                    ? [styles.dotActive, { backgroundColor: colors.ink }]
                    : [styles.dotInactive, { backgroundColor: colors.inkFaint }],
                ]}
              />
            );
          })}
        </View>
      )}

      {/* ── Hint text ─────────────────────────────────────────────── */}
      <Text style={[Type.kickerSm, styles.hint, { color: colors.inkFaint }]}>
        Drag the centre card →
      </Text>

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      {/* Per spec: absolute bottom 30, left/right 22. In a scroll context we
          approximate with marginTop so it flows naturally below the hint. */}
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
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 30,
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

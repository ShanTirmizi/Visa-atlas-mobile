import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { hapticImpact } from '@/utils/haptics';
import TypingDots from '@/components/ui/TypingDots';

type TweakInstruction = 'relaxed' | 'rainy' | 'swap-evening';

const CHIPS: { instruction: TweakInstruction; label: string }[] = [
  { instruction: 'relaxed', label: 'More relaxed' },
  { instruction: 'rainy', label: 'Rainy-day version' },
  { instruction: 'swap-evening', label: 'Swap the evening' },
];

interface DayTweakChipsProps {
  tripId: Id<'trips'>;
  /** 0-based day index — matches the server's `itinerary-day:${dayIndex}` key. */
  dayIndex: number;
  /** True while `trip.retryingSections` contains this day's rewrite key. */
  isRewriting: boolean;
}

/**
 * One-tap day rewrites — mono kicker + three soft coral chips that fire the
 * `tripGeneration.tweakDay` mutation. While the server rewrite is in flight
 * the chip row is replaced by a quiet "Rewriting this day…" pill (TypingDots);
 * the day content itself updates reactively via the live trip query.
 */
export function DayTweakChips({ tripId, dayIndex, isRewriting }: DayTweakChipsProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const tweakDay = useMutation(api.tripGeneration.tweakDay);

  // Optimistic cover for the round-trip gap: the pill shows the instant a
  // chip is tapped, before `retryingSections` lands on the live query.
  // Cleared when the server state takes over (or the mutation fails).
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (isRewriting) setPending(false);
  }, [isRewriting]);

  const onChip = useCallback(
    (instruction: TweakInstruction) => {
      hapticImpact();
      setPending(true);
      tweakDay({ tripId, dayIndex, instruction }).catch(() => {
        setPending(false);
        showToast('error', "Couldn't tweak this day.");
      });
    },
    [tweakDay, tripId, dayIndex, showToast],
  );

  const busy = isRewriting || pending;

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          Type.kickerSm,
          { color: colors.inkMute, fontSize: 9, letterSpacing: 9 * 0.18 },
        ]}
      >
        TWEAK THIS DAY
      </Text>

      {busy ? (
        <View style={[styles.rewritingPill, { backgroundColor: colors.coralBg }]}>
          <TypingDots color={colors.coralDeep} size="sm" />
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 14,
              fontWeight: '500',
              letterSpacing: -14 * 0.012,
              color: colors.coralDeep,
            }}
          >
            Rewriting this day…
          </Text>
        </View>
      ) : (
        <View style={styles.chipRow}>
          {CHIPS.map((chip) => (
            <Pressable
              key={chip.instruction}
              onPress={() => onChip(chip.instruction)}
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              hitSlop={4}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: colors.coralBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: FontFamily.semibold,
                  fontSize: 13,
                  letterSpacing: -0.1,
                  color: colors.coralDeep,
                }}
              >
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default DayTweakChips;

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  // Soft pill — bg tint + coloured text carry the state (no leading dot).
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  rewritingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 10,
  },
});

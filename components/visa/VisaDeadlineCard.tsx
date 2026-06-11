import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import type { VisaCategory } from '@/data/visaData';
import {
  deriveVisaDeadline,
  buildDeadlineCopy,
  type DeadlineStatus,
} from '@/utils/visaDeadline';

interface Props {
  /** Effective category after streamed-first resolution (the Visa tab's `c`).
   *  Only 'visa-required' / 'evisa' need action ahead of travel — everything
   *  else renders nothing. */
  category: VisaCategory;
  /** Trip start date, 'YYYY-MM-DD'. Dreaming trips (no date) render nothing. */
  startDate?: string;
  /** Streamed trip.visaProcessingTime — preferred (passport-aware). */
  processingTime?: string;
  /** Static country.processingTime — fallback when the streamed value is
   *  missing or unparseable. If neither parses, nothing renders. */
  fallbackProcessingTime?: string;
}

/**
 * "Apply by" deadline card for the trip Visa tab. Sits under the visa hero
 * card. deadline = startDate − (processing days + 14-day buffer); all the
 * date math lives in utils/visaDeadline.ts where it's unit-tested.
 *
 * Urgency is carried by bg tint + coloured text only (soft-pill rule — no
 * leading dots, no countdown timers):
 *   calm (>21d) — teal tints · soon (≤21d) — coral · overdue — danger.
 */
export function VisaDeadlineCard({
  category,
  startDate,
  processingTime,
  fallbackProcessingTime,
}: Props) {
  const { colors } = useTheme();

  const info = useMemo(
    () => deriveVisaDeadline({ startDate, processingTime, fallbackProcessingTime }),
    [startDate, processingTime, fallbackProcessingTime],
  );

  if (category !== 'visa-required' && category !== 'evisa') return null;
  if (!info) return null;

  const copy = buildDeadlineCopy(info);

  const palette: Record<DeadlineStatus, { bg: string; accent: string }> = {
    calm: { bg: colors.tealBg, accent: colors.teal },
    soon: { bg: colors.coralBg, accent: colors.coralDeep },
    overdue: { bg: colors.dangerBg, accent: colors.danger },
  };
  const { bg, accent } = palette[info.status];

  return (
    <View
      style={[styles.card, { backgroundColor: bg, borderColor: colors.line }]}
      accessibilityRole="text"
      accessibilityLabel={`${copy.kicker}: ${copy.headline}. ${copy.sub}`}
    >
      <Text style={[styles.kicker, { color: accent }]}>{copy.kicker}</Text>
      <Text style={[styles.headline, { color: colors.ink }]}>
        <Text style={styles.headlineItalic}>{copy.headline}</Text>
        <Text style={{ color: accent }}>.</Text>
      </Text>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>{copy.sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 10 * 0.22,
    marginBottom: 6,
  },
  headline: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: -28 * 0.022,
  },
  headlineItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
});

export default VisaDeadlineCard;

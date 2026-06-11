/**
 * PassportStats — the travel-record header above the stamp wall.
 *
 * Matches the onboarding "YOUR ACCESS" metrics card exactly
 * (app/onboarding/building.tsx summary state): big italic Fraunces numerals
 * with the coral period, mono caps labels beneath, hairline dividers between
 * the three columns, surface card with a subtle lift.
 *
 * The numeral inks rotate through the same three stamp inks the wall uses —
 * teal / coral-deep / ink — so the stats read as part of the same document.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';

interface PassportStatsProps {
  countries: number;
  days: number;
  trips: number;
}

function StatItem({
  value,
  label,
  valueColor,
}: {
  value: number;
  label: string;
  valueColor: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: valueColor }]}>
        {value}
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Text style={[styles.statLabel, { color: colors.inkMute }]}>{label}</Text>
    </View>
  );
}

export function PassportStats({ countries, days, trips }: PassportStatsProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        Shadows.subtle,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <StatItem value={countries} label={countries === 1 ? 'COUNTRY' : 'COUNTRIES'} valueColor={colors.teal} />
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <StatItem value={days} label={days === 1 ? 'DAY AWAY' : 'DAYS AWAY'} valueColor={colors.coralDeep} />
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
      <StatItem value={trips} label={trips === 1 ? 'TRIP' : 'TRIPS'} valueColor={colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -32 * 0.022,
    fontWeight: '500',
  },
  statLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.22,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
});

export default PassportStats;

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { localInfo } from '@/data/localInfo';
import { countryMeta } from '@/data/countryMeta';

interface Props {
  /** Trip country ISO-3 code. */
  countryCode: string;
  /** Called when the user taps "View all tips →" — wire it to setActiveTab('Tips')
   *  on the trip detail screen so the user lands on the in-trip Tips tab. */
  onViewAll?: () => void;
}

/** Compact 4-cell strip on the trip Overview surface — emergency number,
 *  language, currency, tap-water status pulled from the curated data
 *  layer. Routes to /country/{code} for the full Tips tab. */
export function LocalEssentialsCard({ countryCode, onViewAll }: Props) {
  const { colors } = useTheme();

  const local = localInfo[countryCode] ?? null;
  const meta = countryMeta[countryCode] ?? null;
  if (!local && !meta) return null;

  const emergency = local?.emergencyNumber ?? local?.policeNumber ?? '—';
  const language = meta?.language ?? '—';
  const currency = meta?.currencyCode ?? meta?.currency ?? '—';
  const water =
    local?.tapWater === 'safe'
      ? 'Safe'
      : local?.tapWater === 'unsafe'
      ? 'Unsafe'
      : 'Bottled';

  const cells: { label: string; value: string }[] = [
    { label: 'EMERGENCY', value: emergency },
    { label: 'LANGUAGE', value: language },
    { label: 'CURRENCY', value: currency },
    { label: 'TAP WATER', value: water },
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.kicker,
            { color: colors.inkMute, letterSpacing: 10 * 0.22 },
          ]}
        >
          LOCAL ESSENTIALS
        </Text>
        <Pressable onPress={onViewAll} hitSlop={6} disabled={!onViewAll}>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 13,
              color: colors.coral,
            }}
          >
            View all tips →
          </Text>
        </Pressable>
      </View>

      <View style={styles.cellsRow}>
        {cells.map((cell, i) => (
          <View
            key={cell.label}
            style={[
              styles.cell,
              i > 0 && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: colors.line,
                paddingLeft: 12,
              },
            ]}
          >
            <Text
              style={[
                styles.cellLabel,
                { color: colors.inkMute, letterSpacing: 9 * 0.22 },
              ]}
              numberOfLines={1}
            >
              {cell.label}
            </Text>
            <Text
              style={[
                styles.cellValue,
                { color: colors.ink },
              ]}
              numberOfLines={1}
            >
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default LocalEssentialsCard;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  cellsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cell: {
    flex: 1,
    paddingRight: 4,
  },
  cellLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.85,
    marginBottom: 4,
  },
  cellValue: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -16 * 0.014,
  },
});

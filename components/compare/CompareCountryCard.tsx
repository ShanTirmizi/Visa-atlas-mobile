import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';

export interface CompareCountryData {
  name: string;
  flagCode: string;
  visaCategory: Cat;
  photoTone?: string;
  photoUri?: string;
  stats: Array<[string, string]>;
}

interface CompareCountryCardProps {
  country: CompareCountryData;
}

export function CompareCountryCard({ country }: CompareCountryCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      <View style={styles.flagSection}>
        <Flag code={country.flagCode} size={56} />
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: '500',
            letterSpacing: -17 * 0.012,
            color: colors.ink,
            marginTop: 10,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {country.name}
        </Text>
        <VisaBadge cat={country.visaCategory} size="sm" style={{ marginTop: 6 }} />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.line }]} />

      <View style={styles.statsCol}>
        {country.stats.map(([label, value], i) => (
          <View
            key={i}
            style={[
              styles.statRow,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.line,
              },
            ]}
          >
            <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
              {label.toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 14,
                fontWeight: '500',
                color: colors.ink,
              }}
              numberOfLines={1}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  flagSection: {
    alignItems: 'center',
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  statsCol: {
    paddingHorizontal: 14,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
});

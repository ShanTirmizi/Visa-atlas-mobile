import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import { Type } from '@/constants/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompareCountryData {
  name: string;
  flagCode: string;          // ISO-3166-1 alpha-2 (e.g. 'JP', 'TH')
  visaCategory: Cat;
  // photoTone kept for API compat but ignored — no photo placeholders
  photoTone?: string;
  photoUri?: string;
  stats: Array<[string, string]>; // exactly 4 tuples: [label, value]
}

interface CompareCountryCardProps {
  country: CompareCountryData;
}

// ─── Component ───────────────────────────────────────────────────────────────

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
      {/* Flag identity section */}
      <View style={styles.flagSection}>
        <Flag code={country.flagCode} size={56} style={styles.flag} />
        <Text style={[Type.title14, { color: colors.ink, marginTop: 8 }]} numberOfLines={2}>
          {country.name}
        </Text>
        <VisaBadge cat={country.visaCategory} size="sm" style={{ marginTop: 6 }} />
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.line }]} />

      {/* Stats grid — 2×2 */}
      <View style={styles.statsGrid}>
        {country.stats.map(([label, value], i) => (
          <View key={i} style={styles.stat}>
            <Text style={[Type.meta10_5, { color: colors.inkMute }]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[Type.title14, { color: colors.ink, marginTop: 2 }]} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 14,
  },

  flagSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },

  flag: {
    // Flag itself is sized by the Flag component
  },

  divider: {
    height: 1,
    marginHorizontal: 12,
    marginBottom: 12,
  },

  // Stats grid — 2 columns
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  stat: {
    width: '43%',
    flexGrow: 1,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Heart, MapPin, Thermometer } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { PillButton } from '@/components/ui/PillButton';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { StatStrip } from '@/components/ui/StatStrip';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge } from '@/components/ui/Badge';
import type { Cat } from '@/components/ui/Badge';

export interface FeaturedCountryProps {
  country: {
    code: string;      // ISO-3 (identity for parent)
    iso2?: string;     // ISO-2 for flag rendering
    name: string;
    region: string;
    tagline?: string;
    temperature?: string;
    visaCategory: Cat;
    stats: Array<{ label: string; value: string }>;
    saved?: boolean;
  };
  onViewDetails: () => void;
  onToggleSave: () => void;
}

export function FeaturedCountryCard({
  country,
  onViewDetails,
  onToggleSave,
}: FeaturedCountryProps) {
  const { colors } = useTheme();
  const iso2 = (country.iso2 ?? country.code).toUpperCase();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
        Shadows.cardRaised,
      ]}
    >
      {/* ── Header: big flag + name + region + visa ───────────────── */}
      <View style={styles.header}>
        <Flag code={iso2} size={72} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[Type.display26, { color: colors.ink }]} numberOfLines={1}>
            {country.name}
          </Text>
          <View style={styles.regionRow}>
            <MapPin size={12} color={colors.inkMute} strokeWidth={2} />
            <Text
              style={[Type.body12_5, { color: colors.inkMute, marginLeft: 4 }]}
              numberOfLines={1}
            >
              {country.region}
              {country.tagline ? ` · ${country.tagline}` : ''}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            <VisaBadge cat={country.visaCategory} size="sm" />
            {country.temperature ? (
              <View style={styles.tempChip}>
                <Thermometer size={11} color={colors.inkMute} strokeWidth={2} />
                <Text
                  style={[
                    Type.meta11,
                    { color: colors.inkMute, marginLeft: 4 },
                  ]}
                >
                  {country.temperature}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Hairline divider */}
      <View style={[styles.hr, { backgroundColor: colors.line }]} />

      {/* ── Stats ─────────────────────────────────────────────────── */}
      {country.stats.length > 0 ? (
        <View style={styles.statsWrap}>
          <StatStrip stats={country.stats.slice(0, 3)} />
        </View>
      ) : null}

      {/* ── Action row ────────────────────────────────────────────── */}
      <View style={styles.actionRow}>
        <PillButton
          label="View details"
          onPress={onViewDetails}
          variant="primary"
          style={styles.viewBtn}
        />
        <CircleBtn
          size={46}
          solid
          onPress={onToggleSave}
          accessibilityLabel={country.saved ? 'Remove from saved' : 'Save country'}
        >
          <Heart
            size={18}
            color={country.saved ? colors.danger : colors.inkMute}
            fill={country.saved ? colors.danger : 'transparent'}
            strokeWidth={2}
          />
        </CircleBtn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: 16,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  tempChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  hr: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  statsWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.lg,
    paddingTop: 14,
  },
  viewBtn: {
    flex: 1,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Photo, PhotoTone } from '@/components/ui/Photo';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, Cat } from '@/components/ui/Badge';
import { Type } from '@/constants/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompareCountryData {
  name: string;
  flagCode: string;          // ISO-3166-1 alpha-2 (e.g. 'JP', 'TH')
  visaCategory: Cat;
  photoTone?: PhotoTone;
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
      {/* Photo header (120px) */}
      <View style={styles.photoContainer}>
        <Photo
          uri={country.photoUri}
          tone={country.photoTone ?? 'stone'}
          style={styles.photo}
        />

        {/* Gradient overlay — bottom dark fade (two-layer scrim) */}
        <View style={styles.gradientScrim} pointerEvents="none" />

        {/* Country name + flag — absolute bottom-left */}
        <View style={styles.photoLabel}>
          <Flag code={country.flagCode} size={14} />
          <Text style={styles.countryName} numberOfLines={1}>
            {country.name}
          </Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.body}>
        {/* Visa badge */}
        <VisaBadge cat={country.visaCategory} size="sm" />

        {/* Stats */}
        <View style={styles.stats}>
          {country.stats.map(([label, value], i) => (
            <View key={i} style={styles.stat}>
              <Text style={[Type.meta10_5, { color: colors.inkMute }]}>
                {label}
              </Text>
              <Text style={[Type.title14, { color: colors.ink, marginTop: 1 }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
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
  },

  // Photo section
  photoContainer: {
    height: 120,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  gradientScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    // covers the bottom 60% of the photo, darkening it enough for legible white text
    top: '40%',
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  // Overlay dark scrim — bottom half gets darker
  photoLabel: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 15 * -0.02,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Body
  body: {
    padding: 12,
  },
  stats: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  stat: {
    flexDirection: 'column',
  },
});

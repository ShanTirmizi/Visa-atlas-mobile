import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Globe, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { Photo, PhotoTone } from '@/components/ui/Photo';
import { GlassPill } from '@/components/ui/GlassPill';
import { PillButton } from '@/components/ui/PillButton';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { StatStrip } from '@/components/ui/StatStrip';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge } from '@/components/ui/Badge';
import type { Cat } from '@/components/ui/Badge';

export interface FeaturedCountryProps {
  country: {
    code: string;
    name: string;
    region: string;
    tagline?: string;
    temperature?: string;
    visaCategory: Cat;
    photoUri?: string;
    photoTone?: PhotoTone;
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

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        Shadows.cardRaised,
      ]}
    >
      {/* Hero photo — 240px */}
      <View style={styles.photoWrapper}>
        <Photo
          uri={country.photoUri}
          tone={country.photoTone ?? 'stone'}
          style={StyleSheet.absoluteFill}
        />

        {/* Dark scrim — top→bottom */}
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.0)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* GlassPills */}
        {country.temperature ? (
          <GlassPill style={styles.pillTopRight}>
            {country.temperature}
          </GlassPill>
        ) : null}

        <GlassPill
          icon={<Globe size={11} color="#FFFFFF" strokeWidth={2} />}
          style={styles.pillBottomRight}
        >
          {country.region}
        </GlassPill>
      </View>

      {/* Content below photo */}
      <View style={styles.content}>
        {/* Title row */}
        <Text style={[Type.display26, { color: colors.ink }]} numberOfLines={1}>
          {country.name}
        </Text>

        {/* Flag + tagline + visa badge */}
        <View style={styles.metaRow}>
          <Flag code={country.code.slice(0, 2)} size={20} />
          {country.tagline ? (
            <Text
              style={[Type.body12_5, { color: colors.inkMute, flex: 1 }]}
              numberOfLines={1}
            >
              {country.tagline}
            </Text>
          ) : null}
          <VisaBadge cat={country.visaCategory} size="sm" />
        </View>

        {/* Stats */}
        {country.stats.length > 0 ? (
          <StatStrip stats={country.stats.slice(0, 3)} />
        ) : null}

        {/* Action row */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
  },
  photoWrapper: {
    height: 240,
    overflow: 'hidden',
  },
  pillTopRight: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  pillBottomRight: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 18,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  viewBtn: {
    flex: 1,
  },
});

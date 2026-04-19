import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Photo, PhotoTone } from '@/components/ui/Photo';
import { GlassPill } from '@/components/ui/GlassPill';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuideHeroData {
  title: string;
  author: string;
  readMin: number;
  tone?: PhotoTone;
  uri?: string;
  category?: string;
}

interface GuideHeroProps {
  guide: GuideHeroData;
  onPress?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GuideHero({ guide, onPress }: GuideHeroProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.container}
    >
      {/* Background photo */}
      <Photo
        uri={guide.uri}
        tone={guide.tone ?? 'mountain'}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Bottom-dark gradient scrim — two stacked views */}
      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />

      {/* Category pill — top-left */}
      <View style={styles.pillContainer}>
        <GlassPill>{guide.category ?? 'Essay'}</GlassPill>
      </View>

      {/* Bottom text block */}
      <View style={styles.textBlock}>
        <Text style={styles.meta}>
          {guide.readMin} min read · by {guide.author}
        </Text>
        <Text style={styles.title} numberOfLines={3}>
          {guide.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.card,
  },

  // Gradient scrim layers — top layer transparent, bottom opaque dark
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // covers top 15% — transparent effectively (just a placeholder for stack)
    height: '15%',
    backgroundColor: 'transparent',
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    // covers bottom 85% with a graduated dark overlay
    top: '15%',
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Category pill
  pillContainer: {
    position: 'absolute',
    top: 14,
    left: 14,
  },

  // Bottom text
  textBlock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 11 * 0.02,
    lineHeight: 11 * 1.5,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 22 * 1.15,
    letterSpacing: 22 * -0.025,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '700',
  },
});

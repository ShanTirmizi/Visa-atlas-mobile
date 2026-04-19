import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, MapPin } from 'lucide-react-native';
import { Photo } from '@/components/ui/Photo';
import { GlassPill } from '@/components/ui/GlassPill';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';

interface TripOverviewHeroProps {
  tripName: string;
  cityName: string;
  heroImageUrl?: string;
  duration?: number;
}

export function TripOverviewHero({
  tripName,
  cityName,
  heroImageUrl,
  duration,
}: TripOverviewHeroProps) {
  const durationLabel = duration ? `${duration}-day itinerary` : 'Itinerary';

  return (
    <View style={[styles.container, Shadows.card]}>
      <Photo
        uri={heroImageUrl}
        tone="sunset"
        radius={26}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Bottom-dark gradient: covers 75% from bottom, transparent above 40% */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.72)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Top-right: weather pill */}
      <View style={styles.topRight}>
        <GlassPill icon={<Sun size={13} color="#FFFFFF" />}>
          21° Sunny
        </GlassPill>
      </View>

      {/* Bottom row: left content + right city pill */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomLeft}>
          <Text style={[Type.kickerSm, styles.kickerText]}>
            {durationLabel}
          </Text>
          <Text style={[Type.display24, styles.tripNameText]} numberOfLines={2}>
            {tripName}
          </Text>
        </View>
        <GlassPill icon={<MapPin size={12} color="#FFFFFF" />}>
          {cityName}
        </GlassPill>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 26,
    overflow: 'hidden',
    marginHorizontal: 22,
    marginBottom: 14,
  },
  topRight: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bottomLeft: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  kickerText: {
    color: 'rgba(255,255,255,0.75)',
  },
  tripNameText: {
    color: '#FFFFFF',
  },
});

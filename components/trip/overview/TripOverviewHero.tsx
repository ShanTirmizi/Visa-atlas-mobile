import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, MapPin } from 'lucide-react-native';
import { Photo } from '@/components/ui/Photo';
import { Type } from '@/constants/typography';
import { Shadows, FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

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
}: TripOverviewHeroProps) {
  const { colors } = useTheme();

  // Pull last word out for italic emphasis ("Indonesia." → italic period)
  const words = tripName.split(/\s+/);
  const head = words.slice(0, -1).join(' ');
  const tail = words.length > 1 ? words[words.length - 1] : tripName;

  return (
    <View style={[styles.container, Shadows.card]}>
      <Photo
        uri={heroImageUrl}
        tone="sunset"
        radius={22}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.18)', 'transparent', 'rgba(0,0,0,0.58)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Top-left: warm white weather pill with coral sun */}
      <View style={styles.topLeft}>
        <View style={styles.weatherPill}>
          <Sun size={12} color={colors.coral} fill={colors.coral} />
          <Text
            style={{
              fontFamily: FontFamily.semibold,
              fontSize: 11,
              fontWeight: '600',
              color: colors.ink,
            }}
          >
            21°C · clear
          </Text>
        </View>
      </View>

      {/* Top-right: glass city pill */}
      <View style={styles.topRight}>
        <View style={styles.cityPill}>
          <MapPin size={12} color="#FFFFFF" />
          <Text
            style={{
              fontFamily: FontFamily.semibold,
              fontSize: 11,
              fontWeight: '600',
              color: '#FFFFFF',
            }}
          >
            {cityName}
          </Text>
        </View>
      </View>

      {/* Bottom: kicker + italic destination + coral period */}
      <View style={styles.bottom}>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 1.62,
            color: 'rgba(255,255,255,0.92)',
            textTransform: 'uppercase',
          }}
        >
          YOUR DESTINATION
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 30,
            fontWeight: '500',
            letterSpacing: -30 * 0.02,
            color: '#FFFFFF',
            marginTop: 2,
            lineHeight: 32,
          }}
          numberOfLines={2}
        >
          {head ? `${head} ` : ''}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
            }}
          >
            {tail}
          </Text>
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 14,
  },
  topLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  topRight: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottom: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
});

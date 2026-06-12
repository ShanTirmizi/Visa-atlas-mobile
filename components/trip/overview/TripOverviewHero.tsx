import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, MapPin, Images } from 'lucide-react-native';
import { Photo } from '@/components/ui/Photo';
import { Type } from '@/constants/typography';
import { Shadows, FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { cityTemperatures } from '@/data/temperatureData';

interface TripOverviewHeroProps {
  tripName: string;
  cityName: string;
  heroImageUrl?: string;
  duration?: number;
  /** Trip-album size — shows the photos pill (under the city pill) when > 1. */
  photoCount?: number;
  /** Opens the trip's full-screen photo album (hero tap or pill tap). */
  onOpenPhotos?: () => void;
}

/**
 * Real average-high temperature for the destination this month, or null.
 * `cityName` is the trip's capital (trip.capital is set from
 * countryMeta[code].capital — see utils/dayPlaces.ts), which is exactly the
 * key cityTemperatures uses. Same recipe as the Atlas explore label.
 * No data → no pill; we never invent weather conditions.
 */
function getMonthlyTemperature(cityName: string): number | null {
  const temps = cityTemperatures[cityName];
  if (!temps) return null;
  const temp = temps[new Date().getMonth()];
  return typeof temp === 'number' ? temp : null;
}

export function TripOverviewHero({
  tripName,
  cityName,
  heroImageUrl,
  photoCount,
  onOpenPhotos,
}: TripOverviewHeroProps) {
  const { colors } = useTheme();
  const temperature = getMonthlyTemperature(cityName);

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

      {/* Whole hero opens the trip album (Airbnb listing-hero behaviour);
          the overlay pills are plain Views so taps fall through to this. */}
      {onOpenPhotos ? (
        <Pressable
          onPress={onOpenPhotos}
          accessibilityRole="imagebutton"
          accessibilityLabel={`View ${photoCount ?? ''} trip photos`}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Top-left: warm white weather pill with coral sun — real monthly
          average high for the destination. Rendered only when we have data;
          we never fabricate conditions we don't know. */}
      {temperature != null && (
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
              {`${temperature}°`}
            </Text>
          </View>
        </View>
      )}

      {/* Top-right: glass city pill, photos pill stacked beneath it */}
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
        {onOpenPhotos && (photoCount ?? 0) > 1 ? (
          <Pressable
            onPress={onOpenPhotos}
            accessibilityRole="button"
            accessibilityLabel={`View all ${photoCount} trip photos`}
            hitSlop={6}
            style={({ pressed }) => [styles.photosPill, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Images size={12} color="#FFFFFF" strokeWidth={2.2} />
            <Text
              style={{
                fontFamily: FontFamily.semibold,
                fontSize: 11,
                fontWeight: '600',
                color: '#FFFFFF',
              }}
            >
              {photoCount}
            </Text>
          </Pressable>
        ) : null}
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
    alignItems: 'flex-end',
    gap: 6,
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
  photosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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

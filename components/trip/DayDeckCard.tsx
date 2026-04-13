import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;

export interface DayDeckCardProps {
  dayNumber: number;
  title: string;
  place?: string;
  date?: string;
  image: DayImage;
  showContent?: boolean;
}

function DayDeckCard({
  dayNumber,
  title,
  place,
  date,
  image,
  showContent = false,
}: DayDeckCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
      {image?.url ? (
        <ImageBackground
          source={{ uri: image.url }}
          style={StyleSheet.absoluteFill}
          imageStyle={styles.image}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.25, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Text style={[styles.placeholderDay, { color: colors.textMuted }]}>
            {`DAY ${dayNumber}`}
          </Text>
        </View>
      )}

      {showContent && (
        <>
          <View style={styles.topRow}>
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeText}>{`DAY ${dayNumber}`}</Text>
            </View>
            {date ? (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>{date.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottom}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {place ? (
              <View style={styles.placeRow}>
                <MapPin size={12} color="#FFFFFF" />
                <Text style={styles.placeText} numberOfLines={1}>
                  {place}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

export default React.memo(DayDeckCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  image: {
    borderRadius: Radius.xl,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderDay: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 48,
    letterSpacing: 2,
  },
  topRow: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayBadge: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dayBadgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#1A1A1A',
    letterSpacing: 0.6,
  },
  datePill: {
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  datePillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  bottom: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 30,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  placeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    opacity: 0.95,
  },
});

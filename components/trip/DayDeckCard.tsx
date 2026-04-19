import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { MapPin, ArrowUpRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

export type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;

export interface DayDeckCardProps {
  dayNumber: number;
  title: string;
  place?: string;
  date?: string;
  image: DayImage;
}

function DayDeckCard({ dayNumber, title, place, date, image }: DayDeckCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, Shadows.cardRaised, { backgroundColor: colors.card }]}>
      {/* ── Photo region (top ~62%) ───────────────────────────────── */}
      <View style={[styles.photoRegion, { backgroundColor: colors.backgroundDeep }]}>
        {image?.url ? (
          <ImageBackground
            source={{ uri: image.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}

        {/* DAY N badge — near-opaque white pill, always legible on any photo.
            The rgba value below is the plan-sanctioned photo-overlay exception. */}
        <View style={styles.dayBadge}>
          <Text style={[styles.dayBadgeText, { color: colors.textOnLight }]}>
            {`DAY ${dayNumber}`}
          </Text>
        </View>
      </View>

      {/* ── Content region (bottom ~26%) ──────────────────────────── */}
      <View style={styles.content}>
        <View style={styles.textBlock}>
          {date ? (
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
              {date.toUpperCase()}
            </Text>
          ) : null}
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {title}
          </Text>
          {place ? (
            <View style={styles.placeRow}>
              <MapPin size={12} color={colors.textMuted} />
              <Text
                style={[styles.placeText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {place}
              </Text>
            </View>
          ) : null}
        </View>

        {/* "See day" pill — purely visual; DayDeck's Tap gesture handles the tap */}
        <View style={styles.buttonRow}>
          <View style={[styles.seeDayButton, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.seeDayText, { color: colors.background }]}>See day</Text>
            <View style={[styles.seeDayIcon, { backgroundColor: colors.background }]}>
              <ArrowUpRight size={12} color={colors.foreground} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default React.memo(DayDeckCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  photoRegion: {
    flex: 74,
    position: 'relative',
  },
  dayBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dayBadgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.7,
  },
  content: {
    flex: 26,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  textBlock: {
    gap: 1,
  },
  dateLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  title: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: -0.3,
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
    flexShrink: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  seeDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 24,
  },
  seeDayText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  seeDayIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

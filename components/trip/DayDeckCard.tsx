import React from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';

export type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;

export interface DayDeckCardProps {
  dayNumber: number;
  title: string;
  place?: string;
  date?: string;
  image: DayImage;
  stops?: number;
  /** Tap handler for the inline edit pencil — small floating button in
   *  the bottom-right corner of the card. */
  onEdit?: () => void;
}

function DayDeckCard({ dayNumber, title, place, date, image, stops, onEdit }: DayDeckCardProps) {
  const { colors } = useTheme();
  const dayLabel = String(dayNumber).padStart(2, '0');

  return (
    <View style={[styles.card, Shadows.cardRaised, { backgroundColor: colors.card }]}>
      {/* ── Photo region (top ~60%) ───────────────────────────────── */}
      <View style={[styles.photoRegion, { backgroundColor: colors.backgroundDeep }]}>
        {image?.url ? (
          <ImageBackground
            source={{ uri: image.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}

        {/* Subtle bottom darken so any title bleeding into the photo
            stays readable on busy images. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              top: '55%',
              backgroundColor: 'rgba(0,0,0,0.18)',
            },
          ]}
        />

        {/* DAY · NN — rotated coral passport stamp (top-left) */}
        <View
          style={styles.stampWrap}
          pointerEvents="none"
        >
          <View
            style={[
              styles.stampOuter,
              { borderColor: colors.coralDeep },
            ]}
          >
            <View
              style={[
                styles.stampInner,
                { borderColor: colors.coralDeep },
              ]}
            />
            <Text
              style={[
                styles.stampText,
                { color: colors.coralDeep, letterSpacing: 11 * 0.22 },
              ]}
            >
              DAY · {dayLabel}
            </Text>
          </View>
        </View>

        {/* Stops count — glass dark pill, top-right */}
        {typeof stops === 'number' && stops > 0 ? (
          <View style={styles.stopsPill}>
            <Text style={styles.stopsText}>{stops} stops</Text>
          </View>
        ) : null}
      </View>

      {/* ── Content region (bottom ~40%) ──────────────────────────── */}
      <View style={styles.content}>
        {/* Date kicker with a small coral leading dot */}
        {date ? (
          <View style={styles.kickerRow}>
            <View
              style={[styles.kickerDot, { backgroundColor: colors.coral }]}
            />
            <Text
              style={[
                styles.kickerText,
                { color: colors.inkMute, letterSpacing: 10 * 0.22 },
              ]}
              numberOfLines={1}
            >
              {date.toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* Italic Fraunces title with coral period */}
        <Text
          style={[
            styles.title,
            {
              color: colors.ink,
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {title}
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>

        {/* Coral squiggle under the title — signature accent */}
        <View style={{ marginTop: 6, marginBottom: place ? 8 : 0 }}>
          <Squiggle width={50} color={colors.coral} />
        </View>

        {/* Place — mono caps, tighter letter-spacing */}
        {place ? (
          <Text
            style={[
              styles.placeText,
              { color: colors.inkMute, letterSpacing: 10 * 0.18 },
            ]}
            numberOfLines={1}
          >
            {place.toUpperCase()}
          </Text>
        ) : null}

        {/* Floating edit pencil — bottom-right, small, only when handler given.
            (The 'Open Day' affordance is the big button below the deck — no
            duplicate inline chip.) */}
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            accessibilityLabel={`Edit Day ${dayNumber}`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.editChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.lineMid,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Pencil size={14} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default React.memo(DayDeckCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  photoRegion: {
    flex: 60,
    position: 'relative',
  },

  // Rotated coral passport stamp
  stampWrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    transform: [{ rotate: '-4deg' }],
  },
  stampOuter: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 5,
    borderWidth: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    position: 'relative',
  },
  stampInner: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 0.75,
    borderRadius: 3,
    opacity: 0.55,
  },
  stampText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },

  // Stops pill (glass dark, top-right)
  stopsPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  stopsText: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Content region
  content: {
    flex: 40,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    position: 'relative',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kickerText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -22 * 0.018,
    fontWeight: '500',
  },
  placeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
  },

  // Floating edit pencil
  editChip: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

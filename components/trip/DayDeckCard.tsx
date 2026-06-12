import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BorderlessButton } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { useQuery, useMutation } from 'convex/react';
import { Pencil, Heart, Images } from 'lucide-react-native';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';
import { hapticSelect } from '@/utils/haptics';

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
  /** When true, renders a blinking coral cursor at the end of the title
   *  text — used on the day card currently being written during streaming
   *  generation. */
  showCursor?: boolean;
  /** Convex trip id — when present, the card shows the day-vote heart pill
   *  (bottom-right of the photo). Vote rows use activityId `day-<index>`,
   *  where index = dayNumber - 1 (the server stamps day = idx + 1). */
  tripId?: string;
  /** Size of this day's photo album — shows the photos pill (bottom-left
   *  of the photo) when > 1. The single card photo IS the album at 1. */
  photoCount?: number;
  /** Opens the day's full-screen photo album. */
  onOpenPhotos?: () => void;
}

// ── Day-vote heart pill ──────────────────────────────────────────────
// Frosted-glass chip on photography (Apple Maps / Photos chip pattern):
// Heart icon + up-vote count for this day, shared live across all
// collaborators on the trip. Tapping toggles YOUR vote. Solo planners can
// vote too — the pill stays visually quiet (just the heart) at zero votes.
function DayVotePill({ tripId, dayNumber }: { tripId: string; dayNumber: number }) {
  const { colors } = useTheme();
  const activityId = `day-${dayNumber - 1}`;

  const votes = useQuery(api.tripVotes.getVotesForTrip, {
    tripId: tripId as Id<'trips'>,
  });
  // getVotesForTrip returns raw rows (incl. userId); the viewer's own id
  // comes from the profile query so we can mark "my vote" with a fill.
  const profile = useQuery(api.userProfiles.getCurrentProfile);
  const toggleVote = useMutation(api.tripVotes.toggleVote);

  const upVotes = (votes ?? []).filter(
    (v) => v.activityId === activityId && v.vote === 'up',
  );
  const voted =
    profile != null && upVotes.some((v) => v.userId === profile.userId);

  const handleToggle = () => {
    hapticSelect();
    // Server toggles: same vote exists → delete; none → insert 'up'.
    toggleVote({
      tripId: tripId as Id<'trips'>,
      activityId,
      vote: 'up',
    }).catch(() => {});
  };

  return (
    // BorderlessButton (RNGH native button) claims the touch on press-in,
    // which cancels the deck's outer Tap gesture (open day) — the documented
    // RNGH pattern for touchables inside a GestureDetector, same as buttons
    // inside Swipeable rows. A plain RN Pressable here would race the deck
    // tap and fire both.
    <BorderlessButton
      onPress={handleToggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={
        voted
          ? `Remove your vote for Day ${dayNumber}`
          : `Vote for Day ${dayNumber}`
      }
      style={styles.votePillWrap}
    >
      <BlurView tint="systemMaterial" intensity={80} style={styles.votePill}>
        <Heart
          size={13}
          color={colors.coral}
          fill={voted ? colors.coral : 'none'}
          strokeWidth={2.2}
        />
        {upVotes.length > 0 ? (
          <Text style={[styles.votePillCount, { color: colors.ink }]}>
            {upVotes.length}
          </Text>
        ) : null}
      </BlurView>
    </BorderlessButton>
  );
}

// Thin coral bar that blinks at ~2.2 Hz; placed inline at the end of the
// day-card title on the currently-streaming day during generation.
function StreamingCursor() {
  const { colors } = useTheme();
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withTiming(0, { duration: 450, easing: Easing.steps(2) }),
      -1,
      true,
    );
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        {
          width: 1.5,
          height: 14,
          backgroundColor: colors.coral,
          marginLeft: 2,
          alignSelf: 'center',
        },
        s,
      ]}
    />
  );
}

function DayDeckCard({ dayNumber, title, place, date, image, stops, onEdit, showCursor, tripId, photoCount, onOpenPhotos }: DayDeckCardProps) {
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

        {/* Day-vote heart pill — frosted chip, bottom-right of the photo */}
        {tripId ? <DayVotePill tripId={tripId} dayNumber={dayNumber} /> : null}

        {/* Photos pill — frosted chip, bottom-left, opens the day album.
            BorderlessButton for the same claim-the-touch reason as the
            vote pill (a Pressable would race the deck's tap gesture). */}
        {onOpenPhotos && (photoCount ?? 0) > 1 ? (
          <BorderlessButton
            onPress={onOpenPhotos}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`View ${photoCount} photos for Day ${dayNumber}`}
            style={styles.photosPillWrap}
          >
            <BlurView tint="systemMaterial" intensity={80} style={styles.photosPill}>
              <Images size={13} color={colors.ink} strokeWidth={2.2} />
              <Text style={[styles.photosPillCount, { color: colors.ink }]}>
                {photoCount}
              </Text>
            </BlurView>
          </BorderlessButton>
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

        {/* Italic Fraunces title with coral period — fixed size, 2-line wrap.
            (Previously used adjustsFontSizeToFit which shrunk long titles
            below the place line, inverting the hierarchy.)
            When `showCursor` is true (the day is mid-streaming), a thin
            blinking coral bar sits inline after the period — wrap in a row
            so the animated <View> sits on the text baseline. */}
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: colors.ink,
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                flexShrink: 1,
              },
            ]}
            numberOfLines={2}
          >
            {title}
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          {showCursor ? <StreamingCursor /> : null}
        </View>

        {/* Coral squiggle under the title — signature accent */}
        <View style={{ marginTop: 6, marginBottom: place ? 8 : 0 }}>
          <Squiggle width={50} color={colors.coral} />
        </View>

        {/* Place — mono caps, tighter letter-spacing */}
        {place ? (
          <Text
            style={[
              styles.placeText,
              { color: colors.inkMute, letterSpacing: 11 * 0.14 },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -24 * 0.018,
    fontWeight: '500',
  },
  placeText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
  },

  // Day-vote heart pill (frosted, bottom-right of photo region)
  votePillWrap: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 999,
    // Clips the BlurView to the pill shape. Frosted chips don't carry a
    // drop shadow, so clipping on the same view is safe here (the iOS
    // shadow-clipping split rule applies to shadowed cards only).
    overflow: 'hidden',
  },
  votePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  votePillCount: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  // Photos pill (frosted, bottom-left of photo region — mirrors votePill)
  photosPillWrap: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  photosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  photosPillCount: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
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

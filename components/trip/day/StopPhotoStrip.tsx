import React, { useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Photo } from '@/components/ui/Photo';
import { useTheme } from '@/contexts/theme-context';

// ─────────────────────────────────────────────────────────────────
// StopPhotoStrip
//
// Horizontal row of real place photos for one timeline slot — the
// Apple Maps place-card photo row. Tiles bleed to the screen edge
// (scrolling photos slide under the sheet padding, not clip inside
// it) and open the day's full-screen album at the tapped photo.
// While the trip's stop photos are still being fetched, the slot
// shows StopPhotoStripSkeleton so the row reads as "loading", not
// "broken/empty" (App Store / Apple Photos pattern).
// ─────────────────────────────────────────────────────────────────

export interface StripPhoto {
  url: string;
  thumb?: string;
  /** Place name — accessibility label; the viewer caption shows it too. */
  name: string;
}

interface StopPhotoStripProps {
  photos: StripPhoto[];
  /** Left inset aligning the first tile with the slot's text column. */
  insetLeft: number;
  /** Horizontal padding of the parent scroll content the strip bleeds
   *  through — DayDetailScreen's sheet uses 22. */
  bleed?: number;
  onOpenPhoto: (url: string) => void;
}

const TILE = 76;

export function StopPhotoStrip({
  photos,
  insetLeft,
  bleed = 22,
  onOpenPhoto,
}: StopPhotoStripProps) {
  if (photos.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.strip, { marginHorizontal: -bleed }]}
      contentContainerStyle={[
        styles.content,
        { paddingLeft: bleed + insetLeft, paddingRight: bleed },
      ]}
    >
      {photos.map((p, i) => (
        <Pressable
          key={`${p.url}-${i}`}
          onPress={() => onOpenPhoto(p.url)}
          accessibilityRole="imagebutton"
          accessibilityLabel={`View photo of ${p.name}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Photo
            uri={p.thumb || p.url}
            radius={14}
            style={styles.tile}
            showPlaceholderGlyph={false}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Shimmer placeholder shown while trip.stopPhotos is still being fetched —
 *  same TILE geometry as the real strip, so the row doesn't jump when photos
 *  land. */
export function StopPhotoStripSkeleton({
  insetLeft,
  bleed = 22,
  count = 3,
}: {
  insetLeft: number;
  bleed?: number;
  count?: number;
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);
  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      style={[
        styles.strip,
        styles.skeletonRow,
        { marginHorizontal: -bleed, paddingLeft: bleed + insetLeft },
      ]}
      accessibilityLabel="Loading photos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={[styles.tile, styles.skeletonTile, { backgroundColor: colors.surfaceMuted }, animStyle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginTop: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skeletonTile: {
    borderRadius: 14,
  },
  content: {
    gap: 8,
  },
  tile: {
    width: TILE,
    height: TILE,
  },
});

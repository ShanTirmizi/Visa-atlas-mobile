import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { Photo } from '@/components/ui/Photo';

// ─────────────────────────────────────────────────────────────────
// StopPhotoStrip
//
// Horizontal row of real place photos for one timeline slot — the
// Apple Maps place-card photo row. Tiles bleed to the screen edge
// (scrolling photos slide under the sheet padding, not clip inside
// it) and open the day's full-screen album at the tapped photo.
// Renders nothing until the trip's stop photos land — the strip
// simply appears reactively, no skeleton.
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

const styles = StyleSheet.create({
  strip: {
    marginTop: 8,
  },
  content: {
    gap: 8,
  },
  tile: {
    width: TILE,
    height: TILE,
  },
});

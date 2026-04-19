import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';

export interface HighlightItem {
  label: string;
  dayStamp: string;
  imageUri?: string;
  tone?: PhotoTone;
}

interface HighlightsStripProps {
  items: HighlightItem[];
  onSeeAll?: () => void;
}

const TONES: PhotoTone[] = ['sunset', 'forest', 'ocean'];

export function HighlightsStrip({ items, onSeeAll }: HighlightsStripProps) {
  const { colors } = useTheme();

  if (items.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 110 }}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[Type.title14, { color: colors.ink }]}>Highlights</Text>
        <Pressable onPress={onSeeAll ?? undefined} hitSlop={8}>
          <Text style={[Type.body12_5, { color: colors.inkMute }]}>See all</Text>
        </Pressable>
      </View>

      {/* Card strip — 3 flex-1 cards side by side */}
      <View style={styles.strip}>
        {items.slice(0, 3).map((item, idx) => (
          <View key={idx} style={styles.cardWrapper}>
            <Photo
              uri={item.imageUri}
              tone={item.tone ?? TONES[idx % TONES.length]}
              radius={20}
              style={styles.card}
            >
              {/* Bottom-dark gradient overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.62)']}
                locations={[0.3, 1]}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              {/* Bottom content */}
              <View style={styles.cardContent}>
                <Text style={[Type.kickerSm, { color: 'rgba(255,255,255,0.60)' }]}>
                  {item.dayStamp}
                </Text>
                <Text style={[Type.title14, { color: '#FFFFFF' }]} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            </Photo>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  strip: {
    flexDirection: 'row',
    gap: 10,
  },
  cardWrapper: {
    flex: 1,
    minWidth: 0, // allow shrink
  },
  card: {
    height: 130,
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    gap: 2,
  },
});

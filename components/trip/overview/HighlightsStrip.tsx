import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Section } from '@/components/ui/Section';

export interface HighlightItem {
  label: string;
  dayStamp: string;
  imageUri?: string;
  tone?: PhotoTone;
  onPress?: () => void;
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
    <View style={{ paddingTop: 18, paddingBottom: 110 }}>
      {/* Editorial header */}
      <View style={styles.headerRow}>
        <Section
          kicker="HIGHLIGHTS"
          title="What's planned"
          squiggleWidth={90}
          size="md"
        />
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.teal, fontSize: 10, letterSpacing: 0.4 },
              ]}
            >
              SEE ALL
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Card strip — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {items.slice(0, 6).map((item, idx) => (
          <Pressable
            key={idx}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Photo
              uri={item.imageUri}
              tone={item.tone ?? TONES[idx % TONES.length]}
              radius={0}
              style={styles.cardPhoto}
            />
            <View style={styles.cardBody}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 13,
                  fontWeight: '500',
                  color: colors.ink,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <Text
                style={[
                  Type.kickerSm,
                  { color: colors.inkMute, marginTop: 2, fontSize: 9 },
                ]}
              >
                {item.dayStamp}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPhoto: {
    width: '100%',
    height: 86,
  },
  cardBody: {
    padding: 10,
  },
});

/**
 * HandPickedCard — decorative destination tile used in the empty-state
 * "Try one of these" horizontal row.
 *
 * Props:
 *   countryCode  ISO 3166-1 alpha-3 (e.g. "JPN") — used for the flag
 *   name         Display name (e.g. "Tokyo")
 *   tag          Mono uppercase caption (e.g. "CHERRY · APR")
 *   tone         'plum' | 'amber' | 'teal' — controls the gradient bg
 *   onPress      Tap handler
 */
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';

// ── Gradient stops per tone — decorative only, not booking colours ──────────
const TONE_COLORS = {
  plum:  ['#3B2A56', '#251742'] as const,
  amber: ['#C27535', '#7E4620'] as const,
  teal:  ['#0E4D47', '#07312C'] as const,
} as const;

export type HandPickedTone = keyof typeof TONE_COLORS;

interface HandPickedCardProps {
  countryCode: string;
  name: string;
  tag: string;
  tone: HandPickedTone;
  onPress: () => void;
}

export function HandPickedCard({
  countryCode,
  name,
  tag,
  tone,
  onPress,
}: HandPickedCardProps) {
  const [from, to] = TONE_COLORS[tone];
  const alpha2 = toAlpha2(countryCode);

  return (
    // Outer View carries the shadow without overflow:hidden clipping it
    <View style={styles.shadow}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top-left: flag */}
        <Flag code={alpha2} size={28} style={styles.flag} />

        {/* Bottom-left: italic name + mono tag */}
        <View style={styles.bottomBlock}>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 16,
              letterSpacing: -16 * 0.022,
              color: '#FFFFFF',
              lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={[
              Type.mono9,
              {
                color: 'rgba(255,255,255,0.80)',
                fontSize: 9,
                letterSpacing: 9 * 0.22,
                marginTop: 3,
              },
            ]}
            numberOfLines={1}
          >
            {tag}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const CARD_WIDTH = 110;
const CARD_HEIGHT = 140;

const styles = StyleSheet.create({
  shadow: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    // Warm shadow — outer wrapper has no overflow:hidden so iOS renders it
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 14,
    justifyContent: 'space-between',
  },
  flag: {
    // Flag size is 28, circle-clipped inside Flag component
  },
  bottomBlock: {
    gap: 0,
  },
});

export default HandPickedCard;

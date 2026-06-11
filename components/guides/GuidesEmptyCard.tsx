import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Path, Defs, Ellipse } from 'react-native-svg';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';

interface Props {
  onStart: () => void;
}

/** Empty state for the Guides tab — paper card with an open-passport
 *  illustration, NO APPLICATIONS · YET kicker, italic Fraunces "Every
 *  visa starts with a stamp." headline, coral squiggle, body copy, and
 *  a single full-width Start application pill. */
export function GuidesEmptyCard({ onStart }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          ...Shadows.subtle,
        },
      ]}
    >
      {/* Passport illustration */}
      <View style={styles.illustrationWrap}>
        <PassportIllustration coral={colors.coral} ink={colors.inkMute} surface={colors.surfaceMuted} />
      </View>

      {/* Kicker */}
      <Text
        style={[
          styles.kicker,
          { color: colors.coralDeep, letterSpacing: 11 * 0.22 },
        ]}
      >
        NO APPLICATIONS · YET
      </Text>

      {/* Italic title with coral period */}
      <Text style={[styles.title, { color: colors.ink }]}>
        Every visa{' '}
        <Text style={[styles.titleItalic]}>starts</Text>
        {' '}with a stamp
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>

      {/* Coral squiggle */}
      <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
        <Squiggle width={120} color={colors.coral} />
      </View>

      {/* Body */}
      <Text style={[styles.body, { color: colors.inkSoft }]}>
        Pick a country from{' '}
        <Text style={{ color: colors.teal, fontWeight: '600' }}>Atlas</Text>
        {' '}and tap{' '}
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
          }}
        >
          Start visa application
        </Text>
        . We’ll keep your guide right here.
      </Text>

      {/* Single full-width CTA */}
      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Start application"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.ink, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Plus size={16} color="#FFFFFF" strokeWidth={2.25} />
        <Text style={styles.ctaText}>Start application</Text>
      </Pressable>
    </View>
  );
}

/** SVG illustration of an open passport with a coral VISA stamp on the
 *  right page and a soft elliptical drop-shadow underneath. */
function PassportIllustration({
  coral,
  ink,
  surface,
}: {
  coral: string;
  ink: string;
  surface: string;
}) {
  return (
    <Svg width={180} height={150} viewBox="0 0 180 150">
      <Defs />

      {/* Soft elliptical ground shadow */}
      <Ellipse cx={90} cy={138} rx={60} ry={4} fill={ink} opacity={0.12} />

      {/* Left page */}
      <Rect
        x={26}
        y={20}
        width={62}
        height={108}
        rx={3}
        fill={surface}
        stroke={ink}
        strokeWidth={0.8}
        opacity={0.9}
      />
      {/* Left page lines */}
      <Line x1={36} y1={42} x2={78} y2={42} stroke={ink} strokeWidth={0.6} opacity={0.5} />
      <Line x1={36} y1={50} x2={70} y2={50} stroke={ink} strokeWidth={0.6} opacity={0.4} />
      <Line x1={36} y1={58} x2={74} y2={58} stroke={ink} strokeWidth={0.6} opacity={0.4} />

      {/* Spine — center seam */}
      <Line x1={90} y1={20} x2={90} y2={128} stroke={ink} strokeWidth={0.6} strokeDasharray="2 2" opacity={0.4} />

      {/* Right page */}
      <Rect
        x={92}
        y={20}
        width={62}
        height={108}
        rx={3}
        fill={surface}
        stroke={ink}
        strokeWidth={0.8}
        opacity={0.9}
      />

      {/* VISA stamp on right page — rotated rectangle */}
      <Rect
        x={104}
        y={56}
        width={42}
        height={28}
        rx={2}
        fill="none"
        stroke={coral}
        strokeWidth={1.4}
        transform="rotate(-6 125 70)"
        opacity={0.85}
      />
      {/* VISA text approximated as a bold coral stroke path — inline placement */}
      <Path
        d="M 113 73 L 116 79 L 120 73 M 124 73 L 124 79 M 124 73 L 130 73 M 124 76 L 128 76 M 124 79 L 130 79 M 134 79 L 138 73 L 142 79 M 146 73 L 146 79"
        fill="none"
        stroke={coral}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-6 125 70)"
        opacity={0.9}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: -28 * 0.022,
    textAlign: 'center',
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: -15 * 0.01,
  },
});

export default GuidesEmptyCard;

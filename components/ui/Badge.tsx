import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import type { ThemeColors } from '@/constants/theme';

export type Cat = 'free' | 'arrival' | 'evisa' | 'required';
export type BadgeSize = 'sm' | 'md' | 'lg';

const LABELS: Record<Cat, string> = {
  free: 'Visa-free',
  arrival: 'On arrival',
  evisa: 'E-visa',
  required: 'Required',
};

const SIZE: Record<BadgeSize, { padV: number; padH: number; fs: number; dot: number }> = {
  sm: { padV: 4, padH: 9, fs: 10, dot: 5 },
  md: { padV: 5, padH: 10, fs: 11, dot: 6 },
  lg: { padV: 7, padH: 13, fs: 12, dot: 7 },
};

interface Props {
  cat: Cat;
  size?: BadgeSize;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
}

function colorFor(cat: Cat, colors: ThemeColors): { dot: string; bg: string } {
  switch (cat) {
    case 'free':
      return { dot: colors.visaFree, bg: colors.visaFreeBg };
    case 'arrival':
      return { dot: colors.visaOnArrival, bg: colors.visaOnArrivalBg };
    case 'evisa':
      return { dot: colors.evisa, bg: colors.evisaBg };
    case 'required':
      return { dot: colors.visaRequired, bg: colors.visaRequiredBg };
  }
}

export function VisaBadge({ cat, size = 'md', onDark = false, style }: Props) {
  const { colors } = useTheme();
  const { dot, bg } = colorFor(cat, colors);
  const s = SIZE[size];

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: s.padV,
          paddingHorizontal: s.padH,
          borderRadius: 999,
          backgroundColor: onDark ? '#FFFFFF' : bg,
        },
        style,
      ]}
    >
      <View
        style={{ width: s.dot, height: s.dot, borderRadius: s.dot / 2, backgroundColor: dot }}
      />
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: s.fs,
          fontWeight: '600',
          color: onDark ? '#0E0E0E' : colors.ink,
        }}
      >
        {LABELS[cat]}
      </Text>
    </View>
  );
}

// Legacy default export — preserves `import Badge from '@/components/ui/Badge'`
export default VisaBadge;

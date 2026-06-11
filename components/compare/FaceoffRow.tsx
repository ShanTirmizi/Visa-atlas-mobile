import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';

/** A compact dual-flag disc showing two flags clipped side by side */
function DualFlag({ codeA, codeB, size = 32 }: { codeA: string; codeB: string; size?: number }) {
  const half = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* Left half — country A */}
      <View style={{ width: half, height: size, overflow: 'hidden' }}>
        <Flag code={toAlpha2(codeA)} size={size} />
      </View>
      {/* Right half — country B, shifted left by half so the right portion shows */}
      <View style={{ width: half, height: size, overflow: 'hidden' }}>
        <View style={{ marginLeft: -half }}>
          <Flag code={toAlpha2(codeB)} size={size} />
        </View>
      </View>
    </View>
  );
}

interface FaceoffRowProps {
  codeA: string;
  nameA: string;
  codeB: string;
  nameB: string;
  onOpen: () => void;
  hasDivider?: boolean;
}

export function FaceoffRow({
  codeA,
  nameA,
  codeB,
  nameB,
  onOpen,
  hasDivider = false,
}: FaceoffRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Compare ${nameA} vs ${nameB}`}
      style={({ pressed }) => [
        styles.container,
        hasDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
        },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {/* Left dual flag disc */}
      <DualFlag codeA={codeA} codeB={codeB} size={32} />

      {/* Country name row — italic Fraunces */}
      <View style={styles.labelBox}>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 15,
            fontWeight: '500',
            color: colors.ink,
            letterSpacing: -15 * 0.012,
          }}
          numberOfLines={1}
        >
          {nameA}{' '}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              color: colors.coral,
            }}
          >
            vs
          </Text>{' '}
          {nameB}
        </Text>
      </View>

      {/* Right dual flag disc (visual rhythm mirror) */}
      <DualFlag codeA={codeA} codeB={codeB} size={28} />

      {/* OPEN pill */}
      <Pressable
        onPress={onOpen}
        style={[
          styles.openPill,
          { backgroundColor: colors.surfaceMuted },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${nameA} vs ${nameB} comparison`}
      >
        <Text
          style={[
            styles.openPillText,
            { color: colors.inkSoft },
          ]}
        >
          OPEN
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  labelBox: {
    flex: 1,
    overflow: 'hidden',
  },
  openPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  openPillText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

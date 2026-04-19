import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';

interface Stat {
  label: string;
  value: string;
}

interface StatStripProps {
  stats: Stat[];
  divided?: boolean; // show hairline dividers between cells
}

// Spec: 3 cells flex 1 each, background surfaceMuted, radius 16–18, label/value stacked,
// Inter 500/10.5 inkMute uppercase label, Inter 600/16 ink value
export function StatStrip({ stats, divided = true }: StatStripProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderLeftWidth: divided && i > 0 ? 1 : 0,
            borderLeftColor: colors.line,
          }}
        >
          <Text style={[Type.meta10_5, { color: colors.inkMute }]}>{s.label}</Text>
          <Text style={[Type.title17, { color: colors.ink, marginTop: 2, letterSpacing: -17 * 0.02, fontSize: 16 }]}>
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

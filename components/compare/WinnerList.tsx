import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Type } from '@/constants/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WinnerRow {
  label: string;
  winner: string;
}

interface WinnerListProps {
  winners: WinnerRow[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WinnerList({ winners }: WinnerListProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <SectionKicker>WINNER BY CATEGORY</SectionKicker>

      <View style={styles.rows}>
        {winners.map((row, i) => (
          <View
            key={i}
            style={[
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.line,
              },
            ]}
          >
            <Text style={[Type.body12_5, { color: colors.inkSoft, flex: 1 }]}>
              {row.label}
            </Text>
            <Text style={[Type.title14, { color: colors.ink }]}>
              {row.winner}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    // padding is applied by the parent screen
  },
  rows: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
});

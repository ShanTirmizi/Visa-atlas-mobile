import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import {
  VISA_CATEGORIES,
  getVisaCategoryColor,
  type VisaCategoryConfig,
} from '@/constants/categories';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ──────────────────────────────────────────────
// MapLegend
// A small floating legend at the bottom of the map
// showing colored dots with visa category labels.
// ──────────────────────────────────────────────

const DOT_SIZE = 10;

export function MapLegend() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glass,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {VISA_CATEGORIES.map((cat: VisaCategoryConfig) => {
        const dotColor = getVisaCategoryColor(cat.key, colors);
        return (
          <View key={cat.key} style={styles.item}>
            <View
              style={[
                styles.dot,
                { backgroundColor: dotColor },
              ]}
            />
            <Text
              style={[
                styles.label,
                { color: colors.foreground },
              ]}
              numberOfLines={1}
            >
              {cat.shortLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  label: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
  },
});

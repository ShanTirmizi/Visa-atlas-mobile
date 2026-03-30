import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

interface ChipProps {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}

export default function Chip({ label, color, active, onPress }: ChipProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        active
          ? { backgroundColor: color, ...(Shadows.glow(color, 0.25)) }
          : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
      ]}
    >
      {!active && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text
        style={[
          styles.label,
          { color: active ? '#FFFFFF' : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs + 2,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Radius } from '@/constants/theme';

interface PillSelectorProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor: string;
}

export default function PillSelector({
  options,
  selected,
  onSelect,
  accentColor,
}: PillSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <TouchableOpacity
            key={option}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? accentColor : colors.surfaceLight,
                borderColor: isActive ? accentColor : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
  },
});

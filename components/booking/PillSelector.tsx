import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
                backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
                borderColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? accentColor : '#FFFFFF' },
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

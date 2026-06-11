import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';

interface PillSelectorProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  /** Coral by default — kept as a prop so callers can theme it later. */
  accentColor?: string;
}

/** Compact pill row for one-of-N choices (Class, Room type, Car type, etc).
 *  Paper-bg friendly: inactive pills are surfaceMuted with ink text; the
 *  active pill is filled in coral with white text. Italic Fraunces label. */
export default function PillSelector({
  options,
  selected,
  onSelect,
  accentColor,
}: PillSelectorProps) {
  const { colors } = useTheme();
  const tint = accentColor ?? colors.coral;

  // Selection haptic only on an actual change — re-pressing the active
  // pill stays silent (Apple HIG: selection feedback).
  const handleSelect = (option: string) => {
    if (option !== selected) hapticSelect();
    onSelect(option);
  };

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => handleSelect(option)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isActive ? tint : colors.surfaceMuted,
                borderColor: isActive ? tint : colors.line,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 13,
                fontWeight: '500',
                letterSpacing: -13 * 0.012,
                color: isActive ? '#FFFFFF' : colors.ink,
              }}
            >
              {option}
            </Text>
          </Pressable>
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
    marginTop: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
});

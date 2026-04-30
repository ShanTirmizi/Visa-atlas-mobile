import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';

interface Props {
  prompt: string;
  options: string[];
  multiSelect: boolean;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function RefinementChoiceCard({
  prompt,
  options,
  multiSelect,
  selected,
  onChange,
}: Props) {
  const { colors } = useTheme();

  const toggle = (option: string) => {
    if (multiSelect) {
      onChange(
        selected.includes(option)
          ? selected.filter((s) => s !== option)
          : [...selected, option],
      );
    } else {
      onChange(selected.includes(option) ? [] : [option]);
    }
  };

  return (
    <View>
      <Text style={[Type.body14, { color: colors.ink, marginBottom: 12 }]}>
        {prompt}
      </Text>
      <View style={styles.chipGrid}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          if (multiSelect) {
            return (
              <Pressable
                key={option}
                onPress={() => toggle(option)}
                style={[
                  styles.multiChip,
                  {
                    backgroundColor: isSelected ? colors.coral : 'transparent',
                    borderColor: isSelected ? colors.coral : colors.lineMid,
                  },
                ]}
              >
                {isSelected && (
                  <Check
                    size={14}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={{
                    fontFamily: FontFamily.semibold,
                    fontSize: 13,
                    color: isSelected ? '#FFFFFF' : colors.inkSoft,
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            );
          }
          // single-select — coral squiggle under active
          return (
            <Pressable
              key={option}
              onPress={() => toggle(option)}
              style={[
                styles.singleChip,
                {
                  borderColor: colors.lineMid,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: FontFamily.semibold,
                  fontSize: 13,
                  color: isSelected ? colors.ink : colors.inkSoft,
                }}
              >
                {option}
              </Text>
              {isSelected && (
                <View pointerEvents="none" style={styles.squiggleHolder}>
                  <Squiggle
                    width={26}
                    height={5}
                    strokeWidth={2}
                    color={colors.coral}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  multiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  singleChip: {
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  squiggleHolder: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

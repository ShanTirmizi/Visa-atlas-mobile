import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';

interface Props {
  prompt: string;
  options: string[];
  multiSelect: boolean;
  selected: string[];
  onChange: (selected: string[]) => void;
  /** 1-indexed position of this question (e.g. 1, 2, 3). */
  stepIndex: number;
  /** Total number of questions in the refinement set. */
  stepTotal: number;
}

export function RefinementChoiceCard({
  prompt,
  options,
  multiSelect,
  selected,
  onChange,
  stepIndex,
  stepTotal,
}: Props) {
  const { colors } = useTheme();

  const toggle = (option: string) => {
    hapticSelect();
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          shadowColor: '#1F1A14',
        },
      ]}
    >
      <Text
        style={[
          styles.kicker,
          { color: colors.coralDeep },
        ]}
      >
        {stepIndex} of {stepTotal}
      </Text>
      <Text
        style={[
          Type.title17,
          {
            color: colors.ink,
            marginBottom: 18,
            lineHeight: 24,
          },
        ]}
      >
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
                style={({ pressed }) => [
                  styles.chip,
                  styles.chipMultiActive,
                  {
                    backgroundColor: isSelected ? colors.coral : colors.surface,
                    borderColor: isSelected ? colors.coral : colors.lineMid,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                    shadowColor: colors.coralDeep,
                    shadowOpacity: isSelected ? 0.22 : 0,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: isSelected ? 3 : 0,
                  },
                ]}
              >
                {isSelected && (
                  <Check
                    size={14}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                )}
                <Text
                  style={{
                    fontFamily: FontFamily.semibold,
                    fontSize: 14,
                    letterSpacing: -0.1,
                    color: isSelected ? '#FFFFFF' : colors.inkSoft,
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            );
          }
          // Single-select — decisive dark-ink fill (Apple-style answer state).
          return (
            <Pressable
              key={option}
              onPress={() => toggle(option)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.ink : colors.surface,
                  borderColor: isSelected ? colors.ink : colors.lineMid,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  shadowColor: colors.ink,
                  shadowOpacity: isSelected ? 0.18 : 0,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: isSelected ? 2 : 0,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: FontFamily.semibold,
                  fontSize: 14,
                  letterSpacing: -0.1,
                  color: isSelected ? '#FFFFFF' : colors.inkSoft,
                }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 10.5 * 0.18,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipMultiActive: {
    // Layout shared with `chip`; placeholder for any multi-specific overrides.
  },
});

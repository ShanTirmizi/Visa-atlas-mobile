import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily, Radius } from '@/constants/theme';

const MAX_LENGTH = 200;

interface Props {
  prompt: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** 1-indexed position of this question (e.g. 1, 2, 3). */
  stepIndex: number;
  /** Total number of questions in the refinement set. */
  stepTotal: number;
}

export function RefinementTextCard({
  prompt,
  placeholder,
  value,
  onChangeText,
  stepIndex,
  stepTotal,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder ?? 'Type your answer'}
        placeholderTextColor={colors.inkMute}
        multiline
        scrollEnabled
        maxLength={MAX_LENGTH}
        style={[
          Type.body14,
          styles.input,
          {
            backgroundColor: colors.warmBg,
            borderColor: focused ? colors.coral : 'transparent',
            borderRadius: Radius.md,
            color: colors.ink,
          },
        ]}
      />
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
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    maxHeight: 22 * 4,
  },
});

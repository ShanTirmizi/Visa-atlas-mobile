import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius } from '@/constants/theme';

const MAX_LENGTH = 200;

interface Props {
  prompt: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
}

export function RefinementTextCard({
  prompt,
  placeholder,
  value,
  onChangeText,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={[Type.body14, { color: colors.ink, marginBottom: 12 }]}>
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
            backgroundColor: colors.surface,
            borderColor: focused ? colors.coralGlow : colors.line,
            borderRadius: Radius.md,
            color: colors.ink,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    maxHeight: 22 * 4,
  },
});

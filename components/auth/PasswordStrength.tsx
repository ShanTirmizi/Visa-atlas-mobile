import React from 'react';
import { View, Text } from 'react-native';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface Props {
  password: string;
}

/** Returns 0..4 strength score + a feedback string. */
export function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; feedback: string } {
  if (!pw) return { score: 0, feedback: 'Use at least 8 characters' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = Math.min(s, 4) as 0 | 1 | 2 | 3 | 4;
  const feedback =
    score === 0 ? 'Use at least 8 characters'
    : score === 1 ? 'Add upper + lower case'
    : score === 2 ? 'Add a number'
    : score === 3 ? 'Add a number or symbol'
    : 'Strong password';
  return { score, feedback };
}

export function PasswordStrength({ password }: Props) {
  const { colors } = useTheme();
  const { score, feedback } = scorePassword(password);

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < score ? colors.coral : colors.line,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9.5,
            fontWeight: '700',
            color: colors.inkMute,
            letterSpacing: 9.5 * 0.22,
          }}
        >
          STRENGTH
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 13,
            color: score >= 4 ? colors.success : colors.coralDeep,
          }}
        >
          {feedback}
        </Text>
      </View>
    </View>
  );
}

export default PasswordStrength;

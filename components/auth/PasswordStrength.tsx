import React from 'react';
import { View, Text } from 'react-native';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface Props {
  password: string;
}

/** Returns 0..4 strength score + a feedback string that names what is
 *  actually missing (not what the score happens to be). */
export function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; feedback: string } {
  if (!pw) return { score: 0, feedback: 'Use at least 8 characters' };

  const hasLength = pw.length >= 8;
  const hasUpperAndLower = /[A-Z]/.test(pw) && /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);

  const score = ((hasLength ? 1 : 0)
    + (hasUpperAndLower ? 1 : 0)
    + (hasDigit ? 1 : 0)
    + (hasSymbol ? 1 : 0)) as 0 | 1 | 2 | 3 | 4;

  const missing: string[] = [];
  if (!hasLength) missing.push('8+ characters');
  if (!hasUpperAndLower) missing.push('upper + lower case');
  if (!hasDigit) missing.push('a number');
  if (!hasSymbol) missing.push('a symbol');

  let feedback: string;
  if (missing.length === 0) {
    feedback = 'Strong password';
  } else if (missing.length === 1) {
    feedback = `Add ${missing[0]}`;
  } else if (missing.length === 2) {
    feedback = `Add ${missing[0]} and ${missing[1]}`;
  } else {
    feedback = `Add ${missing.slice(0, -1).join(', ')}, and ${missing[missing.length - 1]}`;
  }

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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

interface VerdictCardProps {
  text: string;
}

export function VerdictCard({ text }: VerdictCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.ink },
      ]}
    >
      {/* Open quote + VERDICT kicker */}
      <View style={styles.topRow}>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 28,
            lineHeight: 28,
            color: colors.coral,
            // Optical nudge up
            marginTop: -4,
          }}
        >
          {'“'}
        </Text>
        <Text style={[styles.kicker, { color: colors.coral }]}>
          VERDICT
        </Text>
      </View>

      {/* Verdict body — italic Fraunces white */}
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 17,
          fontWeight: '500',
          lineHeight: 26,
          color: '#FFFFFF',
          marginTop: 10,
          letterSpacing: -17 * 0.012,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

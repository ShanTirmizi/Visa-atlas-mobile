import React from 'react';
import { View, Text } from 'react-native';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface PullQuoteProps {
  tip: string;
  attribution?: string;
}

/** Dark ink card with coral kicker + italic Fraunces tip — passport-stamp feel. */
export function PullQuote({ tip, attribution }: PullQuoteProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        marginTop: 18,
        backgroundColor: colors.ink,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <Text
        style={[
          Type.kickerSm,
          {
            color: colors.coral,
            fontSize: 9,
            letterSpacing: 9 * 0.18,
          },
        ]}
      >
        LOCAL TIP
      </Text>
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 14,
          fontWeight: '500',
          color: '#FFFFFF',
          marginTop: 6,
          lineHeight: 20,
        }}
      >
        &#8220;{tip}&#8221;
      </Text>
      {attribution ? (
        <Text
          style={[
            Type.kickerSm,
            {
              color: 'rgba(255,255,255,0.6)',
              marginTop: 8,
              fontSize: 9,
              letterSpacing: 9 * 0.14,
            },
          ]}
        >
          {`— ${attribution.toUpperCase()}`}
        </Text>
      ) : null}
    </View>
  );
}

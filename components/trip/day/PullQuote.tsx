import React from 'react';
import { View, Text } from 'react-native';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';

interface PullQuoteProps {
  tip: string;
}

export function PullQuote({ tip }: PullQuoteProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: colors.ink,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <SectionKicker color="rgba(255,255,255,0.55)">Local Tip</SectionKicker>
      <Text
        style={[
          Type.body14,
          {
            color: '#FFFFFF',
            lineHeight: 14 * 1.45,
            marginTop: 6,
          },
        ]}
      >
        {tip}
      </Text>
    </View>
  );
}

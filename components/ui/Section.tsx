import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';
import { Squiggle } from './Squiggle';

interface SectionProps {
  kicker: string;
  title: string;
  italicWord?: string;
  trailing?: string;
  squiggleWidth?: number;
  squiggleColor?: string;
  italicAll?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

export function Section({
  kicker,
  title,
  italicWord,
  trailing,
  squiggleWidth = 110,
  squiggleColor,
  italicAll = true,
  size = 'md',
  style,
}: SectionProps) {
  const { colors } = useTheme();
  const titleStyle = size === 'lg' ? Type.display26 : Type.display22;
  const titleItalicStyle = size === 'lg' ? Type.display26Italic : Type.display22Italic;

  return (
    <View style={[{ flexDirection: 'column', gap: 4 }, style]}>
      <Text style={[Type.kicker, { color: colors.inkMute }]}>{kicker}</Text>
      <Text style={[italicAll ? titleItalicStyle : titleStyle, { color: colors.ink }]}>
        {italicWord ? (
          <>
            <Text style={[titleStyle, { color: colors.ink }]}>{title} </Text>
            <Text style={[titleItalicStyle, { color: colors.ink }]}>{italicWord}</Text>
          </>
        ) : (
          title
        )}
        {trailing ? (
          <Text style={[titleStyle, { color: colors.coral }]}>{trailing}</Text>
        ) : null}
      </Text>
      <Squiggle width={squiggleWidth} color={squiggleColor ?? colors.coral} />
    </View>
  );
}

export default Section;

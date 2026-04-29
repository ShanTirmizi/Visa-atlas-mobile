import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';

interface SectionKickerProps {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function SectionKicker({ children, color, style }: SectionKickerProps) {
  const { colors } = useTheme();
  return (
    <Text style={[Type.kicker, { color: color ?? colors.inkMute }, style]}>
      {children}
    </Text>
  );
}

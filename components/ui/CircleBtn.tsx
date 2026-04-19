import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Shadows } from '@/constants/theme';

interface CircleBtnProps {
  size?: number;
  solid?: boolean; // true = solid surface; false = glass
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
}

// Spec: 38px default, white glass (rgba(255,255,255,0.92)), 1px border rgba(255,255,255,0.3),
// shadow 0 4px 14px rgba(0,0,0,0.10)
export function CircleBtn({
  size = 38,
  solid = true,
  onPress,
  children,
  style,
  hitSlop = 8,
  accessibilityLabel,
}: CircleBtnProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: solid ? colors.surface : 'rgba(255,255,255,0.92)',
          borderWidth: 1,
          borderColor: solid ? colors.line : 'rgba(255,255,255,0.30)',
          opacity: pressed ? 0.85 : 1,
          ...Shadows.circle,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

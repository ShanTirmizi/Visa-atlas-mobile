import React from 'react';
import { Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';

interface PillButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'soft' | 'ghost';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}

// Spec: primary = ink bg + white text, soft = surfaceMuted bg + ink text,
// radius 999, padding 16 vertical / 20 horizontal (or flex), Inter 600/14.5
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  fullWidth = false,
}: PillButtonProps) {
  const { colors } = useTheme();

  const bg =
    variant === 'primary' ? colors.ink :
    variant === 'soft' ? colors.surfaceMuted :
    'transparent';

  const fg =
    variant === 'primary' ? '#FFFFFF' : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: bg,
          borderRadius: 999,
          paddingVertical: 14,
          paddingHorizontal: 20,
          opacity: pressed ? 0.88 : 1,
          ...(fullWidth ? { alignSelf: 'stretch' } : {}),
        },
        style,
      ]}
    >
      {icon}
      <Text style={[Type.body14_5, { color: fg, fontWeight: '600', letterSpacing: -14.5 * 0.01 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

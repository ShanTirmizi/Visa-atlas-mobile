import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Shadows } from '@/constants/theme';

interface DarkOrbProps {
  size?: number;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean; // true = surfaceMuted bg, no shadow (inline nav orb)
  accessibilityLabel?: string;
}

// Spec: 52 default (FAB), 40–44 inline, background #0E0E0E or surfaceMuted,
// shadow 0 10px 24px rgba(0,0,0,0.22) for FAB, none for muted.
export function DarkOrb({
  size = 52,
  onPress,
  children,
  style,
  muted = false,
  accessibilityLabel,
}: DarkOrbProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: muted ? '#EDEDEB' : '#0E0E0E',
          opacity: pressed ? 0.88 : 1,
          ...(muted ? {} : Shadows.orb),
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

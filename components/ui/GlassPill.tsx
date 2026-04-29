import React from 'react';
import { View, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Type } from '@/constants/typography';

interface GlassPillProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// Frosted pill for floating over photography.
// Spec: rgba(255,255,255,0.22) bg + blur(20) saturate(160%) + 1px rgba(255,255,255,0.28)
//       + shadow 0 4px 14px rgba(0,0,0,0.12), Inter 500 / 11.5 / white
export function GlassPill({ children, icon, style, textStyle }: GlassPillProps) {
  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[
        {
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
          backgroundColor: 'rgba(255,255,255,0.22)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 14,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          Type.meta11_5,
          { color: '#FFFFFF' },
          textStyle,
        ]}
      >
        {children as any}
      </Text>
    </BlurView>
  );
}

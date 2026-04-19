import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

export type PhotoTone =
  | 'warm' | 'forest' | 'ocean' | 'sunset' | 'stone'
  | 'plum' | 'night' | 'mist' | 'gold' | 'mountain';

const TONE_COLORS: Record<PhotoTone, [string, string]> = {
  warm: ['#8B5A3C', '#6B3E26'],
  forest: ['#2C3E2E', '#1C2C1E'],
  ocean: ['#2E3F4A', '#1C2832'],
  sunset: ['#8B4A2E', '#6B3520'],
  stone: ['#5C5C5C', '#3D3D3D'],
  plum: ['#5A3A5E', '#3E2842'],
  night: ['#1A2238', '#0E1424'],
  mist: ['#8C8C8C', '#6E6E6E'],
  gold: ['#8B6F2E', '#6B5420'],
  mountain: ['#4A5A6A', '#2E3A48'],
};

interface PhotoProps {
  uri?: string;
  tone?: PhotoTone;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}

export function Photo({
  uri,
  tone = 'stone',
  radius = 0,
  style,
  children,
  testID,
}: PhotoProps) {
  const [a, b] = TONE_COLORS[tone];
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: b,
          borderRadius: radius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {uri ? (
        <ExpoImage
          source={{ uri }}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          contentFit="cover"
          transition={200}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        // Two-tone placeholder: linear gradient approximation using two absolute
        // views. Visual stand-in until real imagery is available.
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '50%', backgroundColor: a }} />
          <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, bottom: 0, backgroundColor: b }} />
        </>
      )}
      {children}
    </View>
  );
}

import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { FontFamily } from '@/constants/theme';

interface PassportStampProps {
  label: string;
  date: string;
  color: string;
  rotation?: number;
  style?: StyleProp<ViewStyle>;
}

export function PassportStamp({ label, date, color, rotation = -3, style }: PassportStampProps) {
  return (
    <View style={[{ transform: [{ rotate: `${rotation}deg` }] }, style]}>
      <View
        style={{
          paddingTop: 10,
          paddingBottom: 8,
          paddingHorizontal: 16,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 10,
          opacity: 0.92,
          position: 'relative',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            right: 3,
            bottom: 3,
            borderWidth: 0.75,
            borderColor: color,
            borderRadius: 7,
            opacity: 0.55,
          }}
        />
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 13 * 0.22,
            color,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9,
            fontWeight: '600',
            letterSpacing: 9 * 0.22,
            color,
            opacity: 0.85,
            textAlign: 'center',
            marginTop: 3,
          }}
        >
          {date}
        </Text>
      </View>
    </View>
  );
}

export default PassportStamp;

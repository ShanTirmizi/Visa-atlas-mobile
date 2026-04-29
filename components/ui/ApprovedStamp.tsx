import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface ApprovedStampProps {
  label?: string;
  year?: string | number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Rotated coral "APPROVED" passport stamp — sits in the corner of visa cards. */
export function ApprovedStamp({
  label = 'APPROVED',
  year,
  size = 70,
  style,
}: ApprovedStampProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          transform: [{ rotate: '-12deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderWidth: 2,
          borderColor: colors.coralDeep,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.85,
        }}
      >
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: size * 0.18,
            fontWeight: '700',
            color: colors.coralDeep,
            letterSpacing: -0.2,
          }}
        >
          {label}
        </Text>
        {year ? (
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: size * 0.1,
              fontWeight: '700',
              color: colors.coralDeep,
              letterSpacing: 1.5,
              marginTop: 2,
            }}
          >
            {year}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default ApprovedStamp;

/**
 * Flag — circular country flag primitive using country-flag-icons/string/1x1.
 */
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as FlagStrings from 'country-flag-icons/string/1x1';

const FLAG_MAP = FlagStrings as unknown as Record<string, string | undefined>;

export interface FlagProps {
  code: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Flag({ code, size = 24, style, testID }: FlagProps) {
  const upper = code.toUpperCase();
  const svgXml = FLAG_MAP[upper];
  return (
    <View
      testID={testID}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: '#CCCCCC',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {svgXml ? <SvgXml xml={svgXml} width={size} height={size} /> : null}
    </View>
  );
}

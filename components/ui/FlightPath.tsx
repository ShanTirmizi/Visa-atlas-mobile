import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';

interface FlightPathProps {
  width?: number;
  height?: number;
  from: string;
  to: string;
  caption?: string;
}

export function FlightPath({
  width = 280,
  height = 50,
  from,
  to,
  caption,
}: FlightPathProps) {
  const { colors } = useTheme();
  return (
    <View style={{ position: 'relative', width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={`M 20 ${height / 2} Q ${width / 2} 6 ${width - 20} ${height / 2}`}
          stroke={colors.coral}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={20} cy={height / 2} r={4} fill={colors.teal} />
        <Circle cx={width - 20} cy={height / 2} r={4} fill={colors.coral} />
      </Svg>
      <Text
        style={[
          Type.mono9,
          {
            position: 'absolute',
            top: 0,
            left: 15,
            color: colors.inkMute,
          },
        ]}
      >
        {from}
      </Text>
      <Text
        style={[
          Type.mono9,
          {
            position: 'absolute',
            top: 0,
            right: 15,
            color: colors.inkMute,
          },
        ]}
      >
        {to}
      </Text>
      {caption ? (
        <Text
          style={[
            Type.title15,
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: colors.inkMute,
              fontSize: 11,
            },
          ]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export default FlightPath;

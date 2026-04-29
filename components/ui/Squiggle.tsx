import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/contexts/theme-context';

interface SquiggleProps {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function Squiggle({
  width = 100,
  height = 10,
  color,
  strokeWidth = 2,
  style,
}: SquiggleProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.coral;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style}>
      <Path
        d={`M2 ${height - 4} Q${width * 0.25} 2 ${width * 0.5} ${height - 4} T${width - 2} ${height - 5}`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export default Squiggle;

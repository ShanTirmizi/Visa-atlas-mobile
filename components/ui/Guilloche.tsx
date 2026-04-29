import React from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/contexts/theme-context';

interface GuillocheProps {
  variant?: 'rings' | 'waves' | 'wavy';
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  density?: 'tight' | 'med' | 'loose';
}

export function Guilloche({
  variant = 'rings',
  color,
  opacity = 0.05,
  style,
  density = 'med',
}: GuillocheProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.teal;

  if (variant === 'waves') {
    return (
      <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }, style]}>
        <Svg width="100%" height="100%" viewBox="0 0 360 500" preserveAspectRatio="none">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Path
              key={i}
              d={`M0 ${50 + i * 60} Q 180 ${30 + i * 60} 360 ${50 + i * 60}`}
              stroke={stroke}
              strokeWidth={0.6}
              fill="none"
            />
          ))}
        </Svg>
      </View>
    );
  }

  if (variant === 'wavy') {
    const rows = density === 'tight' ? 22 : density === 'loose' ? 12 : 16;
    const spacing = 600 / rows;
    return (
      <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }, style]}>
        <Svg width="100%" height="100%" viewBox="0 0 360 600" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: rows }).map((_, i) => {
            const y = i * spacing + 30;
            const phase = (i % 2) * 18;
            return (
              <Path
                key={i}
                d={`M -10 ${y} C ${60 + phase} ${y - 14}, ${130 + phase} ${y + 14}, ${200 + phase} ${y - 6} S ${340} ${y + 10}, ${380} ${y - 2}`}
                stroke={stroke}
                strokeWidth={1}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
          <Circle cx={40} cy={540} r={60} stroke={stroke} fill="none" strokeWidth={0.8} opacity={0.55} />
          <Circle cx={40} cy={540} r={40} stroke={stroke} fill="none" strokeWidth={0.6} opacity={0.4} />
          <Circle cx={320} cy={540} r={60} stroke={stroke} fill="none" strokeWidth={0.8} opacity={0.55} />
          <Circle cx={320} cy={540} r={40} stroke={stroke} fill="none" strokeWidth={0.6} opacity={0.4} />
        </Svg>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 320 360" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Circle
            key={i}
            cx={160}
            cy={180}
            r={40 + i * 30}
            stroke={stroke}
            fill="none"
            strokeWidth={0.6}
          />
        ))}
      </Svg>
    </View>
  );
}

export default Guilloche;

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, TextPath, Defs } from 'react-native-svg';
import { useTheme } from '@/contexts/theme-context';

interface Props {
  size?: number;
}

export function VAStamp({ size = 120 }: Props) {
  const { colors } = useTheme();
  const r = size / 2;
  const arcR = r - 10;

  // Top arc — text reads left-to-right along the upper half
  // Starts from left side of circle, goes over the top
  const topArcD = `M ${r - arcR} ${r} A ${arcR} ${arcR} 0 0 1 ${r + arcR} ${r}`;
  // Bottom arc — text reads left-to-right along the lower half
  const bottomArcD = `M ${r - arcR} ${r} A ${arcR} ${arcR} 0 0 0 ${r + arcR} ${r}`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <Path id="stampTopArc" d={topArcD} />
          <Path id="stampBottomArc" d={bottomArcD} />
        </Defs>
        {/* Outer ring */}
        <Circle
          cx={r}
          cy={r}
          r={r - 2}
          stroke={colors.coralDeep}
          strokeWidth={2}
          fill="none"
        />
        {/* Inner ring */}
        <Circle
          cx={r}
          cy={r}
          r={r - 8}
          stroke={colors.coralDeep}
          strokeWidth={1}
          fill="none"
          opacity={0.6}
        />
        {/* Top arc text */}
        <SvgText
          fill={colors.coralDeep}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.07}
          letterSpacing={size * 0.016}
          textAnchor="middle"
        >
          <TextPath href="#stampTopArc" startOffset="50%">
            VISA · ATLAS · INT'L · ON FILE
          </TextPath>
        </SvgText>
        {/* Bottom arc text */}
        <SvgText
          fill={colors.coralDeep}
          fontFamily="JetBrainsMono_500Medium"
          fontSize={size * 0.07}
          letterSpacing={size * 0.016}
          textAnchor="middle"
        >
          <TextPath href="#stampBottomArc" startOffset="50%">
            EST · 2026 · GLOBAL
          </TextPath>
        </SvgText>
        {/* Center monogram */}
        <SvgText
          x={r}
          y={r + size * 0.09}
          fill={colors.coralDeep}
          fontFamily="Fraunces_700Bold"
          fontSize={size * 0.30}
          textAnchor="middle"
          fontStyle="italic"
        >
          VA
        </SvgText>
        {/* Tiny coral dots flanking the monogram */}
        <Circle cx={r - size * 0.20} cy={r + size * 0.04} r={2.5} fill={colors.coral} />
        <Circle cx={r + size * 0.20} cy={r + size * 0.04} r={2.5} fill={colors.coral} />
      </Svg>
    </View>
  );
}

export default VAStamp;

/**
 * PassportMap — decorative city-tag world map for the empty state card.
 * Pure visual: sparse dot grid (continent silhouettes) + 3 city tags
 * (LISBON, TOKYO, BALI) positioned over the dots with colour-coded pins.
 */
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';

// ── Dot coordinates (approximate continent shapes, normalised 0–1) ────────
// Width × these = pixel position. Generated to loosely mimic Atlantic/Europe/
// Asia/Indian-Ocean placement on a passport background page.
const DOTS: Array<[number, number]> = [
  // Atlantic / Americas left edge
  [0.04, 0.35], [0.06, 0.55], [0.08, 0.40], [0.10, 0.65], [0.12, 0.48],
  [0.05, 0.70], [0.09, 0.30], [0.13, 0.72], [0.07, 0.82], [0.11, 0.58],

  // Western Europe
  [0.25, 0.18], [0.28, 0.28], [0.30, 0.20], [0.27, 0.38], [0.32, 0.32],
  [0.23, 0.48], [0.29, 0.15], [0.26, 0.55], [0.22, 0.30], [0.31, 0.45],
  [0.34, 0.22], [0.36, 0.35], [0.24, 0.62], [0.33, 0.58], [0.20, 0.42],

  // Mediterranean / North Africa
  [0.32, 0.62], [0.37, 0.68], [0.40, 0.58], [0.35, 0.75], [0.38, 0.80],
  [0.42, 0.72], [0.30, 0.72], [0.44, 0.60], [0.28, 0.78], [0.41, 0.85],

  // Eastern Europe / Middle East
  [0.45, 0.20], [0.47, 0.32], [0.50, 0.24], [0.48, 0.42], [0.52, 0.38],
  [0.43, 0.48], [0.55, 0.28], [0.46, 0.55], [0.53, 0.18], [0.49, 0.65],
  [0.54, 0.52], [0.56, 0.45], [0.44, 0.68], [0.51, 0.72],

  // Central / South Asia
  [0.58, 0.20], [0.60, 0.30], [0.63, 0.22], [0.61, 0.40], [0.65, 0.35],
  [0.57, 0.48], [0.67, 0.28], [0.59, 0.55], [0.64, 0.15], [0.62, 0.62],
  [0.66, 0.50], [0.68, 0.42], [0.57, 0.70], [0.63, 0.72],

  // East Asia / Japan
  [0.75, 0.12], [0.78, 0.20], [0.80, 0.14], [0.77, 0.30], [0.82, 0.25],
  [0.73, 0.35], [0.84, 0.18], [0.76, 0.42], [0.81, 0.10], [0.79, 0.48],
  [0.83, 0.38], [0.85, 0.30], [0.74, 0.52], [0.80, 0.55],

  // South-East Asia / Bali region
  [0.72, 0.58], [0.74, 0.68], [0.77, 0.62], [0.75, 0.75], [0.79, 0.70],
  [0.82, 0.65], [0.70, 0.72], [0.84, 0.74], [0.71, 0.82], [0.78, 0.82],
];

// ── City tag definitions ────────────────────────────────────────────────────
// left / top expressed as fraction of the container dimensions.
// pinDx / pinDy: offset from tag box origin to where the pin attaches.
interface CityTag {
  label: string;
  left: number; // 0–1
  top: number;  // 0–1
  color: 'ink' | 'coral' | 'teal';
}

const CITY_TAGS: CityTag[] = [
  { label: 'LISBON', left: 0.18, top: 0.20, color: 'ink' },
  { label: 'TOKYO',  left: 0.70, top: 0.08, color: 'coral' },
  { label: 'BALI',   left: 0.65, top: 0.62, color: 'teal' },
];

const MAP_HEIGHT = 180;
const MAP_WIDTH = '100%' as const;

export function PassportMap() {
  const { colors } = useTheme();

  const tagColor = (c: CityTag['color']) => {
    if (c === 'coral') return colors.coral;
    if (c === 'teal') return colors.teal;
    return colors.ink;
  };
  const tagBorder = (c: CityTag['color']) => {
    if (c === 'coral') return colors.coralBg;
    if (c === 'teal') return colors.tealBg;
    return colors.lineMid;
  };
  const tagBg = (c: CityTag['color']) => {
    if (c === 'coral') return colors.coralBg;
    if (c === 'teal') return colors.tealBg;
    return colors.surface;
  };

  return (
    <View
      style={{
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        borderRadius: 14,
        backgroundColor: colors.background,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Dot grid — rendered as a full-width SVG */}
      <Svg
        width="100%"
        height={MAP_HEIGHT}
        viewBox="0 0 320 180"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {DOTS.map(([nx, ny], i) => (
          <Circle
            key={i}
            cx={nx * 320}
            cy={ny * 180}
            r={2.2}
            fill={colors.inkFaint}
            opacity={0.65}
          />
        ))}
      </Svg>

      {/* City tags — absolutely positioned over the dots */}
      {CITY_TAGS.map((tag) => (
        <View
          key={tag.label}
          style={{
            position: 'absolute',
            // We use percentage-based positioning for robustness
            left: `${tag.left * 100}%` as unknown as number,
            top: `${tag.top * 100}%` as unknown as number,
          }}
        >
          {/* Pin dot below the tag */}
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: tagBorder(tag.color),
              backgroundColor: tagBg(tag.color),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {/* Coloured dot pin */}
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: tagColor(tag.color),
              }}
            />
            <Text
              style={[
                Type.mono9,
                {
                  color: tagColor(tag.color),
                  fontSize: 8,
                  letterSpacing: 8 * 0.18,
                  textTransform: 'uppercase',
                },
              ]}
            >
              {tag.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default PassportMap;

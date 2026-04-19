/**
 * Flag — circular country flag primitive.
 *
 * Strategy: `country-flag-icons/string/1x1` ships every flag as a raw SVG
 * string (square viewport) in a plain CJS module — no Metro transformer
 * required. We render those strings via `SvgXml` from `react-native-svg`,
 * which converts the SVG XML into native RN-SVG primitives at runtime.
 *
 * Why NOT `country-flag-icons/react/3x2`:
 *   That sub-package emits React.createElement("svg", ...) — raw HTML SVG
 *   element names that don't exist in React Native's renderer. It would crash
 *   on device.
 *
 * Path taken: A (modified) — string SVG + SvgXml. No metro.config.js changes.
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

// country-flag-icons/string/1x1 is a CommonJS module that exports one named
// string constant per ISO-3166-1 alpha-2 code, e.g. `export const JP: string`.
// The 1×1 variant uses a square viewBox crop (e.g. "85.5 0 342 342") that
// renders cleanly inside a circular mask.
import * as FlagStrings from 'country-flag-icons/string/1x1';

// The module's named exports are strings; we cast to a plain record so we can
// do a safe runtime lookup without suppressing the TypeScript checks elsewhere.
const FLAG_MAP = FlagStrings as unknown as Record<string, string | undefined>;

// ─────────────────────────────────────────────────────────────────────────────

export interface FlagProps {
  /** ISO 3166-1 alpha-2 country code (case-insensitive). */
  code: string;
  /** Diameter of the circular flag in logical pixels. Default: 24. */
  size?: number;
  /** Additional container styles. */
  style?: StyleProp<ViewStyle>;
  /** For testing. */
  testID?: string;
}

/**
 * Renders a country flag as a circle.
 *
 * If the code is not found in the flag library (e.g. unknown or custom codes),
 * a neutral grey circle placeholder is shown instead.
 *
 * @example
 * <Flag code="JP" size={32} />
 * <Flag code="gb" size={22} />   // lowercase is normalised automatically
 */
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
          backgroundColor: '#CCCCCC', // placeholder colour for unknown codes
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {svgXml ? (
        <SvgXml
          xml={svgXml}
          width={size}
          height={size}
        />
      ) : null}
    </View>
  );
}

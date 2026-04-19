import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';

// Tone kept as a typed prop for call-site back-compat, but no longer affects
// the no-URI render — the old two-tone mud gradient was replaced with a
// clean neutral placeholder.
export type PhotoTone =
  | 'warm' | 'forest' | 'ocean' | 'sunset' | 'stone'
  | 'plum' | 'night' | 'mist' | 'gold' | 'mountain';

interface PhotoProps {
  /** If provided, the real image is rendered via expo-image with a blurhash
   *  placeholder and 200ms fade-in. If omitted, a clean neutral placeholder
   *  is shown (no muddy gradient). */
  uri?: string;
  /** @deprecated — kept for call-site compat; no longer affects rendering. */
  tone?: PhotoTone;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
  /** Small ImageOff glyph in the placeholder. Set false for tight thumbs. */
  showPlaceholderGlyph?: boolean;
}

export function Photo({
  uri,
  radius = 0,
  style,
  children,
  testID,
  showPlaceholderGlyph = true,
}: PhotoProps) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        {
          // Neutral placeholder when no image. The real photo (if any) covers it.
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {uri ? (
        <ExpoImage
          source={{ uri }}
          // BlurHash is a standard neutral-grey bh; it shows briefly before fade-in.
          placeholder={{ blurhash: 'L5H2EC=PM+yV0g-mq.wG9c010J}I' }}
          contentFit="cover"
          transition={220}
          style={{ width: '100%', height: '100%' }}
        />
      ) : showPlaceholderGlyph ? (
        <ImageOff
          size={22}
          color={colors.inkFaint}
          strokeWidth={1.5}
          opacity={0.6}
        />
      ) : null}
      {children}
    </View>
  );
}

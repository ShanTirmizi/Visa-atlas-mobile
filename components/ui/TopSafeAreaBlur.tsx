import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';

interface TopSafeAreaBlurProps {
  /** Extra height below the status bar — useful for screens with a fixed
   *  header that should also tuck under the same blur. */
  extra?: number;
}

/**
 * Top safe-area blur header — Apple Mail / App Store / Settings pattern.
 *
 * Why MaskedView: simply ending a BlurView at `insets.top` leaves a hard
 * horizontal seam where the frost stops. Apple's headers fade the blur
 * itself out gradually. The standard RN trick is to wrap the BlurView in
 * a MaskedView whose mask is a vertical gradient — the blur becomes
 * fully visible at the top and softly transparent at the bottom, blending
 * into the page beneath.
 *
 * Don't try to fade `BlurView` via React Native style opacity: on iOS the
 * blur is rendered by a native `UIVisualEffectView` that ignores layer
 * opacity. Mask, mount/unmount, or animate `intensity` instead.
 */
export function TopSafeAreaBlur({ extra = 0 }: TopSafeAreaBlurProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const FADE_PX = 18;
  const totalHeight = insets.top + extra + FADE_PX;
  const solidPortion = (insets.top + extra) / totalHeight;

  // The mask: opaque white from 0 → solidPortion (blur fully visible),
  // then fades to transparent over the FADE_PX zone.
  const mask = (
    <LinearGradient
      colors={['#000', '#000', 'transparent']}
      locations={[0, solidPortion, 1]}
      style={StyleSheet.absoluteFill}
    />
  );

  if (Platform.OS !== 'ios') {
    // Android: BlurView is approximate. Use a solid paper bg masked with
    // the same gradient — gives a comparable soft fade.
    return (
      <View
        pointerEvents="none"
        style={[styles.wrap, { height: totalHeight }]}
      >
        <MaskedView style={StyleSheet.absoluteFill} maskElement={mask}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        </MaskedView>
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { height: totalHeight }]}
    >
      <MaskedView style={StyleSheet.absoluteFill} maskElement={mask}>
        {/* Ultra-thin material at low intensity — same family Apple uses for
            Mail / Settings / App Store. systemMaterial at 50 reads as a grey
            band on TestFlight builds against a warm paper bg; ultra-thin at
            30 stays neutral and just refracts the page beneath. */}
        <BlurView
          tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterial'}
          intensity={30}
          style={StyleSheet.absoluteFill}
        />
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});

export default TopSafeAreaBlur;

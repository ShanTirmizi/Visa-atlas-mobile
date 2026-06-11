import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** Frost strength once fully visible. systemMaterial at 50 reads as a grey
 *  band on TestFlight builds against the warm paper bg; ultra-thin at 30
 *  stays neutral and just refracts the page beneath. */
const INTENSITY = 30;
/** Height of the bottom gradient fade — the blur softens out over this zone
 *  instead of stopping at a hard horizontal seam. */
const FADE_PX = 18;
/** Apple Mail ramp: the blur is fully in once content has scrolled ~24px
 *  under the safe area. */
const SCROLL_FADE_DISTANCE = 24;

interface TopSafeAreaBlurProps {
  /**
   * Optional scroll position from the parent screen (a Reanimated
   * `useSharedValue` driven by an `Animated.ScrollView` `onScroll` handler).
   * When provided, the blur fades in as content starts to scroll under the
   * safe area — 0 at rest, fully in by ~24px — Apple Mail pattern, animated
   * on the UI thread.
   *
   * When omitted (the default for 11 of 12 call sites), the blur is ALWAYS
   * visible at full intensity. Never make visibility depend on a prop that
   * callers don't pass.
   */
  scrollY?: SharedValue<number>;
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
 * fully visible at the top and softly transparent over the bottom 18px,
 * blending into the page beneath.
 *
 * Why animate `intensity` (not opacity) for the scroll fade: on iOS the
 * blur is rendered by a native `UIVisualEffectView`, and Apple's docs warn
 * that alpha < 1 on the effect view or any superview makes the effect look
 * incorrect or not show at all. expo-blur's documented animation path is
 * the `intensity` prop via Reanimated `useAnimatedProps`, so that's what
 * drives the Apple Mail fade-in here.
 *
 * Android: expo-blur's native blur is approximate (and the experimental
 * dimezis method has known artifacts over scrolling content), so we render
 * a solid `colors.background` strip through the same gradient mask — a
 * comparable soft-faded chrome rather than nothing.
 */
export function TopSafeAreaBlur({ scrollY, extra = 0 }: TopSafeAreaBlurProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const totalHeight = insets.top + extra + FADE_PX;
  const solidPortion = (insets.top + extra) / totalHeight;

  // iOS: drive the blur intensity on the UI thread. Full INTENSITY when no
  // scrollY is provided (always-on default); otherwise ramp 0 → INTENSITY
  // over the first SCROLL_FADE_DISTANCE px of scroll.
  const animatedProps = useAnimatedProps(() => ({
    intensity: scrollY
      ? interpolate(
          scrollY.value,
          [0, SCROLL_FADE_DISTANCE],
          [0, INTENSITY],
          Extrapolation.CLAMP,
        )
      : INTENSITY,
  }));

  // Android: no UIVisualEffectView constraint, so plain layer opacity on the
  // solid strip mirrors the same ramp.
  const androidFadeStyle = useAnimatedStyle(() => ({
    opacity: scrollY
      ? interpolate(
          scrollY.value,
          [0, SCROLL_FADE_DISTANCE],
          [0, 1],
          Extrapolation.CLAMP,
        )
      : 1,
  }));

  // The mask: opaque from 0 → solidPortion (chrome fully visible), then
  // fades to transparent over the FADE_PX zone. Mask colors only contribute
  // alpha, never visible color, so the literal black here is fine.
  const mask = (
    <LinearGradient
      colors={['#000', '#000', 'transparent']}
      locations={[0, solidPortion, 1]}
      style={StyleSheet.absoluteFill}
    />
  );

  if (Platform.OS !== 'ios') {
    return (
      <View pointerEvents="none" style={[styles.wrap, { height: totalHeight }]}>
        <MaskedView style={StyleSheet.absoluteFill} maskElement={mask}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.background },
              androidFadeStyle,
            ]}
          />
        </MaskedView>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.wrap, { height: totalHeight }]}>
      <MaskedView style={StyleSheet.absoluteFill} maskElement={mask}>
        {/* Ultra-thin material — same family Apple uses for Mail / Settings /
            App Store. Explicit Light/Dark suffixes (selected from the theme)
            keep True Tone / OLED ambient adaptation from pulling an opposite
            cast into the frost. */}
        <AnimatedBlurView
          tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          animatedProps={animatedProps}
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

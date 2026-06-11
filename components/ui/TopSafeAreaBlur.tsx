import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface TopSafeAreaBlurProps {
  /**
   * Scroll position from the parent screen. When the user scrolls and content
   * passes under the safe area, the blur intensity ramps up live — Apple Mail
   * pattern. When omitted, scroll-y is treated as 0 and the blur stays
   * effectively invisible (intensity 0, no frost band).
   *
   * Pass a Reanimated `useSharedValue` driven by an `Animated.ScrollView`
   * `onScroll` handler so the intensity animates on the UI thread without a
   * JS round-trip per frame.
   */
  scrollY?: SharedValue<number>;
  /** Extra height below the status bar (for screens with custom fixed headers). */
  extra?: number;
}

/**
 * Top safe-area blur — Apple Mail / Apple Settings pattern, scroll-aware.
 *
 * The whole point: at rest (no scroll), the blur intensity is 0 — completely
 * invisible, no frost, no band. As content scrolls under the safe area, the
 * intensity ramps up smoothly on the UI thread (Reanimated useAnimatedProps
 * driving BlurView's intensity prop). When at the top of a scroll surface,
 * you see only the page bg painted to the top — exactly like Apple Mail at
 * rest in light mode.
 *
 * Why a *single* BlurView and not stacked: stacked BlurViews have hard blur
 * radius discontinuities at each layer's edge, which the eye reads as bands.
 * A single BlurView with animated intensity has continuous radius (zero or
 * varying smoothly), which is what feels natural.
 *
 * Why no MaskedView: Apple's UIVisualEffectView documentation explicitly
 * warns that any mask applied to a superview forces an offscreen render
 * pass, which makes the blur composite against a default grey backing on
 * real devices. The bug we hit two attempts ago.
 *
 * Tint locked to systemUltraThinMaterialLight — the lightest material Apple
 * ships, with the *Light* suffix so True Tone / OLED ambient adaptation
 * can't pull a dark cast into the frost when intensity > 0.
 */
export function TopSafeAreaBlur({ scrollY, extra = 0 }: TopSafeAreaBlurProps) {
  const insets = useSafeAreaInsets();
  const totalHeight = insets.top + extra;

  // Default scroll-y to 0 when caller doesn't pass one — keeps the blur
  // invisible on screens that don't have full-bleed scroll under chrome.
  const fallbackScrollY = useSharedValue(0);
  const effectiveScrollY = scrollY ?? fallbackScrollY;

  // Drive the blur intensity prop on the UI thread. 0 at rest (totally
  // invisible — no frost), ramping up to 22 once the user has scrolled
  // 80px. Smooth, single-pass blur — no banding possible because intensity
  // is a single scalar value applied uniformly across one BlurView.
  const animatedProps = useAnimatedProps(() => ({
    intensity: interpolate(
      effectiveScrollY.value,
      [0, 80],
      [0, 22],
      Extrapolation.CLAMP,
    ),
  }));

  if (Platform.OS !== 'ios') {
    // Android: BlurView is approximate; we don't render anything to avoid
    // half-baked frost on devices that don't render the material correctly.
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.wrap, { height: totalHeight }]}>
      <AnimatedBlurView
        tint="systemUltraThinMaterialLight"
        animatedProps={animatedProps}
        style={StyleSheet.absoluteFill}
      />
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

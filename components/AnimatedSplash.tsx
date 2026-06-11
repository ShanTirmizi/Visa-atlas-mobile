import React, { useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

import { Squiggle } from '@/components/ui/Squiggle';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Matches `imageWidth: 290` in app.json's expo-splash-screen config so the
// native splash hands off to this component without the figure changing size.
// Capped to 85% of screen width on small devices.
const HERO_SIZE = Math.min(290, SCREEN_W * 0.85);

// Golden particle positions (% of screen) — scattered around the Atlas figure
// in the negative space of the cream paper. Top-heavy because the figure's
// torso/legs occupy the bottom half of the image.
const PARTICLES: { x: number; y: number; size: number; delay: number }[] = [
  { x: 0.14, y: 0.18, size: 4, delay: 600 },
  { x: 0.85, y: 0.14, size: 3, delay: 720 },
  { x: 0.22, y: 0.34, size: 2.5, delay: 840 },
  { x: 0.80, y: 0.30, size: 5, delay: 960 },
  { x: 0.10, y: 0.48, size: 3, delay: 1080 },
  { x: 0.92, y: 0.44, size: 2.5, delay: 1200 },
  { x: 0.18, y: 0.62, size: 4, delay: 1080 },
  { x: 0.88, y: 0.60, size: 3.5, delay: 960 },
];

interface AnimatedSplashProps {
  /** Fired when the splash has fully faded out. */
  onAnimationDone?: () => void;
  /**
   * When false, the exit fade-out is held — useful if auth/data is still
   * resolving. The entry animations always play immediately. The fade-out
   * fires once this becomes true (or stays true past the entry timeline).
   * Defaults to true so the splash exits on its own ~2.9s timer.
   */
  canFadeOut?: boolean;
}

const ENTRY_DURATION_MS = 2450; // when fade-out would normally start

export function AnimatedSplash({
  onAnimationDone,
  canFadeOut = true,
}: AnimatedSplashProps) {
  const { colors } = useTheme();
  const mountedAt = useRef(Date.now());

  // Master overlay opacity (drives the final fade-out).
  const overlay = useSharedValue(1);

  // Hero scale — starts at 1.0 so the hand-off from the native
  // expo-splash-screen (same image, same cream bg, imageWidth=290) is
  // visually invisible. A slow cinematic zoom over the splash lifetime
  // gives a "stepping forward into the world" feel.
  const heroScale = useSharedValue(1);

  // Title block animation values.
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(14);

  // Kicker / squiggle animation values.
  const kickerOpacity = useSharedValue(0);
  const squiggleOpacity = useSharedValue(0);

  // Soft glow behind the sphere — pulses gently throughout.
  const glow = useSharedValue(0);

  useEffect(() => {
    // ── Hero — slow cinematic zoom (1.0 → 1.04 over the splash lifetime) ──
    // Image is visible from frame 1 (matches native splash); the slow zoom
    // adds a sense of forward motion / "stepping into the world".
    heroScale.value = withTiming(1.04, {
      duration: 3200,
      easing: Easing.out(Easing.quad),
    });

    // ── Soft glow pulse — fades in then breathes ─────────────────
    glow.value = withDelay(
      300,
      withSequence(
        withTiming(0.55, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withRepeat(
          withSequence(
            withTiming(0.85, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      ),
    );

    // ── Kicker (1.20s) ──────────────────────────────────────────
    kickerOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    // ── Title (1.30s) ───────────────────────────────────────────
    titleOpacity.value = withDelay(
      1300,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    titleTranslate.value = withDelay(
      1300,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    // ── Squiggle (1.65s) ────────────────────────────────────────
    squiggleOpacity.value = withDelay(
      1650,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  // Exit fade — fires when canFadeOut is true AND the entry timeline has
  // had a chance to play. If canFadeOut flips true late (e.g. slow auth),
  // exit runs immediately.
  useEffect(() => {
    if (!canFadeOut) return;
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, ENTRY_DURATION_MS - elapsed);

    overlay.value = withDelay(
      wait,
      withTiming(
        0,
        { duration: 450, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished && onAnimationDone) runOnJS(onAnimationDone)();
        },
      ),
    );
  }, [canFadeOut]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const kickerStyle = useAnimatedStyle(() => ({
    opacity: kickerOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const squiggleStyle = useAnimatedStyle(() => ({
    opacity: squiggleOpacity.value,
  }));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: '#F5EFE6',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
        },
        glow: {
          position: 'absolute',
          width: HERO_SIZE * 0.95,
          height: HERO_SIZE * 0.95,
          borderRadius: HERO_SIZE,
          backgroundColor: colors.coralSoft,
          // The glow sits behind the upper portion of the hero (where the
          // celestial sphere is in the artwork) — offset upward to align.
          top: SCREEN_H / 2 - HERO_SIZE * 0.62,
          shadowColor: colors.coralDeep,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 80,
        },
        hero: {
          width: HERO_SIZE,
          height: HERO_SIZE,
        },
        heroImg: {
          width: '100%',
          height: '100%',
        },
        textBlock: {
          position: 'absolute',
          bottom: SCREEN_H * 0.16,
          alignItems: 'center',
        },
        kicker: {
          fontFamily: FontFamily.mono,
          fontSize: 10.5,
          letterSpacing: 3.2,
          color: colors.inkMute,
          marginBottom: 14,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'baseline',
        },
        titleRoman: {
          fontFamily: FontFamily.display,
          fontSize: 44,
          color: colors.ink,
          letterSpacing: -0.5,
        },
        titleItalic: {
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 44,
          color: colors.ink,
          letterSpacing: -0.5,
        },
        titleDot: {
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 44,
          color: colors.coral,
        },
        squiggleWrap: {
          marginTop: 14,
        },
      }),
    [colors],
  );

  // Dismiss the native expo-splash-screen ONLY after the JS scene has been
  // measured, the hero image has decoded, AND we've waited two animation
  // frames. The double-RAF is the key bit: onLayout + onLoad both fire
  // before iOS has actually composited the rendered tree to the screen.
  // RAF #1 lands on the "next" JS frame; by RAF #2, the previous frame has
  // had time to flush through the native side. Without this, hideAsync
  // races the paint and the user sees a one-frame gap (the second flicker).
  const layoutDoneRef = useRef(false);
  const imageDoneRef = useRef(false);
  const hiddenRef = useRef(false);
  const tryHide = () => {
    if (
      layoutDoneRef.current &&
      imageDoneRef.current &&
      !hiddenRef.current
    ) {
      hiddenRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hideAsync().catch(() => {});
        });
      });
    }
  };
  const handleSplashLayout = () => {
    layoutDoneRef.current = true;
    tryHide();
  };
  const handleHeroImageLoad = () => {
    imageDoneRef.current = true;
    tryHide();
  };

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      pointerEvents="none"
      onLayout={handleSplashLayout}
    >
      {/* Soft coral glow behind the celestial sphere */}
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

      {/* Hero — Atlas holding the constellation globe */}
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image
          source={require('@/assets/atlas-hero.png')}
          style={styles.heroImg}
          resizeMode="contain"
          onLoad={handleHeroImageLoad}
        />
      </Animated.View>

      {/* Twinkling golden particles around the figure */}
      {PARTICLES.map((p, i) => (
        <TwinklingStar
          key={i}
          x={p.x}
          y={p.y}
          size={p.size}
          delay={p.delay}
          color={colors.gold}
        />
      ))}

      {/* Wordmark block */}
      <View style={styles.textBlock}>
        <Animated.Text style={[styles.kicker, kickerStyle]}>
          EST · MMXXVI · GLOBAL
        </Animated.Text>
        <Animated.View style={[styles.titleRow, titleStyle]}>
          <Text style={styles.titleRoman}>Visa </Text>
          <Text style={styles.titleItalic}>Atlas</Text>
          <Text style={styles.titleDot}>.</Text>
        </Animated.View>
        <Animated.View style={[styles.squiggleWrap, squiggleStyle]}>
          <Squiggle width={80} height={9} color={colors.coral} strokeWidth={2} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Twinkling star particle ─────────────────────────────────────────────────
interface StarProps {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}

function TwinklingStar({ x, y, size, delay, color }: StarProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    // Initial entry — fade + scale up to peak
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
        // Then settle into a gentle infinite twinkle
        withRepeat(
          withSequence(
            withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        ),
      ),
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x * SCREEN_W - size,
          top: y * SCREEN_H - size,
          width: size * 2,
          height: size * 2,
          borderRadius: size,
          backgroundColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: size * 2.5,
        },
        style,
      ]}
    />
  );
}

export default AnimatedSplash;

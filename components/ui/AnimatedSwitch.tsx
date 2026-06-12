import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';

// ════════════════════════════════════════════════════════════════════════
// AnimatedSwitch — iOS-style toggle. Spring-driven thumb slide + cross-fading
// track between line-mid (off) and teal (on). 24px thumb, 50px track.
// Extracted verbatim from SurpriseMeSheet — the CLAUDE.md reference shape
// for every toggle in the app.
// ════════════════════════════════════════════════════════════════════════
const SWITCH_W = 50;
const SWITCH_H = 30;
const THUMB_SIZE = 24;
const THUMB_INSET = 3;

export function AnimatedSwitch({ value }: { value: boolean }) {
  const { colors } = useTheme();
  // 0 = off, 1 = on. Drives both the thumb position and the track color.
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 240,
      mass: 0.7,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.lineMid, colors.teal],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress.value * (SWITCH_W - THUMB_SIZE - THUMB_INSET * 2),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width: SWITCH_W,
          height: SWITCH_H,
          borderRadius: SWITCH_H / 2,
          padding: THUMB_INSET,
          justifyContent: 'center',
        },
        trackStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 4,
            elevation: 3,
          },
          thumbStyle,
        ]}
      />
    </Animated.View>
  );
}

export default AnimatedSwitch;

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type TypingDotsSize = 'sm' | 'md';

interface TypingDotsProps {
  color: string;
  size?: TypingDotsSize;
  /** Horizontal gap between dots. Default 6px. */
  gap?: number;
}

/**
 * Three bouncing dots — the "active opaque background work" indicator.
 * Reanimated worklets run on the UI thread; safe to mount many simultaneously.
 */
export function TypingDots({ color, size = 'md', gap = 6 }: TypingDotsProps) {
  const dot1 = useSharedValue(0.4);
  const dot2 = useSharedValue(0.4);
  const dot3 = useSharedValue(0.4);

  useEffect(() => {
    const anim = (sv: { value: number }, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: delay }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    };
    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scale: dot1.value }], opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scale: dot2.value }], opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scale: dot3.value }], opacity: dot3.value }));

  const dotPx = size === 'sm' ? 4 : 6;
  const dotStyle = { width: dotPx, height: dotPx, borderRadius: dotPx / 2, backgroundColor: color };

  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'center' }}>
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
      <Animated.View style={[dotStyle, s3]} />
    </View>
  );
}

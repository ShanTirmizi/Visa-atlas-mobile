// components/trip/skeletons/_shimmer.tsx
import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';

interface ShimmerProps {
  style?: ViewStyle;
}

/**
 * Shared shimmer primitive for skeleton placeholders. Sits on a warm cream
 * base (`colors.warmBg`) so it reads against the editorial paper background,
 * with a subtle pulsing overlay tinted with `colors.line`.
 */
export function Shimmer({ style }: ShimmerProps) {
  const { colors } = useTheme();
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [x]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + Math.sin(x.value * Math.PI) * 0.4,
  }));

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.warmBg }, style]}>
      <Animated.View
        style={[
          { width: '100%', height: '100%', backgroundColor: colors.line },
          animStyle,
        ]}
      />
    </View>
  );
}

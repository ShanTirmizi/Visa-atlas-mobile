import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { TypingDots } from '@/components/ui/TypingDots';
import { FontFamily } from '@/constants/theme';

interface TripGenerationStripProps {
  /** N from "Crafting your trip · N of M" */
  completed: number;
  /** M from "Crafting your trip · N of M" */
  total: number;
  /** Optional: "1 issue" appended in muted tone if any sections failed */
  issueCount?: number;
}

const STRIP_HEIGHT = 1.5;

/**
 * Top-of-screen progress strip + status kicker. Renders ABOVE the
 * TopSafeAreaBlur (z-index 10) and stays mounted across all five tabs.
 *
 * Strip animation: a coral gradient sweeps right→left in a 2.4s cycle
 * with opacity oscillating 0.35 ↔ 1. Feels alive without being noisy.
 */
export function TripGenerationStrip({ completed, total, issueCount = 0 }: TripGenerationStripProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [sweep]);

  const stripStyle = useAnimatedStyle(() => {
    const progress = sweep.value;
    return {
      opacity: 0.35 + Math.sin(progress * Math.PI) * 0.65,
      transform: [{ translateX: -200 + progress * 400 }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
      }}
    >
      <View style={{ height: insets.top, justifyContent: 'flex-end', paddingBottom: 4, paddingLeft: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 0.08 * 9,
              textTransform: 'uppercase',
              color: colors.coral,
              fontFamily: FontFamily.semibold,
            }}
          >
            Crafting your trip · {completed} of {total}
            {issueCount > 0 && (
              <Text style={{ color: colors.inkMute }}>
                {`  · ${issueCount} issue${issueCount > 1 ? 's' : ''}`}
              </Text>
            )}
          </Text>
          <TypingDots color={colors.coral} size="sm" gap={3} />
        </View>
      </View>
      <View style={{ height: STRIP_HEIGHT, overflow: 'hidden' }}>
        <Animated.View
          style={[
            {
              width: 200,
              height: STRIP_HEIGHT,
              backgroundColor: colors.coral,
            },
            stripStyle,
          ]}
        />
      </View>
    </View>
  );
}

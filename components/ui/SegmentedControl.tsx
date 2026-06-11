import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { Squiggle } from './Squiggle';
import { hapticSelect } from '@/utils/haptics';

type Variant = 'pill' | 'underline' | 'squiggle';

interface Props {
  options: string[];
  value: string;
  onChange: (v: any) => void;
  variant?: Variant;
  /**
   * Optional map: tab option → whether to show a coral dot indicator
   * next to that tab's label. Used during trip generation to flag
   * tabs with pending content.
   */
  dotIndicators?: Record<string, boolean>;
}

function PulsingDot() {
  const { colors } = useTheme();
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -2,
          right: -7,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.coral,
        },
        s,
      ]}
    />
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  variant = 'pill',
  dotIndicators,
}: Props) {
  const { colors } = useTheme();

  // Selection haptic only when the active segment actually changes —
  // re-pressing the current tab stays silent (Apple HIG: selection feedback).
  const handlePress = (o: string) => {
    if (o !== value) hapticSelect();
    onChange(o);
  };

  if (variant === 'squiggle') {
    // Trip-tabs style: text-only with coral squiggle underline on the active tab.
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 22,
          alignItems: 'center',
          paddingHorizontal: 4,
          paddingTop: 6,
          paddingBottom: 10,
        }}
      >
        {options.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => handlePress(o)}
              style={{ position: 'relative', paddingBottom: 6 }}
            >
              <View style={{ position: 'relative' }}>
                <Text
                  style={{
                    fontFamily: FontFamily.medium,
                    fontSize: 14,
                    fontWeight: active ? '700' : '500',
                    color: active ? colors.teal : colors.inkMute,
                  }}
                >
                  {o}
                </Text>
                {dotIndicators?.[o] && <PulsingDot />}
              </View>
              {active ? (
                <Squiggle
                  width={48}
                  height={6}
                  strokeWidth={2}
                  color={colors.coral}
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: 0,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === 'underline') {
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          marginBottom: 16,
        }}
      >
        {options.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => handlePress(o)}
              style={{
                paddingBottom: 10,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: colors.ink,
                marginBottom: -1,
              }}
            >
              <Text style={[Type.title14, { color: active ? colors.ink : colors.inkMute, fontSize: 13.5 }]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // pill variant — used for filter chips. Coral squiggle under the active pill.
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16, alignItems: 'flex-end' }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => handlePress(o)}
            style={{
              position: 'relative',
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: active ? colors.ink : 'transparent',
              borderWidth: active ? 0 : 1,
              borderColor: colors.lineMid,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.semibold,
                fontSize: 12,
                fontWeight: '600',
                color: active ? '#FFFFFF' : colors.inkSoft,
              }}
            >
              {o}
            </Text>
            {active ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: -8,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <Squiggle
                  width={26}
                  height={5}
                  strokeWidth={2}
                  color={colors.coral}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;

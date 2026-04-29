import React, { useEffect } from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

interface CountdownProps {
  days: number;
  hours: number;
  style?: StyleProp<ViewStyle>;
}

/** Coral signature countdown pill — italic Fraunces day:hour with a ticking colon. */
export function Countdown({ days, hours, style }: CountdownProps) {
  const { colors } = useTheme();
  const tick = useSharedValue(1);

  useEffect(() => {
    tick.value = withRepeat(
      withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [tick]);

  const colonStyle = useAnimatedStyle(() => ({ opacity: tick.value }));

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 3,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: colors.coral,
          shadowColor: '#E89B7A',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 6,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontWeight: '500',
          fontSize: 22,
          letterSpacing: -22 * 0.02,
          color: '#FFFFFF',
        }}
      >
        {days}
        <Text style={{ fontSize: 11, fontWeight: '600', fontFamily: FontFamily.semibold, fontStyle: 'normal' }}>d</Text>
      </Text>
      <Animated.Text
        style={[
          {
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 22,
            letterSpacing: -22 * 0.02,
            color: '#FFFFFF',
          },
          colonStyle,
        ]}
      >
        :
      </Animated.Text>
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontWeight: '500',
          fontSize: 22,
          letterSpacing: -22 * 0.02,
          color: '#FFFFFF',
        }}
      >
        {String(hours).padStart(2, '0')}
        <Text style={{ fontSize: 11, fontWeight: '600', fontFamily: FontFamily.semibold, fontStyle: 'normal' }}>h</Text>
      </Text>
    </View>
  );
}

export default Countdown;

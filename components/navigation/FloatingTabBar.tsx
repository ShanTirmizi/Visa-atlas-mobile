import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Plane, Globe, ArrowLeftRight, BookOpen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Shadows, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabDef {
  routeName: string;
  Icon: (props: { color: string; size: number }) => React.ReactNode;
}

// Order per spec: Trips / Explore / Compare / Guides
const TABS: TabDef[] = [
  { routeName: 'trips', Icon: ({ color, size }) => <Plane color={color} size={size} strokeWidth={2} /> },
  { routeName: 'explore', Icon: ({ color, size }) => <Globe color={color} size={size} strokeWidth={2} /> },
  { routeName: 'compare', Icon: ({ color, size }) => <ArrowLeftRight color={color} size={size} strokeWidth={2} /> },
  { routeName: 'guides', Icon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={2} /> },
];

// Sizing — matches the previous 56x56 bump
const PILL_PADDING = 8;
const TAB_GAP = 6;
const TAB_SIZE = 56;
const ICON_SIZE = 22;

const ACTIVE_COLOR = 0;   // ink
const INACTIVE_COLOR = 1; // rgba(255,255,255,0.7)

function TabIcon({
  Icon,
  progress,
}: {
  Icon: TabDef['Icon'];
  progress: SharedValue<number>;
}) {
  // Can't pass an animated color straight to the lucide icon prop since it's a
  // native stroke; instead we overlay two icons (dark + light) and crossfade
  // their opacities via progress.
  const darkStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, darkStyle]}>
        <Icon color="#0E0E0E" size={ICON_SIZE} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, lightStyle]}>
        <Icon color="rgba(255,255,255,0.75)" size={ICON_SIZE} />
      </Animated.View>
    </View>
  );
}

function TabButton({
  index,
  tab,
  isFocused,
  onPress,
}: {
  index: number;
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
}) {
  // 0 when focused (dark icon visible), 1 when not (light icon visible).
  const progress = useSharedValue(isFocused ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 0 : 1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}
    >
      <TabIcon Icon={tab.Icon} progress={progress} />
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Resolve the current route's position within our TABS order.
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.routeName === state.routes[state.index]?.name),
  );

  const indicatorX = useSharedValue(activeIndex * (TAB_SIZE + TAB_GAP));

  useEffect(() => {
    indicatorX.value = withSpring(activeIndex * (TAB_SIZE + TAB_GAP), {
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const pillStyle = useMemoStyle(colors);

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 22) }]}
      pointerEvents="box-none"
    >
      <View style={pillStyle.pill}>
        {/* Animated indicator — slides under the active tab */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { left: PILL_PADDING, top: PILL_PADDING },
            indicatorStyle,
          ]}
        />

        {TABS.map((tab, tabIndex) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.routeName);
          if (routeIndex === -1) return null;
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[routeIndex].key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(state.routes[routeIndex].name as never);
            }
          };

          return (
            <TabButton
              key={tab.routeName}
              index={tabIndex}
              tab={tab}
              isFocused={isFocused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function useMemoStyle(colors: ThemeColors) {
  return React.useMemo(
    () =>
      StyleSheet.create({
        pill: {
          flexDirection: 'row',
          gap: TAB_GAP,
          backgroundColor: colors.ink,
          borderRadius: 999,
          padding: PILL_PADDING,
          position: 'relative',
          ...Shadows.tabBar,
        },
      }),
    [colors],
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  tab: {
    width: TAB_SIZE,
    height: TAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  indicator: {
    position: 'absolute',
    width: TAB_SIZE,
    height: TAB_SIZE,
    borderRadius: TAB_SIZE / 2,
    backgroundColor: '#FFFFFF',
  },
});

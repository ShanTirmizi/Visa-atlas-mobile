import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
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
import { Shadows, FontFamily, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabDef {
  routeName: string;
  label: string;
  Icon: (props: { color: string; size: number }) => React.ReactNode;
}

// Order per spec: Trips / Atlas / Compare / Guides
const TABS: TabDef[] = [
  { routeName: 'trips', label: 'Trips', Icon: ({ color, size }) => <Plane color={color} size={size} strokeWidth={2} /> },
  { routeName: 'explore', label: 'Atlas', Icon: ({ color, size }) => <Globe color={color} size={size} strokeWidth={2} /> },
  { routeName: 'compare', label: 'Compare', Icon: ({ color, size }) => <ArrowLeftRight color={color} size={size} strokeWidth={2} /> },
  { routeName: 'guides', label: 'Guides', Icon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={2} /> },
];

const PILL_PADDING = 8;
const TAB_GAP = 4;
const ICON_SIZE = 20;

function TabIcon({
  Icon,
  progress,
}: {
  Icon: TabDef['Icon'];
  progress: SharedValue<number>;
}) {
  const dimStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const onStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, dimStyle]}>
        <Icon color="rgba(255,255,255,0.5)" size={ICON_SIZE} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, onStyle]}>
        <Icon color="#FFFFFF" size={ICON_SIZE} />
      </Animated.View>
    </View>
  );
}

function TabButton({
  tab,
  isFocused,
  width,
  onPress,
}: {
  tab: TabDef;
  isFocused: boolean;
  width: number;
  onPress: () => void;
}) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * progress.value,
    color: '#FFFFFF',
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={[styles.tab, { width }]}
    >
      <TabIcon Icon={tab.Icon} progress={progress} />
      <Animated.Text style={[styles.label, labelStyle]}>{tab.label}</Animated.Text>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.routeName === state.routes[state.index]?.name),
  );

  // Pill content width is measured at layout time so we can compute the
  // exact tab width and position the indicator. With flex:1 tabs the bar
  // adapts to any iPhone width.
  const [contentWidth, setContentWidth] = React.useState(0);
  const tabWidth = contentWidth > 0
    ? (contentWidth - TAB_GAP * (TABS.length - 1)) / TABS.length
    : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth === 0) return;
    indicatorX.value = withSpring(activeIndex * (tabWidth + TAB_GAP), {
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const pillStyle = useMemoStyle(colors);

  return (
    <View
      style={[
        styles.container,
        // Match the mockup's generous bottom gap — sits noticeably above
        // the iOS home-indicator gesture bar with breathing room.
        { bottom: Math.max(insets.bottom * 0.85, 22) },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={pillStyle.pill}
        onLayout={(e) =>
          setContentWidth(e.nativeEvent.layout.width - PILL_PADDING * 2)
        }
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: tabWidth, left: PILL_PADDING, top: PILL_PADDING, backgroundColor: colors.teal },
              indicatorStyle,
            ]}
          />
        ) : null}

        {TABS.map((tab) => {
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
              tab={tab}
              isFocused={isFocused}
              width={tabWidth}
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
          borderRadius: 28,
          padding: PILL_PADDING,
          position: 'relative',
          ...Shadows.tabBar,
        },
      }),
    [colors],
  );
}

const TAB_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // Match the mockup margins — generous breathing room on each side so
    // the pill reads as a floating dock, not a system tab bar.
    left: 22,
    right: 22,
    alignItems: 'stretch',
    zIndex: 30,
  },
  tab: {
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 1,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  indicator: {
    position: 'absolute',
    height: TAB_HEIGHT,
    borderRadius: 20,
  },
});

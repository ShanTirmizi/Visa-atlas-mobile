import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  Globe,
  Plane,
  ArrowLeftRight,
  BookOpen,
  MoreHorizontal,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Shadows, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabDef {
  routeName: string;
  icon: (props: { color: string; size: number }) => React.ReactNode;
  isCenter?: boolean;
}

const TABS: TabDef[] = [
  {
    routeName: 'trips',
    icon: ({ color, size }) => <Plane color={color} size={size} />,
  },
  {
    routeName: 'compare',
    icon: ({ color, size }) => <ArrowLeftRight color={color} size={size} />,
  },
  {
    routeName: 'index',
    icon: ({ color, size }) => <Globe color={color} size={size} />,
    isCenter: true,
  },
  {
    routeName: 'guides',
    icon: ({ color, size }) => <BookOpen color={color} size={size} />,
  },
  {
    routeName: 'more',
    icon: ({ color, size }) => <MoreHorizontal color={color} size={size} />,
  },
];

function TabButton({
  tab,
  isFocused,
  onPress,
  colors,
  styles,
}: {
  tab: TabDef;
  isFocused: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  if (tab.isCenter) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        style={styles.centerButtonOuter}
      >
        <Animated.View
          style={[
            styles.centerButton,
            isFocused && styles.centerButtonActive,
            animatedStyle,
          ]}
        >
          {tab.icon({ color: '#FFFFFF', size: 26 })}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={styles.tabButton}
    >
      <Animated.View
        style={[
          styles.tabInner,
          isFocused && styles.tabInnerActive,
          animatedStyle,
        ]}
      >
        {tab.icon({
          color: isFocused ? colors.primary : colors.textMuted,
          size: 24,
        })}
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { bottom: insets.bottom + 10 }]}>
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex(
            (r) => r.name === tab.routeName
          );
          if (routeIndex === -1) return null;
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[routeIndex].key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(state.routes[routeIndex].name);
            }
          };

          return (
            <TabButton
              key={tab.routeName}
              tab={tab}
              isFocused={isFocused}
              onPress={onPress}
              colors={colors}
              styles={styles}
            />
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 20,
      right: 20,
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: 32,
      height: 68,
      width: '100%',
      paddingHorizontal: 8,
      ...Shadows.cardRaised,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 56,
    },
    tabInner: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 40,
      borderRadius: 14,
    },
    tabInnerActive: {
      backgroundColor: colors.primary + '20',
    },
    centerButtonOuter: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -18,
    },
    centerButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.glow(colors.accent, 0.3),
    },
    centerButtonActive: {
      backgroundColor: colors.primary,
      ...Shadows.glow(colors.primary, 0.35),
    },
  });

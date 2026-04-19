import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Plane, Globe, ArrowLeftRight, BookOpen } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabDef {
  routeName: string;
  icon: (props: { color: string; size: number }) => React.ReactNode;
}

// Order per spec: Trips / Explore / Compare / Guides
const TABS: TabDef[] = [
  { routeName: 'trips', icon: ({ color, size }) => <Plane color={color} size={size} strokeWidth={2} /> },
  { routeName: 'explore', icon: ({ color, size }) => <Globe color={color} size={size} strokeWidth={2} /> },
  { routeName: 'compare', icon: ({ color, size }) => <ArrowLeftRight color={color} size={size} strokeWidth={2} /> },
  { routeName: 'guides', icon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={2} /> },
];

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 22) }]} pointerEvents="box-none">
      <View style={styles.pill}>
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
            <Pressable
              key={tab.routeName}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              {tab.icon({
                color: isFocused ? colors.ink : 'rgba(255,255,255,0.6)',
                size: 18,
              })}
            </Pressable>
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
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 30,
    },
    pill: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.ink,
      borderRadius: 999,
      padding: 6,
      ...Shadows.tabBar,
    },
    tab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    tabActive: {
      backgroundColor: '#FFFFFF',
    },
  });

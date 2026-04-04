import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface SegmentedControlProps {
  tabs: string[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

export default function SegmentedControl({ tabs, activeIndex, onTabPress }: SegmentedControlProps) {
  const { colors } = useTheme();
  const tabWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  // Animate the indicator when activeIndex changes
  useEffect(() => {
    translateX.value = withSpring(activeIndex * tabWidth.value, {
      damping: 20,
      stiffness: 200,
      mass: 0.8,
    });
  }, [activeIndex, tabWidth.value]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    const singleTabWidth = (width - 6) / tabs.length; // 6 = padding * 2 (3 each side)
    tabWidth.value = singleTabWidth;
    // Snap indicator to correct position without animation on first render
    translateX.value = activeIndex * singleTabWidth;
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: tabWidth.value,
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onLayout={handleLayout}
    >
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: colors.accent },
          indicatorStyle,
        ]}
      />

      {/* Tab buttons */}
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onTabPress(index)}
          style={styles.tab}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeIndex === index ? '#FFFFFF' : colors.textMuted },
            ]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.md,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

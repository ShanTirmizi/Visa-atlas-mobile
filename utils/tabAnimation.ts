import { withTiming, Easing } from 'react-native-reanimated';

// ─────────────────────────────────────────────────────────────
// Directional fade-slide for tab content swap.
//
// Pattern matches Apple Health / Linear / Arc — incoming content fades in
// while sliding ~16px from the direction of the tab tap. Subtle enough to
// feel premium (not a full page-push) while still giving the eye a spatial
// cue about which way state moved.
//
// Usage:
//   const dx = TABS.indexOf(active) >= TABS.indexOf(prev) ? 1 : -1;
//   <Animated.View entering={tabSlideIn(dx * 18)}>...</Animated.View>
// ─────────────────────────────────────────────────────────────

export const tabSlideIn = (dx: number) => (_values: unknown) => {
  'worklet';
  return {
    initialValues: {
      opacity: 0,
      transform: [{ translateX: dx }],
    },
    animations: {
      opacity: withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
      transform: [
        { translateX: withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }) },
      ],
    },
  };
};

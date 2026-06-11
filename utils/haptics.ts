// Centralized haptic vocabulary — premium apps speak a consistent touch
// language (Apple HIG: selection for picking among options, impact for a
// meaningful action firing, success for a completed flow). Every call is
// fire-and-forget and swallows errors (haptics are unavailable on some
// devices/simulators and must never break a press handler).
import * as Haptics from 'expo-haptics';

/** Picking among options: chips, segmented tabs, toggles, list selections. */
export const hapticSelect = () => {
  Haptics.selectionAsync().catch(() => {});
};

/** A meaningful action fired: generate, save, submit. */
export const hapticImpact = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** A flow completed successfully: trip ready, booking saved. */
export const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

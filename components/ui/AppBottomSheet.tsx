import React, { forwardRef, useMemo, useCallback } from 'react';
import { Dimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';

// ──────────────────────────────────────────────
// AppBottomSheet
//
// Canonical BottomSheetModal wrapper that encodes the CLAUDE.md-mandated
// pattern:  enableDynamicSizing + maxDynamicContentSize capped just below
// the Dynamic Island / status bar (Apple Maps / Airbnb convention).
//
// Usage:
//   const sheetRef = useRef<BottomSheetModal>(null);
//   <AppBottomSheet ref={sheetRef}>
//     <BottomSheetScrollView>…</BottomSheetScrollView>
//   </AppBottomSheet>
//
// Call sheetRef.current?.present() / .dismiss() as usual.
// ──────────────────────────────────────────────

interface AppBottomSheetProps {
  children: React.ReactNode;
  /**
   * Override the sheet background colour.
   * Defaults to `colors.background`.
   * Pass a booking-type colour for booking sheets (per CLAUDE.md convention).
   */
  backgroundColor?: string;
  /**
   * Custom handle indicator colour.
   * Defaults to `colors.inkFaint` (subtle on light bg) or
   * `colors.solidTextMuted` (soft white) when `backgroundColor` is an
   * opaque coloured surface.
   */
  handleColor?: string;
  /**
   * Forwards to BottomSheetModal's onChange. Index `-1` means fully closed.
   * Useful for callers that need to distinguish gesture-dismiss from a
   * programmatic dismiss-after-submit.
   */
  onChange?: (index: number) => void;
  /**
   * gorhom keyboard behavior. Defaults to gorhom's "interactive" (sheet
   * shifts up by keyboard height, clamped to its max position). Sheets whose
   * inputs sit low in long scrollable content should pass "extend" so the
   * sheet raises to its top position and the scrollable shrinks above the
   * keyboard (VisaChatSheet recipe). Only engages for BottomSheetTextInput.
   */
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
}

export const AppBottomSheet = forwardRef<BottomSheetModal, AppBottomSheetProps>(
  function AppBottomSheet(
    { children, backgroundColor, handleColor, onChange, keyboardBehavior },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    // Cap sheet just below the Dynamic Island / status bar — industry standard.
    const maxDynamicContentSize = useMemo(
      () => Dimensions.get('window').height - insets.top - 10,
      [insets.top],
    );

    const resolvedBg = backgroundColor ?? colors.background;
    const resolvedHandle =
      handleColor ?? (backgroundColor ? colors.solidTextMuted : colors.inkFaint);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.4}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        maxDynamicContentSize={maxDynamicContentSize}
        // Canonical keyboard defaults for every AppBottomSheet consumer:
        // "restore" returns the sheet to its detent when the keyboard
        // dismisses (gorhom's default "none" left it stranded lifted), and
        // adjustResize is gorhom's documented Android requirement — the
        // inherited adjustPan default pans the whole window and fights
        // edge-to-edge. Matches EditDaySheet / VisaChatSheet.
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedBg, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: resolvedHandle, width: 36, height: 4 }}
        onChange={onChange}
      >
        {children}
      </BottomSheetModal>
    );
  },
);

export default AppBottomSheet;

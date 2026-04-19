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
   * `rgba(255,255,255,0.5)` when `backgroundColor` is an opaque colour.
   */
  handleColor?: string;
}

export const AppBottomSheet = forwardRef<BottomSheetModal, AppBottomSheetProps>(
  function AppBottomSheet({ children, backgroundColor, handleColor }, ref) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    // Cap sheet just below the Dynamic Island / status bar — industry standard.
    const maxDynamicContentSize = useMemo(
      () => Dimensions.get('window').height - insets.top - 10,
      [insets.top],
    );

    const resolvedBg = backgroundColor ?? colors.background;
    const resolvedHandle =
      handleColor ?? (backgroundColor ? 'rgba(255,255,255,0.5)' : colors.inkFaint);

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
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedBg, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: resolvedHandle, width: 36, height: 4 }}
      >
        {children}
      </BottomSheetModal>
    );
  },
);

export default AppBottomSheet;

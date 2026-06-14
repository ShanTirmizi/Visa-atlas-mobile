import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { useKeyboardRestore } from '@/hooks/useKeyboardRestore';

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

// ──────────────────────────────────────────────
// Sheet-settled context
//
// `true` once the sheet has finished animating to an open resting position,
// `false` while it is presenting, snapping, or dismissing. Consumers gate
// selection presses on it (e.g. CountryPickerSheet rows): a tap that lands
// mid-present-animation fires the selection from a half-presented state, and
// the resulting dismiss can wedge the stacked gorhom modal underneath into a
// partially touch-dead state (QA-reproduced with CountryPickerSheet over
// TripPlannerSheet). The guard is invisible — the present animation is
// ~300ms, so rows are never visually dimmed.
//
// Default is `true` (fail-open): if a consumer renders outside an
// AppBottomSheet, the guard must never leave it permanently inert.
// ──────────────────────────────────────────────

const SheetSettledContext = createContext(true);

/**
 * True once the surrounding AppBottomSheet has settled at an open position —
 * gorhom's onChange landed at index >= 0. False from the moment an
 * index-changing animation starts (onAnimate) until it lands. Designed for
 * gating present/dismiss-adjacent presses; verified against gorhom v5.2.8:
 * every onAnimate is followed by an onChange at animation completion
 * (BottomSheet.tsx `animateToPosition` → `animateToPositionCompleted`), so a
 * tap immediately after the sheet lands always goes through.
 */
export function useSheetSettled(): boolean {
  return useContext(SheetSettledContext);
}

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
   * Forwards to BottomSheetModal's onDismiss — fires exactly when the close
   * animation completes (gesture or programmatic). This is the handoff
   * point for present-another-sheet / navigate-after-dismiss flows
   * (TripPlannerSheet's pendingTripIdRef recipe); never approximate it
   * with a setTimeout.
   */
  onDismiss?: () => void;
  /**
   * gorhom keyboard behavior. DEFAULTS to "extend" (the safe form default —
   * gorhom's own "interactive" default over-lifts a short dynamic sheet and
   * leaves a keyboard-height dead band; "extend" raises the sheet to its top
   * position with the scrollable shrinking above the keyboard). For a
   * multi-field FORM with a primary CTA, pass "fillParent" AND a
   * `footerComponent` holding that CTA — gorhom pins the footer flush on the
   * keyboard and the sheet expands to the Dynamic Island with zero dead band
   * (the verified TripPlannerSheet / AddBookingSheet recipe). Only engages for
   * a focused BottomSheetTextInput.
   */
  keyboardBehavior?: 'interactive' | 'extend' | 'fillParent';
  /**
   * Optional gorhom footer (renderFooter) for a CTA that must hug the
   * keyboard. gorhom drives it up via animatedFooterPosition.
   */
  footerComponent?: React.FC<BottomSheetFooterProps>;
  /**
   * Forwarded to BottomSheetModal. Pass 0 to remove the ~80pt over-drag band
   * below the content at rest (recommended for footer forms).
   */
  overDragResistanceFactor?: number;
}

export const AppBottomSheet = forwardRef<BottomSheetModal, AppBottomSheetProps>(
  function AppBottomSheet(
    {
      children, backgroundColor, handleColor, onChange, onDismiss,
      keyboardBehavior = 'extend', footerComponent, overDragResistanceFactor,
    },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    // Cap sheet just below the Dynamic Island / status bar — industry standard.
    const maxDynamicContentSize = useMemo(
      () => Dimensions.get('window').height - insets.top - 10,
      [insets.top],
    );

    // Settled tracking — false on mount and whenever the sheet starts
    // animating toward a position, true once onChange lands at an open
    // index. onChange(-1) on dismiss resets it for the next present.
    const [settled, setSettled] = useState(false);

    // Internal ref merged with the forwarded one so the keyboard-restore guard
    // can call snapToIndex(0) on this modal (see useKeyboardRestore).
    const modalRef = useRef<BottomSheetModal>(null);
    const setRefs = useCallback(
      (node: BottomSheetModal | null) => {
        modalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<BottomSheetModal | null>).current = node;
      },
      [ref],
    );
    const { handleAnimateForRestore } = useKeyboardRestore(modalRef);

    const handleAnimate = useCallback(
      (fromIndex: number, toIndex: number) => {
        setSettled(false);
        handleAnimateForRestore(fromIndex, toIndex);
      },
      [handleAnimateForRestore],
    );

    const handleChange = useCallback(
      (index: number) => {
        setSettled(index >= 0);
        // Preserve the existing public onChange contract.
        onChange?.(index);
      },
      [onChange],
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
        ref={setRefs}
        enableDynamicSizing
        maxDynamicContentSize={maxDynamicContentSize}
        // topInset clamps the sheet's POSITION — maxDynamicContentSize only
        // caps HEIGHT. Without it, gorhom's interactive keyboard shift can
        // push a focused sheet above the Dynamic Island (shipped to
        // TestFlight as exactly that bug on the planner sheet). gorhom
        // shrinks the hosting container by topInset, so the sheet physically
        // cannot render above this line; percent/dynamic sizing resolve
        // against the inset container, consistent with the height cap above.
        topInset={insets.top + 10}
        // "push" stacks this sheet over any already-open modal WITHOUT
        // minimizing it. The default "switch" minimizes the sheet below and
        // later restores it via snapToIndex(savedIndex) — but the saved
        // index can be captured while the keyboard has temporarily inflated
        // that sheet's detents, so the restore throws "'index' was provided
        // but out of the provided snap points range" and crashes the submit
        // path (hit by TripRefinementSheet presenting over TripPlannerSheet).
        stackBehavior="push"
        // Canonical keyboard defaults for every AppBottomSheet consumer:
        // "restore" returns the sheet to its detent when the keyboard
        // dismisses (gorhom's default "none" left it stranded lifted), and
        // adjustResize is gorhom's documented Android requirement — the
        // inherited adjustPan default pans the whole window and fights
        // edge-to-edge. Matches EditDaySheet / the visa-chat screen
        // (app/visa-chat/[guideId].tsx).
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        footerComponent={footerComponent}
        overDragResistanceFactor={overDragResistanceFactor}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedBg, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: resolvedHandle, width: 36, height: 4 }}
        onAnimate={handleAnimate}
        onChange={handleChange}
        onDismiss={onDismiss}
      >
        <SheetSettledContext.Provider value={settled}>
          {children}
        </SheetSettledContext.Provider>
      </BottomSheetModal>
    );
  },
);

export default AppBottomSheet;

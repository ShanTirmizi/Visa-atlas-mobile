import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Dimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import BottomSheetKeyboardAwareScrollView from '@/components/ui/BottomSheetKeyboardAwareScrollView';

// ════════════════════════════════════════════════════════════════════════
// FormSheet — the ONE canonical keyboard-aware FORM bottom sheet.
//
// Every form sheet in the app (booking, edit-day, planner, refinement,
// verify-email) routes through this so the keyboard recipe lives in exactly
// one place and can't drift. The recipe was settled by live in-simulator
// A/B testing (see the kbprobe route history), not by guessing:
//
//   1. enableDynamicSizing + maxDynamicContentSize=cap  → the sheet HUGS its
//      content at rest (a 3-field form rests short, a 9-field form rests at
//      ~90%). This is what kills the "empty band below the fields" — a fixed
//      ['90%'] holds a tall shell over short content; dynamic sizing never
//      does. Verified: short content rests with the CTA flush under the last
//      field, no gap.
//
//   2. keyboardBehavior="interactive"  → on focus the WHOLE content-hugged
//      sheet LIFTS above the keyboard (a translate, not a resize). All fields
//      and the CTA stay visible, and crucially the sheet does NOT inflate, so
//      no empty band appears. This is the opposite of pairing the sheet with a
//      keyboard-aware *scroll*: that scroll appends a keyboard-height spacer
//      that gorhom measures into its dynamic detent and balloons the sheet to
//      the cap, stranding short content under a big gap (the booking-sheet
//      "empty states" bug). So FORMS LIFT, they do not inflate.
//
//   3. PLAIN BottomSheetScrollView (NOT the keyboard-aware one) by default —
//      see (2). The keyboard-aware scroll is opt-in via `scrollAware` ONLY for
//      genuinely tall forms (content already ~90%) where the sheet is meant to
//      sit at the cap and a focused low field must scroll into view; there the
//      spacer can't inflate past the cap so there's no gap.
//
//   4. The CTA rides a BottomSheetFooter (bottomInset=0) flush on the keys.
//      TEXT INPUTS LIVE IN THE BODY, NEVER THE FOOTER: a controlled input in a
//      footer that re-renders per keystroke makes gorhom remount the footer and
//      the keyboard collapses after one character (the planner bug). The footer
//      is for the CTA (and other non-input chrome) only.
//
//   5. keyboardBlurBehavior="restore" + topInset clamp + adjustResize +
//      stackBehavior="push" — the standard gorhom hygiene the rest of the app
//      already uses.
// ════════════════════════════════════════════════════════════════════════

// Settled context (ported from AppBottomSheet) — consumers gate selection
// presses on it so a tap mid-present-animation can't wedge a stacked sheet.
const SheetSettledContext = createContext(true);
export function useFormSheetSettled(): boolean {
  return useContext(SheetSettledContext);
}

export interface FormSheetProps {
  /** Body fields. Every text input here MUST be a BottomSheetTextInput. */
  children: React.ReactNode;
  /**
   * Pinned CTA content. Rendered inside a BottomSheetFooter that rides the
   * keyboard. MUST NOT contain a text input (the footer remounts on state
   * changes — an input here loses focus). Pass null to hide it.
   */
  footer?: React.ReactNode;
  /** Footer wrapper background — opaque so the body slides under it cleanly. */
  footerBackgroundColor?: string;
  /** Sheet background. Defaults to colors.surface. */
  backgroundColor?: string;
  /** Handle indicator colour. Defaults to colors.inkFaint. */
  handleColor?: string;
  /**
   * keyboard behavior. "interactive" (default) LIFTS the content-hugged sheet
   * above the keyboard — the right choice for short/medium forms (no gap, all
   * fields visible). Only switch to "extend" for a tall form paired with
   * `scrollAware`.
   */
  keyboardBehavior?: 'interactive' | 'extend';
  /**
   * Use the keyboard-aware scroll body (scrolls the focused input above the
   * keyboard). OFF by default — it inflates a short sheet to the cap. Turn ON
   * only for tall forms (content already ~cap) where a low field must scroll
   * into view. When on, pair with keyboardBehavior="extend".
   */
  scrollAware?: boolean;
  /** Forwarded to BottomSheetModal.onChange. Index -1 == closed. */
  onChange?: (index: number) => void;
  /** Forwarded to BottomSheetModal.onDismiss. */
  onDismiss?: () => void;
  /** Defaults to true. */
  enablePanDownToClose?: boolean;
  /** Extra style merged into the scroll content container. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Backdrop opacity. Default 0.4 — unified across the app's sheets. */
  backdropOpacity?: number;
  /** keyboardShouldPersistTaps for the scroll body. Default "handled". */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export const FormSheet = forwardRef<BottomSheetModal, FormSheetProps>(
  function FormSheet(
    {
      children,
      footer,
      footerBackgroundColor,
      backgroundColor,
      handleColor,
      keyboardBehavior = 'interactive',
      scrollAware = false,
      onChange,
      onDismiss,
      enablePanDownToClose = true,
      contentContainerStyle,
      backdropOpacity = 0.4,
      keyboardShouldPersistTaps = 'handled',
    },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const maxDynamicContentSize = useMemo(
      () => Dimensions.get('window').height - insets.top - 10,
      [insets.top],
    );

    const [footerHeight, setFooterHeight] = useState(0);
    const [settled, setSettled] = useState(false);

    const handleAnimate = useCallback(() => setSettled(false), []);
    const handleChange = useCallback(
      (index: number) => {
        setSettled(index >= 0);
        onChange?.(index);
      },
      [onChange],
    );

    const resolvedBg = backgroundColor ?? colors.surface;
    const resolvedHandle = handleColor ?? colors.inkFaint;
    const resolvedFooterBg = footerBackgroundColor ?? resolvedBg;

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={backdropOpacity}
        />
      ),
      [backdropOpacity],
    );

    // The footer rides the keyboard (animatedFooterPosition) and is measured so
    // the body can reserve room for it. Recreating this on `footer` change is
    // safe: the focused input is in the BODY, so a footer remount never steals
    // focus (see the file header, rule 4).
    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => {
        if (footer == null) return null;
        return (
          <BottomSheetFooter {...props} bottomInset={0}>
            <View
              onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 14),
                backgroundColor: resolvedFooterBg,
              }}
            >
              {footer}
            </View>
          </BottomSheetFooter>
        );
      },
      [footer, insets.bottom, resolvedFooterBg],
    );

    const hasFooter = footer != null;
    const ScrollBody = scrollAware
      ? BottomSheetKeyboardAwareScrollView
      : BottomSheetScrollView;

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        maxDynamicContentSize={maxDynamicContentSize}
        topInset={insets.top + 10}
        stackBehavior="push"
        enablePanDownToClose={enablePanDownToClose}
        overDragResistanceFactor={0}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        footerComponent={hasFooter ? renderFooter : undefined}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: resolvedBg, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: resolvedHandle, width: 36, height: 4 }}
        onAnimate={handleAnimate}
        onChange={handleChange}
        onDismiss={onDismiss}
      >
        <ScrollBody
          // Only meaningful when scrollAware — clears the pinned CTA.
          bottomOffset={hasFooter ? footerHeight + 12 : 12}
          // Caller style first, then FormSheet's footer reservation LAST so it
          // wins — a low field must never hide behind the pinned CTA. Callers
          // should not set paddingBottom themselves.
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: hasFooter ? footerHeight + 8 : 16 },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
        >
          <SheetSettledContext.Provider value={settled}>
            {children}
          </SheetSettledContext.Provider>
        </ScrollBody>
      </BottomSheetModal>
    );
  },
);

export default FormSheet;

// hooks/useKeyboardRestore.ts
//
// Belt-and-suspenders restore for a dynamic-sized @gorhom/bottom-sheet form.
//
// Why this exists: gorhom's keyboardBlurBehavior="restore" resolves the
// resting position against `animatedSnapPoints[currentIndex]` AT THE MOMENT the
// keyboard hides. With enableDynamicSizing the snap-point array is recomputed
// from the container height, which is still inflated during the keyboard frame
// — so the "resting" detent it restores to can be a stale pixel and the sheet
// lands lifted (the float-on-blur bug; gorhom #1894/#811/#1374/#2544). Forcing
// snapToIndex(0) one frame AFTER keyboardDidHide re-resolves the sheet against
// the SETTLED (post-keyboard) content detent, pinning the bottom flush.
//
//   const { handleAnimateForRestore } = useKeyboardRestore(sheetRef);
//   <BottomSheetModal ... onAnimate={handleAnimateForRestore} />
//
// A single dynamic content detent means index 0 is always valid, so snapToIndex
// can never throw "index out of snap points range". The onAnimate guard sets
// `closing` the instant gorhom starts a dismiss (toIndex < 0) — which always
// fires BEFORE the keyboard finishes hiding — so the re-snap is skipped when the
// sheet is on its way out and can never re-open a dismissing sheet.

import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

export function useKeyboardRestore(
  sheetRef: React.RefObject<BottomSheetModal | null>,
) {
  const closingRef = useRef(false);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (closingRef.current) return; // dismissing — don't re-snap (no re-open)
      // One frame lets gorhom recompute the dynamic detent against the settled
      // container before we pin to it. rAF, not a magic-number setTimeout.
      requestAnimationFrame(() => sheetRef.current?.snapToIndex(0));
    });
    return () => sub.remove();
  }, [sheetRef]);

  // Wire to BottomSheetModal.onAnimate. Compose with any existing handler.
  const handleAnimateForRestore = useCallback(
    (_fromIndex: number, toIndex: number) => {
      closingRef.current = toIndex < 0;
    },
    [],
  );

  return { handleAnimateForRestore };
}

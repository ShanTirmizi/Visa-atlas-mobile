// components/ui/BottomSheetKeyboardAwareScrollView.tsx
//
// Canonical wrapper for using react-native-keyboard-controller's
// KeyboardAwareScrollView inside @gorhom/bottom-sheet. Verbatim of the
// pattern from the RNKC docs:
//   https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view#integration-with-gorhombottom-sheet
//
// Why this exists:
//   KAW listens to keyboard frame changes via Reanimated and scrolls the
//   focused TextInput above the keyboard with the right delta — same
//   algorithm Apple Mail compose / Notes use. A previous custom hook
//   (utils/keyboardAwareScroll) reimplemented this with measure() + a
//   one-shot delta, which double-counted the bottom sheet's own
//   keyboardBehavior="extend" shift and over-scrolled the form.
//
//   Per CLAUDE.md: "do not invent custom scroll/keyboard math when a
//   library or platform API already handles it. Use
//   react-native-keyboard-controller's useReanimatedKeyboardAnimation /
//   KeyboardAwareScrollView, before writing your own."

import { memo } from 'react';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';
import {
  SCROLLABLE_TYPE,
  createBottomSheetScrollableComponent,
  type BottomSheetScrollableProps,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import Reanimated from 'react-native-reanimated';

const AnimatedScrollView = Reanimated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const Component = createBottomSheetScrollableComponent<
  BottomSheetScrollViewMethods,
  KeyboardAwareScrollViewProps & BottomSheetScrollableProps
>(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedScrollView);

const BottomSheetKeyboardAwareScrollView = memo(Component);
BottomSheetKeyboardAwareScrollView.displayName =
  'BottomSheetKeyboardAwareScrollView';

export default BottomSheetKeyboardAwareScrollView;

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheetKeyboardAwareScrollView from '@/components/ui/BottomSheetKeyboardAwareScrollView';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, type ThemeColors } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { PillButton } from '@/components/ui/PillButton';

// Sheet rests at its dynamic content height — no snap points needed.
// BottomSheetKeyboardAwareScrollView (RNKC) measures the focused TextInput
// itself and scrolls it above the keyboard with the right delta.
//
// Keyboard ownership: gorhom has NO way to disable its keyboard handling —
// the default keyboardBehavior is "interactive" (there is no "none"), and it
// engages whenever a BottomSheetTextInput focuses. That's fine here: the
// interactive shift is clamped to the sheet's max position, and because this
// form's dynamic height sits at/near maxDynamicContentSize the sheet barely
// moves — RNKC's KAW is the effective owner and scrolls the focused input
// the remaining distance. We set "interactive" explicitly to document that.

export interface EditableDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject?: string;
}

export interface EditDaySheetProps {
  tripId: string;
  dayIndex: number;
  /** Full itinerary — the sheet edits one entry and writes the whole array back. */
  itinerary: EditableDay[];
  onSaved?: (updated: EditableDay[]) => void;
}

export interface EditDaySheetRef {
  present: () => void;
  dismiss: () => void;
}

const EditDaySheet = forwardRef<EditDaySheetRef, EditDaySheetProps>(
  ({ tripId, dayIndex, itinerary, onSaved }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const updateField = useMutation(api.trips.updateTripField);

    const initial = itinerary[dayIndex];

    const [title, setTitle] = useState(initial?.title ?? '');
    const [morningPlace, setMorningPlace] = useState(initial?.morningPlace ?? '');
    const [morning, setMorning] = useState(initial?.morning ?? '');
    const [afternoonPlace, setAfternoonPlace] = useState(initial?.afternoonPlace ?? '');
    const [afternoon, setAfternoon] = useState(initial?.afternoon ?? '');
    const [eveningPlace, setEveningPlace] = useState(initial?.eveningPlace ?? '');
    const [evening, setEvening] = useState(initial?.evening ?? '');
    const [tip, setTip] = useState(initial?.tip ?? '');
    const [saving, setSaving] = useState(false);

    // Reset local state to current itinerary every time the sheet opens, so
    // the user always sees the latest server state on re-entry.
    const resetState = useCallback(() => {
      const d = itinerary[dayIndex];
      setTitle(d?.title ?? '');
      setMorningPlace(d?.morningPlace ?? '');
      setMorning(d?.morning ?? '');
      setAfternoonPlace(d?.afternoonPlace ?? '');
      setAfternoon(d?.afternoon ?? '');
      setEveningPlace(d?.eveningPlace ?? '');
      setEvening(d?.evening ?? '');
      setTip(d?.tip ?? '');
      setSaving(false);
    }, [itinerary, dayIndex]);

    useImperativeHandle(ref, () => ({
      present: () => {
        resetState();
        bottomSheetRef.current?.present();
      },
      dismiss: () => bottomSheetRef.current?.dismiss(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    const s = useMemo(() => makeStyles(colors), [colors]);

    const handleSave = async () => {
      setSaving(true);
      try {
        const updated: EditableDay[] = itinerary.map((d, i) =>
          i === dayIndex
            ? {
                ...d,
                title: title.trim() || d.title,
                morningPlace: morningPlace.trim() || undefined,
                morning: morning.trim(),
                afternoonPlace: afternoonPlace.trim() || undefined,
                afternoon: afternoon.trim(),
                eveningPlace: eveningPlace.trim() || undefined,
                evening: evening.trim(),
                tip: tip.trim(),
              }
            : d,
        );

        await updateField({
          id: tripId as Id<'trips'>,
          field: 'itinerary',
          value: JSON.stringify(updated),
        });

        onSaved?.(updated);
        bottomSheetRef.current?.dismiss();
      } finally {
        setSaving(false);
      }
    };

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get('window').height - insets.top - 10}
        topInset={insets.top + 10}
        // "interactive" is gorhom's default (there is no "none") — set
        // explicitly because keyboard avoidance is shared with RNKC's KAW;
        // see the comment block near the top of this file.
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
      >
        <BottomSheetKeyboardAwareScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          // Distance between the focused input's bottom and the keyboard
          // top after scrolling. Matches Apple Mail / Notes breathing room.
          bottomOffset={24}
        >
          {/* Editorial header */}
          <View style={s.header}>
            <Text style={[Type.kicker, { color: colors.inkMute }]}>EDIT DAY {initial?.day ?? dayIndex + 1}</Text>
            <Text
              style={{
                fontFamily: FontFamily.display,
                fontSize: 24,
                fontWeight: '500',
                letterSpacing: -24 * 0.018,
                color: colors.ink,
                marginTop: 2,
                lineHeight: 26,
              }}
            >
              Make it{' '}
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                }}
              >
                yours
              </Text>
              <Text style={{ color: colors.coral }}>.</Text>
            </Text>
            <Squiggle width={120} color={colors.coral} style={{ marginTop: 4 }} />
          </View>

          {/* Title */}
          <Field
            colors={colors}
            label="DAY TITLE"
            value={title}
            onChangeText={setTitle}
            placeholder="A name for this day"
            multiline={false}
          />

          {/* Morning */}
          <Field
            colors={colors}
            label="MORNING · PLACE"
            value={morningPlace}
            onChangeText={setMorningPlace}
            placeholder="e.g. Tegallalang terraces"
          />
          <Field
            colors={colors}
            label="MORNING · DETAILS"
            value={morning}
            onChangeText={setMorning}
            placeholder="What you'll do — sunrise walk, breakfast spot, etc."
            multiline
          />

          {/* Afternoon */}
          <Field
            colors={colors}
            label="AFTERNOON · PLACE"
            value={afternoonPlace}
            onChangeText={setAfternoonPlace}
            placeholder="e.g. Goa Gajah temple"
          />
          <Field
            colors={colors}
            label="AFTERNOON · DETAILS"
            value={afternoon}
            onChangeText={setAfternoon}
            placeholder="The afternoon plan"
            multiline
          />

          {/* Evening */}
          <Field
            colors={colors}
            label="EVENING · PLACE"
            value={eveningPlace}
            onChangeText={setEveningPlace}
            placeholder="e.g. Locavore To Go"
          />
          <Field
            colors={colors}
            label="EVENING · DETAILS"
            value={evening}
            onChangeText={setEvening}
            placeholder="Dinner, sunset, anything else"
            multiline
          />

          {/* Local tip */}
          <Field
            colors={colors}
            label="LOCAL TIP"
            value={tip}
            onChangeText={setTip}
            placeholder="A line of advice for this day"
            multiline
          />

          <PillButton
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            variant="primary"
            fullWidth
            disabled={saving}
            style={{ marginTop: 8, marginBottom: 8 }}
          />
        </BottomSheetKeyboardAwareScrollView>
      </BottomSheetModal>
    );
  },
);

EditDaySheet.displayName = 'EditDaySheet';
export default EditDaySheet;

// ════════════════════════════════════════════════════════════════════════
// Field — labeled editable input
// ════════════════════════════════════════════════════════════════════════
function Field({
  colors,
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  // KAW (BottomSheetKeyboardAwareScrollView) measures the focused
  // TextInput itself via native focus events, so no wrapper ref or
  // onFocus dance is needed here.
  return (
    <View
      style={{
        marginBottom: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9, letterSpacing: 9 * 0.18 }]}>
        {label}
      </Text>
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        style={{
          fontFamily: multiline ? FontFamily.regular : FontFamily.displayItalic,
          fontStyle: multiline ? 'normal' : 'italic',
          fontSize: multiline ? 14 : 16,
          lineHeight: multiline ? 20 : 20,
          color: colors.ink,
          marginTop: 4,
          padding: 0,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      padding: 18,
      paddingBottom: 32,
    },
    header: {
      marginBottom: 16,
    },
  });

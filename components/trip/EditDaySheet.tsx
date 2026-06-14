import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetScrollView,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import type { ItineraryDay, StopSlot } from '@/types/itinerary';
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

/** The sheet edits the shared itinerary-day contract (types/itinerary.ts)
 *  — alias retained for existing import sites. */
export type EditableDay = ItineraryDay;

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
    const { showToast } = useToast();
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

    // Slot prose as LOADED into the form — the baseline for the
    // "did the user edit this slot?" check in handleSave. Comparing
    // against the live `itinerary` prop instead would mark every slot
    // edited if a tweakDay/collaborator rewrite lands while the sheet is
    // open, reverting the rewrite's prose and destroying its stops.
    const loadedProseRef = useRef({
      morning: initial?.morning ?? '',
      afternoon: initial?.afternoon ?? '',
      evening: initial?.evening ?? '',
    });

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
      loadedProseRef.current = {
        morning: d?.morning ?? '',
        afternoon: d?.afternoon ?? '',
        evening: d?.evening ?? '',
      };
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
          // 0.4 — unified with AppBottomSheet / the booking sheets.
          opacity={0.4}
        />
      ),
      [],
    );

    // Pinned-footer height (measured) so the scroll body reserves room for it.
    const [footerHeight, setFooterHeight] = useState(0);

    const s = useMemo(() => makeStyles(colors), [colors]);

    const handleSave = async () => {
      setSaving(true);
      try {
        const updated: EditableDay[] = itinerary.map((d, i) => {
          if (i !== dayIndex) return d;

          const nextMorning = morning.trim();
          const nextAfternoon = afternoon.trim();
          const nextEvening = evening.trim();

          // A manual prose edit makes that slot's structured stops stale —
          // the user rewrote the slot's narrative, so the LLM-emitted stops
          // no longer describe it. Drop ONLY the edited slots' stops (the
          // day screen then falls back to prose rendering for that slot);
          // untouched slots keep theirs. LLM tweak paths (tweakDay / chat
          // apply) rewrite stops together with the prose instead, so they
          // never go stale that way.
          //
          // Compare against the prose AS LOADED (loadedProseRef), not the
          // live `d` — if a rewrite landed while the sheet was open, the
          // live prose differs from what the user saw and every slot would
          // wrongly read as "edited".
          const loaded = loadedProseRef.current;
          const editedSlots = new Set<StopSlot>();
          if (nextMorning !== loaded.morning.trim()) editedSlots.add('morning');
          if (nextAfternoon !== loaded.afternoon.trim()) editedSlots.add('afternoon');
          if (nextEvening !== loaded.evening.trim()) editedSlots.add('evening');
          const stops =
            Array.isArray(d.stops) && editedSlots.size > 0
              ? d.stops.filter((s) => !editedSlots.has(s.slot))
              : d.stops;

          return {
            ...d,
            title: title.trim() || d.title,
            morningPlace: morningPlace.trim() || undefined,
            morning: nextMorning,
            afternoonPlace: afternoonPlace.trim() || undefined,
            afternoon: nextAfternoon,
            eveningPlace: eveningPlace.trim() || undefined,
            evening: nextEvening,
            tip: tip.trim(),
            // Days without stops keep no key (undefined is dropped by
            // JSON.stringify, matching the stored shape).
            stops,
          };
        });

        await updateField({
          id: tripId as Id<'trips'>,
          field: 'itinerary',
          value: JSON.stringify(updated),
        });

        onSaved?.(updated);
        bottomSheetRef.current?.dismiss();
      } catch {
        // Keep the sheet open with the user's edits intact — a silent
        // failure here read as "saved" while the trip stayed unchanged.
        showToast('error', "Couldn't save — try again.");
      } finally {
        setSaving(false);
      }
    };

    // ── Pinned footer — the Save CTA. gorhom lifts it flush onto the keyboard
    // (animatedFooterPosition); paired with keyboardBehavior="extend" the
    // sheet rises to the Dynamic Island, the body fills, and the CTA hugs the
    // keys with no dead band. Replaces the old KAW+interactive combo that
    // stranded the bottom fields/CTA in a band. ────────────────────────────
    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={{
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 14),
              // Opaque so the scroll body slides cleanly underneath it.
              backgroundColor: colors.surface,
            }}
          >
            <PillButton
              label={saving ? 'Saving…' : 'Save changes'}
              onPress={handleSave}
              variant="primary"
              fullWidth
              disabled={saving}
            />
          </View>
        </BottomSheetFooter>
      ),
      [saving, handleSave, colors, insets.bottom],
    );

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing
        maxDynamicContentSize={Dimensions.get('window').height - insets.top - 10}
        topInset={insets.top + 10}
        // KEYBOARD: premium "expand to the Dynamic Island" recipe (verified
        // in-sim — see TripPlannerSheet's top-of-file note). "fillParent"
        // raises the sheet to topInset on focus; the Save CTA rides the
        // BottomSheetFooter below, which gorhom pins flush on the keyboard —
        // ZERO dead band, no second keyboard owner (the old KAW + "interactive"
        // double-counted and stranded the bottom fields/CTA above the keys).
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        overDragResistanceFactor={0}
        footerComponent={renderFooter}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: footerHeight }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          {/* Save CTA is rendered in the pinned BottomSheetFooter (renderFooter)
              so it hugs the keyboard with no dead band. */}
        </BottomSheetScrollView>
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

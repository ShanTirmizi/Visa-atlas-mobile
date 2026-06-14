import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { type Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { Spacing, FontFamily } from '@/constants/theme';
import { type BookingType } from '@/constants/bookings';
import { findMatchingTrip } from '@/utils/tripMatcher';
import BookingTypePicker from './BookingTypePicker';
import BookingForm, { type BookingFormData, type BookingFormHandle } from './BookingForm';

// ── Public API ─────────────────────────────────────────────────────────
export interface BookingForEdit {
  // Plain string for caller compatibility (BookingDetailSheet's
  // BookingDetailData.id is a string) — narrowed to Id<'bookings'> at the
  // openForEdit boundary so everything downstream is strongly typed.
  id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  countryCode?: string;
  confirmationNumber?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  typeDetails?: Record<string, string>;
}

export interface AddBookingSheetRef {
  open: (prelinkedTripId?: string | Id<'trips'>) => void;
  openForEdit: (booking: BookingForEdit) => void;
  close: () => void;
}

interface AddBookingSheetProps {
  onBookingCreated?: () => void;
}

// ── Detail-key mapping ─────────────────────────────────────────────────
const detailsKeyForType = (type: BookingType): string => {
  if (type === 'car_rental') return 'carDetails';
  return `${type}Details`;
};

// ════════════════════════════════════════════════════════════════════════
// AddBookingSheet
// ════════════════════════════════════════════════════════════════════════
const AddBookingSheet = forwardRef<AddBookingSheetRef, AddBookingSheetProps>(
  ({ onBookingCreated }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // The form's submit lives in the pinned footer; drive it via this handle
    // and mirror the form's validity so the footer CTA enables/disables.
    const formRef = useRef<BookingFormHandle>(null);
    const [canSubmit, setCanSubmit] = useState(false);
    const [footerHeight, setFooterHeight] = useState(0);

    // Max sheet height: screen height minus status bar / Dynamic Island area
    const maxSheetHeight = Dimensions.get('window').height - insets.top - 10;

    // ── State ────────────────────────────────────────────────────────
    const [step, setStep] = useState<'type' | 'form'>('type');
    const [selectedType, setSelectedType] = useState<BookingType | null>(null);
    const [prelinkedTripId, setPrelinkedTripId] = useState<Id<'trips'> | undefined>();
    const [prefillData, setPrefillData] = useState<Partial<BookingFormData> | undefined>();
    const [editingId, setEditingId] = useState<Id<'bookings'> | null>(null);

    // ── Convex hooks ─────────────────────────────────────────────────
    const { isAuthenticated } = useConvexAuth();
    const createBooking = useMutation(api.bookings.createBooking);
    const linkBookingToTrip = useMutation(api.bookings.linkBookingToTrip);
    const updateBooking = useMutation(api.bookings.updateBooking);
    const trips = useQuery(api.trips.listTrips, isAuthenticated ? {} : 'skip');

    // ── Reset helper ─────────────────────────────────────────────────
    const resetState = useCallback(() => {
      setStep('type');
      setSelectedType(null);
      setPrefillData(undefined);
      setEditingId(null);
    }, []);

    // ── Imperative handle for parent ─────────────────────────────────
    useImperativeHandle(ref, () => ({
      open: (tripId?: string | Id<'trips'>) => {
        resetState();
        // Callers may pass a stringified id (e.g. String(trip._id)) — narrow
        // once at the public boundary; downstream stays strongly typed.
        setPrelinkedTripId(tripId != null ? (tripId as Id<'trips'>) : undefined);
        bottomSheetRef.current?.present();
      },
      openForEdit: (booking) => {
        resetState();
        // Same boundary narrowing as open() — see BookingForEdit.id comment.
        setEditingId(booking.id as Id<'bookings'>);
        setSelectedType(booking.type);
        setPrefillData({
          title: booking.title,
          startDate: booking.startDate,
          endDate: booking.endDate ?? '',
          location: booking.location ?? '',
          countryCode: booking.countryCode ?? '',
          confirmationNumber: booking.confirmationNumber ?? '',
          cost: booking.cost != null ? String(booking.cost) : '',
          currency: booking.currency ?? '',
          notes: booking.notes ?? '',
          typeDetails: booking.typeDetails ?? {},
        });
        setStep('form');
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Scan complete handler ────────────────────────────────────────
    const handleScanComplete = useCallback((type: BookingType, data: Partial<BookingFormData>) => {
      // Reaching the type picker means we're creating, not editing — a stale
      // editingId here would make save overwrite the original booking with a
      // mismatched type (updateBooking can't change `type`).
      setEditingId(null);
      setSelectedType(type);
      setPrefillData(data);
      setStep('form');
    }, []);

    // ── Step 1 handler: type selected ────────────────────────────────
    const handleTypeSelect = useCallback((type: BookingType) => {
      // See handleScanComplete — clear any stale edit session.
      setEditingId(null);
      setSelectedType(type);
      setPrefillData(undefined);
      setStep('form');
    }, []);

    // ── Step 2 handler: form submitted ───────────────────────────────
    const handleSubmit = useCallback(
      async (data: BookingFormData) => {
        if (!selectedType) return;

        // Build the type-specific details JSON
        const detailsKey = detailsKeyForType(selectedType);
        const hasDetails = Object.keys(data.typeDetails).length > 0;
        const detailsJson = hasDetails
          ? JSON.stringify(data.typeDetails)
          : undefined;

        // BookingForm submits a parseCostInput-normalised numeric string,
        // but guard with isFinite anyway — a NaN persisted here renders as
        // "$NaN" on every booking card.
        const costNumber = data.cost ? Number(data.cost) : NaN;
        const safeCost = Number.isFinite(costNumber) ? costNumber : undefined;

        if (editingId) {
          // Edit existing booking — patch only, preserve trip linkage.
          await updateBooking({
            id: editingId,
            title: data.title,
            startDate: data.startDate,
            endDate: data.endDate || undefined,
            location: data.location || undefined,
            countryCode: data.countryCode || undefined,
            confirmationNumber: data.confirmationNumber || undefined,
            cost: safeCost,
            currency: data.currency || undefined,
            notes: data.notes || undefined,
            [detailsKey]: detailsJson,
          });
          bottomSheetRef.current?.dismiss();
          onBookingCreated?.();
          return;
        }

        // Create flow — preserve existing logic
        const bookingId = await createBooking({
          type: selectedType,
          source: 'manual',
          provider: 'Manual',
          status: 'upcoming',
          title: data.title,
          startDate: data.startDate,
          endDate: data.endDate || undefined,
          location: data.location || undefined,
          countryCode: data.countryCode || undefined,
          confirmationNumber: data.confirmationNumber || undefined,
          cost: safeCost,
          currency: data.currency || undefined,
          notes: data.notes || undefined,
          [detailsKey]: detailsJson,
          tripId: prelinkedTripId,
          autoMatched: prelinkedTripId ? true : undefined,
        });

        // Auto-match to a trip if not pre-linked
        if (!prelinkedTripId && trips && trips.length > 0) {
          const match = findMatchingTrip(
            data.countryCode,
            data.startDate,
            data.endDate,
            trips,
          );
          if (match && match.confidence === 'high') {
            await linkBookingToTrip({
              id: bookingId,
              tripId: match.tripId,
              autoMatched: true,
            });
          }
        }

        // Close and notify parent
        bottomSheetRef.current?.dismiss();
        onBookingCreated?.();
      },
      [
        selectedType,
        editingId,
        prelinkedTripId,
        trips,
        createBooking,
        updateBooking,
        linkBookingToTrip,
        onBookingCreated,
      ],
    );

    // ── Derive default form values from prelinked trip ────────────────
    const prelinkedTrip = useMemo(() => {
      if (!prelinkedTripId || !trips) return null;
      return trips.find((t) => t._id === prelinkedTripId) ?? null;
    }, [prelinkedTripId, trips]);

    // Dimmed backdrop — matches AppBottomSheet so the trip planner and the
    // booking sheets feel like the same family of surfaces.
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

    // ── Pinned footer — the primary CTA. gorhom drives it up to sit flush on
    // the keyboard (animatedFooterPosition), so on focus it hugs the keys with
    // ZERO dead band while keyboardBehavior="extend" raises the sheet to
    // the Dynamic Island. Only shown on the form step; the type picker has no
    // CTA. Fires the form's submit via the imperative handle. ───────────────
    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => {
        if (step !== 'form' || !selectedType) return null;
        return (
          <BottomSheetFooter {...props} bottomInset={0}>
            <View
              onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
              style={{
                paddingHorizontal: Spacing.lg,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 14),
                // Opaque so the scroll body slides cleanly underneath it.
                backgroundColor: colors.surface,
              }}
            >
              <TouchableOpacity
                onPress={() => formRef.current?.submit()}
                disabled={!canSubmit}
                activeOpacity={0.85}
                style={[
                  ftStyles.submitButton,
                  {
                    backgroundColor: canSubmit ? colors.coral : colors.surfaceMuted,
                    borderColor: canSubmit ? colors.coral : colors.line,
                    borderWidth: 1,
                    shadowColor: canSubmit ? colors.coral : 'transparent',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: canSubmit ? 0.35 : 0,
                    shadowRadius: 16,
                    elevation: canSubmit ? 6 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    ftStyles.submitButtonText,
                    { color: canSubmit ? '#FFFFFF' : colors.inkMute },
                  ]}
                >
                  {canSubmit ? 'Save booking' : 'Fill in the essentials'}
                  {canSubmit ? (
                    <Text style={{ color: colors.solidTextSub }}>{'  →'}</Text>
                  ) : null}
                </Text>
              </TouchableOpacity>
            </View>
          </BottomSheetFooter>
        );
      },
      [step, selectedType, canSubmit, colors, insets.bottom],
    );

    // ── Render ───────────────────────────────────────────────────────
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        maxDynamicContentSize={maxSheetHeight}
        // topInset is what actually CLAMPS the sheet's top position below the
        // Dynamic Island — maxDynamicContentSize only caps height, and
        // gorhom's interactive keyboard shift can otherwise push the sheet
        // over the island. Same shape as EditDaySheet (the reference impl).
        topInset={insets.top + 10}
        stackBehavior="push"
        backdropComponent={renderBackdrop}
        // KEYBOARD: "extend" — the only behavior that never moves the sheet into
        // a temporary position (gorhom BottomSheet.tsx:640,815-846), so the
        // float-on-blur is impossible at the source (no snapToIndex hack). The
        // primary CTA rides a BottomSheetFooter that gorhom pins flush on the
        // keyboard via animatedFooterPosition — no dead band. (NOTE: this is a
        // multi-input body; the focused field's visibility under the keyboard
        // is bounded by the content detent — see TripPlannerSheet's top-of-file
        // note for the full rationale.) "restore" returns to the detent on
        // dismiss; adjustResize is gorhom's documented Android requirement.
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        // Kill the ~80pt over-drag band below the content at rest.
        overDragResistanceFactor={0}
        footerComponent={renderFooter}
        // Paper-bg sheet matching the rest of the Signature v2 surfaces;
        // booking-type color is moved into accents inside the form, not the
        // entire sheet background.
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        onDismiss={resetState}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingTop: Spacing.sm,
            // Reserve room for the pinned footer (form step only) so the last
            // field isn't hidden behind it at rest.
            paddingBottom: step === 'form' ? footerHeight : 12,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'type' && (
            <BookingTypePicker onSelect={handleTypeSelect} onScanComplete={handleScanComplete} />
          )}

          {step === 'form' && selectedType && (
            <BookingForm
              ref={formRef}
              onValidityChange={setCanSubmit}
              type={selectedType}
              isEditing={editingId != null}
              // Dismiss the keyboard BEFORE unmounting the form: gorhom's
              // keyboardBlurBehavior="restore" only fires off a blur from a
              // still-mounted BottomSheetTextInput. Unmounting a focused
              // input mid-keyboard strands the sheet at its lifted position
              // — it sat visibly detached above the screen bottom
              // (QA-reproduced: form → focus field → back arrow).
              onBack={() => {
                Keyboard.dismiss();
                setStep('type');
              }}
              onSubmit={handleSubmit}
              defaultCountryCode={prelinkedTrip?.countryCode}
              defaultStartDate={prelinkedTrip?.startDate}
              // Deliberately NOT seeding the end date from the trip window.
              // A booking should only get an end date the user actually picked
              // (a hotel check-out, a car drop-off) — inheriting trip.endDate
              // made every booking a whole-trip range that rendered on EVERY
              // day of the trip (esp. flights, which have no end-date field to
              // correct). Start date stays as a convenience anchor.
              prefillData={prefillData}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

AddBookingSheet.displayName = 'AddBookingSheet';
export default AddBookingSheet;

// Footer CTA styling — mirrors BookingForm's former inline submit button.
const ftStyles = StyleSheet.create({
  submitButton: {
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -17 * 0.014,
    lineHeight: 24,
  },
});

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
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import BottomSheetKeyboardAwareScrollView from '@/components/ui/BottomSheetKeyboardAwareScrollView';
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { type Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { type BookingType } from '@/constants/bookings';
import { findMatchingTrip } from '@/utils/tripMatcher';
import BookingTypePicker from './BookingTypePicker';
import BookingForm, { type BookingFormData } from './BookingForm';

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
            cost: data.cost ? parseFloat(data.cost) : undefined,
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
          cost: data.cost ? parseFloat(data.cost) : undefined,
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
        // Keyboard handling lives in BottomSheetKeyboardAwareScrollView
        // (RNKC) below — same shape as EditDaySheet. "interactive" is
        // gorhom's default (there is no "none") — set explicitly because
        // keyboard avoidance is shared with RNKC's KAW. "restore" returns the
        // sheet to its detent when the keyboard dismisses; adjustResize is
        // gorhom's documented Android requirement (the inherited adjustPan
        // default pans the whole window and fights edge-to-edge).
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        // Paper-bg sheet matching the rest of the Signature v2 surfaces;
        // booking-type color is moved into accents inside the form, not the
        // entire sheet background.
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        onDismiss={resetState}
      >
        <BottomSheetKeyboardAwareScrollView
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Breathing room between the focused input and the keyboard top —
          // matches Apple Mail / Notes (and EditDaySheet).
          bottomOffset={24}
        >
          {step === 'type' && (
            <BookingTypePicker onSelect={handleTypeSelect} onScanComplete={handleScanComplete} />
          )}

          {step === 'form' && selectedType && (
            <BookingForm
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
              defaultEndDate={prelinkedTrip?.endDate}
              prefillData={prefillData}
            />
          )}
        </BottomSheetKeyboardAwareScrollView>
      </BottomSheetModal>
    );
  },
);

AddBookingSheet.displayName = 'AddBookingSheet';
export default AddBookingSheet;

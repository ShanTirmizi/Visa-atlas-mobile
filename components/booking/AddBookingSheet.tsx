import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { type BookingType } from '@/constants/bookings';
import { findMatchingTrip } from '@/utils/tripMatcher';
import BookingTypePicker from './BookingTypePicker';
import BookingForm, { type BookingFormData } from './BookingForm';

// ── Public API ─────────────────────────────────────────────────────────
export interface AddBookingSheetRef {
  open: (prelinkedTripId?: string) => void;
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
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // ── State ────────────────────────────────────────────────────────
    const [step, setStep] = useState<'type' | 'form'>('type');
    const [selectedType, setSelectedType] = useState<BookingType | null>(null);
    const [prelinkedTripId, setPrelinkedTripId] = useState<string | undefined>();
    const [prefillData, setPrefillData] = useState<Partial<BookingFormData> | undefined>();

    // ── Convex hooks ─────────────────────────────────────────────────
    const createBooking = useMutation(api.bookings.createBooking);
    const linkBookingToTrip = useMutation(api.bookings.linkBookingToTrip);
    const trips = useQuery(api.trips.listTrips);

    // ── Snap points change with step ─────────────────────────────────
    const snapPoints = useMemo(
      () => (step === 'type' ? ['55%'] : ['92%']),
      [step],
    );

    // ── Reset helper ─────────────────────────────────────────────────
    const resetState = useCallback(() => {
      setStep('type');
      setSelectedType(null);
      setPrefillData(undefined);
    }, []);

    // ── Imperative handle for parent ─────────────────────────────────
    useImperativeHandle(ref, () => ({
      open: (tripId?: string) => {
        resetState();
        setPrelinkedTripId(tripId);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Scan complete handler ────────────────────────────────────────
    const handleScanComplete = useCallback((type: BookingType, data: Partial<BookingFormData>) => {
      setSelectedType(type);
      setPrefillData(data);
      setStep('form');
    }, []);

    // ── Step 1 handler: type selected ────────────────────────────────
    const handleTypeSelect = useCallback((type: BookingType) => {
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

        // Build mutation args
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
          tripId: prelinkedTripId
            ? (prelinkedTripId as any)
            : undefined,
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
              id: bookingId as any,
              tripId: match.tripId as any,
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
        prelinkedTripId,
        trips,
        createBooking,
        linkBookingToTrip,
        onBookingCreated,
      ],
    );

    // ── Derive default form values from prelinked trip ────────────────
    const prelinkedTrip = useMemo(() => {
      if (!prelinkedTripId || !trips) return null;
      return trips.find((t) => t._id === prelinkedTripId) ?? null;
    }, [prelinkedTripId, trips]);

    // ── Render ───────────────────────────────────────────────────────
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onDismiss={resetState}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: Spacing['3xl'] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'type' && (
            <BookingTypePicker onSelect={handleTypeSelect} onScanComplete={handleScanComplete} />
          )}

          {step === 'form' && selectedType && (
            <BookingForm
              type={selectedType}
              onBack={() => setStep('type')}
              onSubmit={handleSubmit}
              defaultCountryCode={prelinkedTrip?.countryCode}
              defaultStartDate={prelinkedTrip?.startDate}
              defaultEndDate={prelinkedTrip?.endDate}
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

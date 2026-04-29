import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { type BookingType } from '@/constants/bookings';
import { findMatchingTrip } from '@/utils/tripMatcher';
import BookingTypePicker from './BookingTypePicker';
import BookingForm, { type BookingFormData } from './BookingForm';

// ── Public API ─────────────────────────────────────────────────────────
export interface BookingForEdit {
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
  open: (prelinkedTripId?: string) => void;
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
    const [prelinkedTripId, setPrelinkedTripId] = useState<string | undefined>();
    const [prefillData, setPrefillData] = useState<Partial<BookingFormData> | undefined>();
    const [editingId, setEditingId] = useState<string | null>(null);

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
      open: (tripId?: string) => {
        resetState();
        setPrelinkedTripId(tripId);
        bottomSheetRef.current?.present();
      },
      openForEdit: (booking) => {
        resetState();
        setEditingId(booking.id);
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

        if (editingId) {
          // Edit existing booking — patch only, preserve trip linkage.
          await updateBooking({
            id: editingId as any,
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

    // ── Render ───────────────────────────────────────────────────────
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        maxDynamicContentSize={maxSheetHeight}
        // Paper-bg sheet matching the rest of the Signature v2 surfaces;
        // booking-type color is moved into accents inside the form, not the
        // entire sheet background.
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        onDismiss={resetState}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 12 }}
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

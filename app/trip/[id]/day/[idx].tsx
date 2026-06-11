import React, { useCallback, useMemo, useRef } from 'react';
import { View, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import DayDetailScreen from '@/components/trip/DayDetailScreen';
import EditDaySheet, { type EditDaySheetRef } from '@/components/trip/EditDaySheet';
import { parseDiningGuide, parseItineraryDays } from '@/types/itinerary';
import { useTheme } from '@/contexts/theme-context';

type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = { url: string; thumb: string; credit: string; source: string } | null;

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export default function DayDetailRoute() {
  const { id, idx } = useLocalSearchParams<{ id: string; idx: string }>();
  const { colors } = useTheme();

  const tripId = id as Id<'trips'>;
  const dayIndex = Number(idx ?? '0');

  const { isAuthenticated } = useConvexAuth();
  const trip = useQuery(
    api.trips.getTrip,
    isAuthenticated && tripId ? { id: tripId } : 'skip',
  );
  // Same live query the Bookings tab uses (BookingTimeline) — threaded down
  // so booked flights/stays render inside the day they cover.
  const bookings = useQuery(
    api.bookings.listBookingsByTrip,
    isAuthenticated && tripId ? { tripId } : 'skip',
  );

  // parseItineraryDays drops the transient null holes out-of-order per-day
  // stream patches can leave in the stored array — same guard DayDeck
  // applies, which also routes here by filtered-array position.
  const itinerary = useMemo(
    () => parseItineraryDays(trip?.itinerary),
    [trip?.itinerary],
  );
  // Per-trip dining guide — lunch/dinner suggestions woven into the day
  // timeline. Older trips have no guide; the screen hides the inserts.
  const diningGuide = useMemo(
    () => parseDiningGuide(trip?.diningGuide),
    [trip?.diningGuide],
  );
  const dayImages = useMemo<DayImage[]>(
    () => safeParse<DayImage[]>(trip?.dayImages, []),
    [trip?.dayImages],
  );
  const activityImages = useMemo<ActivityImage[]>(
    () => safeParse<ActivityImage[]>(trip?.activityImages, []),
    [trip?.activityImages],
  );

  // ── Two index domains live on this screen — never mix them. ──
  //
  // clampedIndex — position in the FILTERED parseItineraryDays array.
  //   Used ONLY for prev/next paging and the EditDaySheet (which edits the
  //   filtered array and writes it back whole).
  //
  // storedIndex — position in the STORED trips.itinerary array, derived
  //   from the authoritative 1-based `day.day`. Used for everything
  //   server-addressed or per-stored-day: tweakDay, the
  //   `itinerary-day:` retrying key, dayImages/activityImages lookups
  //   (base = storedIndex * 3 + slot) and the trip-start-date offset.
  //   Identical to clampedIndex until a null hole is filtered out.
  const clampedIndex = Math.max(
    0,
    Math.min(dayIndex, Math.max(0, itinerary.length - 1)),
  );
  const day = itinerary[clampedIndex];
  const storedIndex = (day?.day ?? clampedIndex + 1) - 1;

  const onBack = useCallback(() => {
    router.back();
  }, []);

  const onNavigateDay = useCallback((newIndex: number) => {
    router.setParams({ idx: String(newIndex) });
  }, []);

  const onShare = useCallback(async () => {
    if (!day) return;
    await Share.share({
      message: `Day ${day.day}: ${day.title}`,
    }).catch(() => {});
  }, [day]);

  const editSheetRef = useRef<EditDaySheetRef>(null);
  const onEdit = useCallback(() => {
    editSheetRef.current?.present();
  }, []);

  const onTweakWithAI = useCallback(() => {
    // Pass the STORED day index — the chat screen scopes the conversation
    // by indexing the raw (unfiltered) trips.itinerary array.
    router.push(`/chat/${tripId}?day=${storedIndex}` as never);
  }, [tripId, storedIndex]);

  if (!trip || itinerary.length === 0 || !day) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return (
    <>
      <DayDetailScreen
        day={day}
        dayIndex={clampedIndex}
        storedDayIndex={storedIndex}
        numDays={itinerary.length}
        heroImage={dayImages[storedIndex] ?? null}
        morningImage={activityImages[storedIndex * 3] ?? null}
        afternoonImage={activityImages[storedIndex * 3 + 1] ?? null}
        eveningImage={activityImages[storedIndex * 3 + 2] ?? null}
        destination={trip.countryName}
        tripStartDate={trip.startDate}
        diningGuide={diningGuide}
        onBack={onBack}
        onShare={onShare}
        onEdit={onEdit}
        onTweakWithAI={onTweakWithAI}
        onNavigateDay={onNavigateDay}
        tripId={tripId}
        isDayRewriting={(trip.retryingSections ?? []).includes(
          `itinerary-day:${storedIndex}`,
        )}
        bookings={bookings}
      />
      <EditDaySheet
        ref={editSheetRef}
        tripId={tripId}
        dayIndex={clampedIndex}
        itinerary={itinerary}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

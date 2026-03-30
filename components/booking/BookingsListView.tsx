import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import BookingCard from './BookingCard';
import AddBookingSheet, { type AddBookingSheetRef } from './AddBookingSheet';
import BookingDetailSheet, { type BookingDetailSheetRef, type BookingDetailData } from './BookingDetailSheet';
import { BOOKING_TYPES } from '@/constants/bookings';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface BookingsListViewProps {
  bottomInset: number;
}

// ──────────────────────────────────────────────
// Detail-key mapping (car_rental -> carDetails, etc.)
// ──────────────────────────────────────────────

function detailsKeyForType(type: string): string {
  if (type === 'car_rental') return 'carDetails';
  return `${type}Details`;
}

// ════════════════════════════════════════════════
// BookingsListView
// ════════════════════════════════════════════════

export default function BookingsListView({ bottomInset }: BookingsListViewProps) {
  const { colors } = useTheme();

  // ── Data ──────────────────────────────────────
  const bookings = useQuery(api.bookings.listBookings);
  const trips = useQuery(api.trips.listTrips);

  // ── Refs ──────────────────────────────────────
  const addSheetRef = useRef<AddBookingSheetRef>(null);
  const detailSheetRef = useRef<BookingDetailSheetRef>(null);

  // ── Split bookings into unassigned & upcoming ─
  const { unassigned, upcoming } = useMemo(() => {
    if (!bookings) return { unassigned: [], upcoming: [] };

    const unassignedList = bookings.filter((b) => !b.tripId);
    const upcomingList = bookings
      .filter((b) => !!b.tripId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    return { unassigned: unassignedList, upcoming: upcomingList };
  }, [bookings]);

  // Merged list: unassigned first, then upcoming
  const allBookings = useMemo(
    () => [...unassigned, ...upcoming],
    [unassigned, upcoming],
  );

  // ── Trip name lookup ──────────────────────────
  const getTripName = useCallback(
    (tripId: string | undefined): string | undefined => {
      if (!tripId || !trips) return undefined;
      const trip = trips.find((t) => t._id === tripId);
      if (!trip) return undefined;
      return trip.isMultiCountry && trip.routeTitle
        ? trip.routeTitle
        : trip.countryName;
    },
    [trips],
  );

  // ── Open detail sheet ─────────────────────────
  const handleOpenDetail = useCallback(
    (booking: (typeof allBookings)[number]) => {
      const detailsKey = detailsKeyForType(booking.type);
      const rawDetails = (booking as any)[detailsKey] as string | undefined;

      let typeDetails: Record<string, string> | undefined;
      if (rawDetails) {
        try {
          typeDetails = JSON.parse(rawDetails);
        } catch {
          // ignore parse errors
        }
      }

      const data: BookingDetailData = {
        id: booking._id,
        type: booking.type as BookingDetailData['type'],
        title: booking.title,
        startDate: booking.startDate,
        endDate: booking.endDate,
        location: booking.location,
        provider: booking.provider,
        status: booking.status as BookingDetailData['status'],
        confirmationNumber: booking.confirmationNumber,
        cost: booking.cost,
        currency: booking.currency,
        notes: booking.notes,
        tripId: booking.tripId,
        tripName: getTripName(booking.tripId),
        typeDetails,
      };

      detailSheetRef.current?.open(data);
    },
    [getTripName],
  );

  // ── Loading state ─────────────────────────────
  if (bookings === undefined) {
    return (
      <View style={styles.container}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.skeleton,
              { backgroundColor: colors.shimmer },
            ]}
          />
        ))}
      </View>
    );
  }

  // ── Empty state ───────────────────────────────
  if (bookings.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.emptyCard,
            Shadows.card,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyBody}>
            Add your flights, hotels, and experiences to keep everything in one place.
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => addSheetRef.current?.open()}
            style={styles.emptyButton}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Add Booking</Text>
          </TouchableOpacity>
        </View>

        <AddBookingSheet ref={addSheetRef} />
        <BookingDetailSheet ref={detailSheetRef} />
      </View>
    );
  }

  // ── Main list ─────────────────────────────────
  return (
    <View style={styles.container}>
      <FlatList
        data={allBookings}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingBottom: bottomInset + 100,
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          unassigned.length > 0 ? (
            <View
              style={[
                styles.unassignedBanner,
                { backgroundColor: colors.warningBg },
              ]}
            >
              <Text style={[styles.unassignedText, { color: colors.warning }]}>
                {unassigned.length} unassigned booking
                {unassigned.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <BookingCard
            id={item._id}
            type={item.type as any}
            title={item.title}
            startDate={item.startDate}
            endDate={item.endDate}
            location={item.location}
            provider={item.provider}
            status={item.status as any}
            tripName={getTripName(item.tripId)}
            autoMatched={item.autoMatched}
            onPress={() => handleOpenDetail(item)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => addSheetRef.current?.open()}
        style={[
          styles.fab,
          { bottom: bottomInset + 80, backgroundColor: colors.accent },
          Shadows.glow(colors.accent),
        ]}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <AddBookingSheet ref={addSheetRef} />
      <BookingDetailSheet ref={detailSheetRef} />
    </View>
  );
}

// ──────────────────────────────────────────────
// Static styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Loading skeleton ──────────────────────────
  skeleton: {
    height: 72,
    borderRadius: Radius.md,
    marginBottom: 10,
  },

  // ── Empty state ───────────────────────────────
  emptyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  emptyButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },

  // ── Unassigned banner ─────────────────────────
  unassignedBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  unassignedText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── FAB ───────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

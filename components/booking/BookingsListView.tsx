import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { useCalendar } from '@/contexts/calendar-context';
import { useEmail } from '@/contexts/email-context';
import CalendarReviewSheet, { type CalendarReviewSheetRef } from './CalendarReviewSheet';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import BookingCard from './BookingCard';
import NextUpHeroCard from './NextUpHeroCard';
import BookingFilterChips from './BookingFilterChips';
import AddBookingSheet, { type AddBookingSheetRef } from './AddBookingSheet';
import BookingDetailSheet, {
  type BookingDetailSheetRef,
  type BookingDetailData,
} from './BookingDetailSheet';
import { type BookingType, BOOKING_TYPES } from '@/constants/bookings';

interface BookingsListViewProps {
  bottomInset: number;
}

function detailsKeyForType(type: string): string {
  if (type === 'car_rental') return 'carDetails';
  return `${type}Details`;
}

export default function BookingsListView({ bottomInset }: BookingsListViewProps) {
  const { colors, isDark } = useTheme();
  const { isConnected, isSyncing, sync, reviewItems, clearReviewItems } = useCalendar();
  const { gmailAccount, isSyncing: isEmailSyncing, syncGmail } = useEmail();

  const [activeFilter, setActiveFilter] = useState<BookingType | 'all'>('all');

  const { isAuthenticated } = useConvexAuth();
  const bookings = useQuery(api.bookings.listBookings, isAuthenticated ? {} : 'skip');
  const trips = useQuery(api.trips.listTrips, isAuthenticated ? {} : 'skip');

  const addSheetRef = useRef<AddBookingSheetRef>(null);
  const detailSheetRef = useRef<BookingDetailSheetRef>(null);
  const reviewSheetRef = useRef<CalendarReviewSheetRef>(null);

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

  const parseTypeDetails = useCallback(
    (booking: NonNullable<typeof bookings>[number]): Record<string, string> | undefined => {
      const key = detailsKeyForType(booking.type);
      const raw = (booking as Record<string, unknown>)[key] as string | undefined;
      if (!raw) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    [],
  );

  const nextUpBooking = useMemo(() => {
    if (!bookings) return null;
    const now = new Date();
    return (
      bookings
        .filter(
          (b) =>
            (b.status === 'upcoming' || b.status === 'active') &&
            new Date(b.startDate) >= now,
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    let list = bookings;
    if (activeFilter !== 'all') {
      list = list.filter((b) => b.type === activeFilter);
    }
    return list;
  }, [bookings, activeFilter]);

  const sections = useMemo(() => {
    const unlinked = filteredBookings.filter((b) => !b.tripId);
    const linked = filteredBookings.filter((b) => !!b.tripId);

    const tripGroups = new Map<string, typeof linked>();
    for (const b of linked) {
      const id = b.tripId!;
      if (!tripGroups.has(id)) tripGroups.set(id, []);
      tripGroups.get(id)!.push(b);
    }

    for (const group of tripGroups.values()) {
      group.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }

    const tripSections = Array.from(tripGroups.entries())
      .sort(([, a], [, b]) => a[0].startDate.localeCompare(b[0].startDate))
      .map(([tripId, data]) => ({
        key: tripId,
        title: getTripName(tripId) || 'Unknown Trip',
        count: data.length,
        isUnlinked: false,
        data,
      }));

    const result = [];

    if (unlinked.length > 0) {
      result.push({
        key: '__unlinked__',
        title: 'Unlinked',
        count: unlinked.length,
        isUnlinked: true,
        data: unlinked,
      });
    }

    result.push(...tripSections);
    return result;
  }, [filteredBookings, getTripName]);

  const FilterIcon = activeFilter !== 'all' ? BOOKING_TYPES[activeFilter].icon : null;
  const activeFilterLabel =
    activeFilter === 'all' ? '' : BOOKING_TYPES[activeFilter].label.toLowerCase() + 's';

  const handleOpenDetail = useCallback(
    (booking: NonNullable<typeof bookings>[number]) => {
      const typeDetails = parseTypeDetails(booking);
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
    [getTripName, parseTypeDetails],
  );

  // Loading state
  if (bookings === undefined) {
    return (
      <View style={styles.container}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.skeleton, { backgroundColor: colors.shimmer }]}
          />
        ))}
      </View>
    );
  }

  // Empty state
  if (bookings.length === 0) {
    return (
      <View style={styles.container}>
        <View
          style={[styles.emptyCard, Shadows.card, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyBody}>
            Add your flights, hotels, and experiences to keep everything in one
            place.
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

  // Main list
  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isConnected || gmailAccount?.isConnected ? (
            <RefreshControl
              refreshing={isSyncing || isEmailSyncing}
              onRefresh={() => {
                if (isConnected) sync();
                if (gmailAccount?.isConnected) syncGmail();
              }}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {nextUpBooking && (
              <NextUpHeroCard
                type={nextUpBooking.type as BookingType}
                title={nextUpBooking.title}
                startDate={nextUpBooking.startDate}
                endDate={nextUpBooking.endDate}
                provider={nextUpBooking.provider}
                location={nextUpBooking.location}
                tripName={getTripName(nextUpBooking.tripId)}
                cost={nextUpBooking.cost}
                currency={nextUpBooking.currency}
                typeDetails={parseTypeDetails(nextUpBooking)}
                onPress={() => handleOpenDetail(nextUpBooking)}
              />
            )}

            <BookingFilterChips
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {reviewItems.length > 0 && (
              <TouchableOpacity
                onPress={() => reviewSheetRef.current?.open(reviewItems)}
                style={[styles.reviewBanner, { backgroundColor: colors.info + '15' }]}
              >
                <Text style={[styles.reviewBannerText, { color: colors.info }]}>
                  {reviewItems.length} calendar event
                  {reviewItems.length !== 1 ? 's' : ''} to review
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          activeFilter !== 'all' && FilterIcon ? (
            <View style={styles.filterEmpty}>
              <View style={[styles.filterEmptyIcon, { backgroundColor: colors.surfaceLight }]}>
                <FilterIcon size={28} color={colors.textMuted} />
              </View>
              <Text style={[styles.filterEmptyTitle, { color: colors.foreground }]}>
                No {activeFilterLabel}
              </Text>
              <Text style={[styles.filterEmptyBody, { color: colors.textSecondary }]}>
                You don't have any {activeFilterLabel} booked yet.{'\n'}Tap + to add one.
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            {section.isUnlinked ? (
              <View
                style={[
                  styles.unlinkedBanner,
                  {
                    backgroundColor: colors.warningBg,
                    borderLeftColor: colors.warning,
                  },
                ]}
              >
                <Text style={[styles.unlinkedText, { color: isDark ? colors.warning : '#92400E' }]}>
                  {section.count} booking{section.count !== 1 ? 's' : ''} need
                  linking
                </Text>
              </View>
            ) : (
              <View style={styles.tripHeader}>
                <Text
                  style={[styles.tripHeaderText, { color: isDark ? '#8B949E' : '#8B7355' }]}
                >
                  {section.title.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: isDark ? '#1C2333' : '#e8ddd0' },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      { color: isDark ? '#8B949E' : '#8B7355' },
                    ]}
                  >
                    {section.count} booking{section.count !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
        renderItem={({ item, section }) => (
          <View style={styles.cardWrapper}>
            <BookingCard
              type={item.type as BookingType}
              title={item.title}
              startDate={item.startDate}
              endDate={item.endDate}
              location={item.location}
              provider={item.provider}
              status={item.status as 'upcoming' | 'active' | 'completed' | 'cancelled'}
              cost={item.cost}
              currency={item.currency}
              typeDetails={parseTypeDetails(item)}
              isUnlinked={section.isUnlinked}
              onPress={() => handleOpenDetail(item)}
            />
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => addSheetRef.current?.open()}
        style={[
          styles.fab,
          { bottom: bottomInset + 100, backgroundColor: colors.accent },
          Shadows.glow(colors.accent),
        ]}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <AddBookingSheet ref={addSheetRef} />
      <BookingDetailSheet ref={detailSheetRef} />
      <CalendarReviewSheet ref={reviewSheetRef} onComplete={clearReviewItems} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listHeader: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  skeleton: {
    height: 72,
    borderRadius: Radius.md,
    marginBottom: 10,
  },
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
  sectionHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripHeaderText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    letterSpacing: 0.8,
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
  },
  unlinkedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
  },
  unlinkedText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
  },
  cardWrapper: {
    marginBottom: Spacing.sm,
  },
  reviewBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  reviewBannerText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  filterEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  filterEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  filterEmptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
    marginBottom: 8,
  },
  filterEmptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
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

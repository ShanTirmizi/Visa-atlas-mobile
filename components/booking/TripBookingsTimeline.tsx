import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Plus, ChevronDown } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor, formatBookingDates } from '@/constants/bookings';

const MAX_VISIBLE = 4;

interface TripBookingsTimelineProps {
  tripId: string;
  onBookingPress: (booking: unknown) => void;
  onAddBooking: () => void;
}

export default function TripBookingsTimeline({ tripId, onBookingPress, onAddBooking }: TripBookingsTimelineProps) {
  const { colors, isDark } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const bookings = useQuery(api.bookings.listBookingsByTrip, { tripId: tripId as Id<'trips'> });

  if (bookings === undefined) return null;

  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const overflow = showAll ? 0 : sorted.length - MAX_VISIBLE;

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.primary }, Shadows.card]}>
      {/* Section header */}
      <View style={styles.headerRow}>
        <Calendar color="#FFF" size={15} />
        <Text style={styles.headerTitle}>BOOKINGS</Text>
        {sorted.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{sorted.length}</Text>
          </View>
        )}
      </View>

      {/* Empty state */}
      {sorted.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Add flights, hotels, and more</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddBooking}
            style={styles.addButtonPill}
          >
            <Plus color={colors.primary} size={14} />
            <Text style={[styles.addButtonPillText, { color: colors.primary }]}>Add Booking</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Booking cards */}
      {sorted.length > 0 && (
        <View style={styles.cardList}>
          {visible.map((booking) => {
            const type = booking.type as BookingType;
            const config = BOOKING_TYPES[type];
            const cardColor = getBookingColor(type, isDark);
            const Icon = config.icon;

            return (
              <TouchableOpacity
                key={booking._id}
                activeOpacity={0.75}
                onPress={() => onBookingPress(booking)}
                style={[styles.bookingCard, { backgroundColor: cardColor }]}
              >
                <View style={styles.bookingCardInner}>
                  <View style={styles.bookingTopRow}>
                    <View style={styles.bookingIconWrap}>
                      <Icon color="#FFF" size={14} />
                    </View>
                    <View style={styles.bookingTextCol}>
                      <Text style={styles.bookingTitle} numberOfLines={1}>
                        {booking.title}
                      </Text>
                      <Text style={styles.bookingDate}>
                        {formatBookingDates(
                          new Date(booking.startDate),
                          booking.endDate ? new Date(booking.endDate) : undefined,
                        )}
                      </Text>
                    </View>
                  </View>
                  {booking.confirmationNumber && (
                    <Text style={styles.bookingConfirmation} numberOfLines={1}>
                      Ref: {booking.confirmationNumber}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {overflow > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowAll(true)}
              style={styles.showMoreRow}
            >
              <ChevronDown color="rgba(255,255,255,0.7)" size={13} />
              <Text style={styles.showMoreText}>
                Show {overflow} more booking{overflow !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddBooking}
            style={styles.addButtonPill}
          >
            <Plus color={colors.primary} size={13} />
            <Text style={[styles.addButtonPillText, { color: colors.primary }]}>Add Booking</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 20,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.xs,
  },
  cardList: {
    gap: Spacing.sm,
  },
  bookingCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  bookingCardInner: {
    padding: Spacing.md,
    gap: 6,
  },
  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookingIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingTextCol: {
    flex: 1,
    gap: 1,
  },
  bookingTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  bookingDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
  },
  bookingConfirmation: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 40,
  },
  showMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
  },
  showMoreText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  addButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addButtonPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

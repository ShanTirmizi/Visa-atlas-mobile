import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, Plus, ChevronDown } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor, formatBookingDates } from '@/constants/bookings';

// ── Constants ──────────────────────────────────────────────────────────
const MAX_VISIBLE = 4;

// ── Types ──────────────────────────────────────────────────────────────
interface TripBookingsTimelineProps {
  tripId: string;
  onBookingPress: (booking: unknown) => void;
  onAddBooking: () => void;
}

// ════════════════════════════════════════════════════════════════════════
// TripBookingsTimeline
// ════════════════════════════════════════════════════════════════════════
export default function TripBookingsTimeline({ tripId, onBookingPress, onAddBooking }: TripBookingsTimelineProps) {
  const { colors, isDark } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const bookings = useQuery(api.bookings.listBookingsByTrip, { tripId: tripId as Id<'trips'> });

  if (bookings === undefined) return null;

  // Sort by startDate ascending
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const overflow = showAll ? 0 : sorted.length - MAX_VISIBLE;

  return (
    <View>
      {/* ── Section header ─── */}
      <View style={styles.headerRow}>
        <Calendar color={colors.accent} size={15} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>BOOKINGS</Text>
        {sorted.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.accentBg }]}>
            <Text style={[styles.countText, { color: colors.accent }]}>{sorted.length}</Text>
          </View>
        )}
      </View>

      {/* ── Empty state ─── */}
      {sorted.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookings yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Add flights, hotels, and more
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddBooking}
            style={[styles.emptyButton, { backgroundColor: colors.accent }]}
          >
            <Plus color="#FFFFFF" size={14} />
            <Text style={styles.emptyButtonText}>Add Booking</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Booking cards ─── */}
      {sorted.length > 0 && (
        <View style={styles.cardList}>
          {visible.map((booking) => {
            const type = booking.type as BookingType;
            const config = BOOKING_TYPES[type];
            const typeColor = getBookingColor(type, isDark);
            const Icon = config.icon;

            return (
              <TouchableOpacity
                key={booking._id}
                activeOpacity={0.75}
                onPress={() => onBookingPress(booking)}
                style={[
                  styles.bookingCard,
                  Shadows.subtle,
                  {
                    backgroundColor: colors.card,
                    borderLeftColor: typeColor,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.bookingCardInner}>
                  <View style={styles.bookingIconTitle}>
                    <Icon color={typeColor} size={14} />
                    <Text
                      style={[styles.bookingTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {booking.title}
                    </Text>
                  </View>
                  <Text style={[styles.bookingDate, { color: colors.textSecondary }]}>
                    {formatBookingDates(
                      new Date(booking.startDate),
                      booking.endDate ? new Date(booking.endDate) : undefined,
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Show all overflow link */}
          {overflow > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowAll(true)}
              style={styles.showMoreRow}
            >
              <ChevronDown color={colors.textMuted} size={13} />
              <Text style={[styles.showMoreText, { color: colors.textMuted }]}>
                Show {overflow} more booking{overflow !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* Add Booking button when there are existing bookings */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddBooking}
            style={[styles.addButtonRow, { backgroundColor: colors.accentBg }]}
          >
            <Plus color={colors.accent} size={13} />
            <Text style={[styles.addButtonText, { color: colors.accent }]}>Add Booking</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: 0.5,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  emptyButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  // Card list
  cardList: {
    gap: Spacing.xs,
  },
  bookingCard: {
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bookingCardInner: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 9,
    gap: 3,
  },
  bookingIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookingTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    flex: 1,
  },
  bookingDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginLeft: 20,
  },
  // Show more
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
  },
  // Add button (with bookings present)
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

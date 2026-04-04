import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Calendar, Plus, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor, formatBookingDates } from '@/constants/bookings';

// ── Constants ──────────────────────────────────────────────────────────
const SECTION_COLOR = '#2A6B7C';
const MAX_VISIBLE = 4;

// ── Types ──────────────────────────────────────────────────────────────
interface TripBookingsTimelineProps {
  tripId: string;
  onBookingPress: (booking: unknown) => void;
}

// ════════════════════════════════════════════════════════════════════════
// TripBookingsTimeline
// ════════════════════════════════════════════════════════════════════════
export default function TripBookingsTimeline({ tripId, onBookingPress }: TripBookingsTimelineProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const bookings = useQuery(api.bookings.listBookingsByTrip, { tripId: tripId as Id<'trips'> });

  if (bookings === undefined) return null;

  // Sort by startDate ascending
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  function handleAddBooking() {
    Alert.alert(
      'Add Booking',
      'Go to the Trips tab to manage bookings for this trip.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Trips',
          onPress: () => router.push('/(tabs)/trips'),
        },
      ],
    );
  }

  return (
    <View style={[styles.sectionCard, Shadows.card]}>
      {/* ── Section header ─── */}
      <View style={styles.headerRow}>
        <Calendar color="#FFF" size={15} />
        <Text style={styles.headerTitle}>BOOKINGS</Text>
        {sorted.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{sorted.length}</Text>
          </View>
        )}
      </View>

      {/* ── Empty state ─── */}
      {sorted.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Add flights, hotels, and more</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddBooking}
            style={styles.emptyButton}
          >
            <Plus color={SECTION_COLOR} size={14} />
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
                style={[styles.bookingCard, { borderLeftColor: typeColor }]}
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
              onPress={() => router.push('/(tabs)/trips')}
              style={styles.showMoreRow}
            >
              <ChevronDown color="rgba(255,255,255,0.7)" size={13} />
              <Text style={styles.showMoreText}>
                Show {overflow} more booking{overflow !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* Add Booking button when there are existing bookings */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddBooking}
            style={styles.addButtonRow}
          >
            <Plus color={SECTION_COLOR} size={13} />
            <Text style={styles.addButtonText}>Add Booking</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: SECTION_COLOR,
    borderRadius: 20,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 10,
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
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
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
    color: 'rgba(255,255,255,0.70)',
    marginBottom: Spacing.sm,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  emptyButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: SECTION_COLOR,
  },
  // Card list
  cardList: {
    gap: Spacing.xs,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.sm,
    borderLeftWidth: 3,
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
    color: 'rgba(255,255,255,0.75)',
  },
  // Add button (with bookings present)
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: SECTION_COLOR,
  },
});

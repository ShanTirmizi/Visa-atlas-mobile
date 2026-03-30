import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Calendar } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor, formatBookingDates } from '@/constants/bookings';
import AddBookingSheet, { type AddBookingSheetRef } from './AddBookingSheet';

// ── Types ──────────────────────────────────────────────────────────────
interface TripBookingsTimelineProps {
  tripId: string;
  onBookingPress: (booking: any) => void;
}

// ════════════════════════════════════════════════════════════════════════
// TripBookingsTimeline
// ════════════════════════════════════════════════════════════════════════
export default function TripBookingsTimeline({ tripId, onBookingPress }: TripBookingsTimelineProps) {
  const { colors, isDark } = useTheme();
  const addBookingRef = useRef<AddBookingSheetRef>(null);

  const bookings = useQuery(api.bookings.listBookingsByTrip, { tripId: tripId as any });

  if (bookings === undefined) return null;

  // Sort by startDate ascending
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  return (
    <View style={styles.container}>
      {/* ── Section header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Calendar color={colors.textSecondary} size={16} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Bookings</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.countText, { color: colors.textMuted }]}>{sorted.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Empty state ─── */}
      {sorted.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No bookings yet — add your flights, hotels, and more.
          </Text>
        </View>
      )}

      {/* ── Timeline ─── */}
      {sorted.length > 0 && (
        <View style={styles.timeline}>
          {sorted.map((booking, idx) => {
            const type = booking.type as BookingType;
            const config = BOOKING_TYPES[type];
            const typeColor = getBookingColor(type, isDark);
            const Icon = config.icon;
            const isLast = idx === sorted.length - 1;

            return (
              <View key={booking._id} style={styles.timelineRow}>
                {/* Left column — dot + line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, { backgroundColor: typeColor }]} />
                  {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                </View>

                {/* Card */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onBookingPress(booking)}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardRow}>
                    <Icon color={typeColor} size={16} />
                    <Text
                      style={[styles.cardTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {booking.title}
                    </Text>
                  </View>
                  <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                    {formatBookingDates(
                      new Date(booking.startDate),
                      booking.endDate ? new Date(booking.endDate) : undefined,
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Add Booking button ─── */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => addBookingRef.current?.open(tripId)}
        style={[styles.addButton, { borderColor: colors.border }]}
      >
        <Plus color={colors.textMuted} size={14} />
        <Text style={[styles.addButtonText, { color: colors.textMuted }]}>Add Booking</Text>
      </TouchableOpacity>

      {/* ── Bottom sheet ─── */}
      <AddBookingSheet ref={addBookingRef} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
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
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    width: 2,
    flex: 1,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    flex: 1,
  },
  cardDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginLeft: 22,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },
  addButtonText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
  },
});

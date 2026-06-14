import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Plane,
  Hotel,
  Compass,
  Car,
  Shield,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BookingType } from '@/constants/bookings';

// Structural shape — `Doc<'bookings'>` is assignable (extra fields ignored),
// so the trip's live bookings query result threads straight through.
export interface DayStripBooking {
  _id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
}

interface DayBookingsStripProps {
  bookings?: readonly DayStripBooking[] | null;
  /** Trip start date (YYYY-MM-DD). No date → the strip renders nothing. */
  tripStartDate?: string;
  /** 0-based index of the day being shown. */
  dayIndex: number;
}

// Same icon set as BookingRow's TYPE_ICONS — compact variant.
const TYPE_ICONS: Record<
  BookingType,
  React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
> = {
  flight: Plane,
  hotel: Hotel,
  experience: Compass,
  car_rental: Car,
  insurance: Shield,
  restaurant: UtensilsCrossed,
};

// Types that legitimately span a date range (the end date is meaningful).
// Everything else is point-in-time and matches ONLY its start day, even if a
// stale endDate is present on the doc — this defends the day view against
// legacy bookings written by the old whole-trip-range prefill bug.
const RANGED_TYPES: ReadonlySet<BookingType> = new Set([
  'hotel',
  'car_rental',
  'insurance',
]);

// Compact kickers — "FLIGHT" not "BOARDING PASS"; these are at-a-glance
// rows woven into the day, not full booking cards.
const TYPE_KICKER: Record<BookingType, string> = {
  flight: 'FLIGHT',
  hotel: 'STAY',
  experience: 'EXPERIENCE',
  car_rental: 'CAR',
  insurance: 'INSURANCE',
  restaurant: 'DINING',
};

/** YYYY-MM-DD for trip startDate + dayIndex days, or null when unparseable. */
function dayDateKey(tripStartDate: string, dayIndex: number): string | null {
  const d = new Date(`${tripStartDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "9:40" — only meaningful when the source string actually carries a time
 *  (date-only strings would fabricate midnight). Mirrors BookingRow. */
function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/^0/, '');
}

/**
 * Bookings woven into the day — compact, informational rows at the top of
 * the day timeline. Point-in-time bookings (flights, dinners, experiences)
 * show on their start day; ranged bookings (stays, car rentals) show on
 * every day they cover. Rows are intentionally non-pressable in v1 — no
 * dead chevron, no dead tap target.
 */
export function DayBookingsStrip({
  bookings,
  tripStartDate,
  dayIndex,
}: DayBookingsStripProps) {
  const { colors } = useTheme();

  const dayKey = useMemo(
    () => (tripStartDate ? dayDateKey(tripStartDate, dayIndex) : null),
    [tripStartDate, dayIndex],
  );

  const matched = useMemo(() => {
    if (!dayKey || !bookings || bookings.length === 0) return [];
    return bookings
      .filter((b) => {
        const startKey = b.startDate.slice(0, 10);
        const endKey = b.endDate?.slice(0, 10);
        // A booking spans multiple days ONLY when it's a ranged type AND the
        // end date is strictly after the start. A flight/dinner with a bogus
        // endDate (or a degenerate endDate === startDate) collapses to its
        // start day. YYYY-MM-DD compares lexically.
        const hasRealRange =
          RANGED_TYPES.has(b.type) && !!endKey && endKey > startKey;
        return hasRealRange
          ? startKey <= dayKey && dayKey <= (endKey as string)
          : startKey === dayKey;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [bookings, dayKey]);

  if (matched.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {matched.map((b) => {
        const Icon = TYPE_ICONS[b.type] ?? Compass;
        const startKey = b.startDate.slice(0, 10);
        // Time only on the booking's own start day — check-in time on day 3
        // of a stay is noise, not information.
        const time =
          startKey === dayKey && b.startDate.includes('T')
            ? formatTimeLabel(b.startDate)
            : '';
        const kicker = time
          ? `${TYPE_KICKER[b.type] ?? 'BOOKING'} · ${time}`
          : TYPE_KICKER[b.type] ?? 'BOOKING';
        return (
          <View
            key={b._id}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <View
              style={[
                styles.iconSquare,
                { backgroundColor: colors.coralBg, borderColor: colors.line },
              ]}
            >
              <Icon size={16} color={colors.coralDeep} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  Type.kickerSm,
                  { color: colors.inkMute, fontSize: 9, letterSpacing: 9 * 0.18 },
                ]}
              >
                {kicker}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 15,
                  fontWeight: '500',
                  letterSpacing: -15 * 0.012,
                  color: colors.ink,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {b.title}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default DayBookingsStrip;

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

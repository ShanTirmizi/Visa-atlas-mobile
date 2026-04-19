import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { BookingRow } from './BookingRow';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { PillButton } from '@/components/ui/PillButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Type } from '@/constants/typography';
import { BOOKING_TYPES, type BookingType } from '@/constants/bookings';
import type { BookingDetailData } from '@/components/booking/BookingDetailSheet';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const dayName = DAYS[d.getDay()];
  return `${month} ${day} · ${dayName}`;
}

function formatTimeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Filter option types
type FilterOption = 'All' | 'Flights' | 'Stays' | 'Experiences' | 'Other';

const FILTER_MAP: Record<FilterOption, BookingType[]> = {
  All: ['flight', 'hotel', 'experience', 'car_rental', 'insurance', 'restaurant'],
  Flights: ['flight'],
  Stays: ['hotel'],
  Experiences: ['experience', 'restaurant'],
  Other: ['car_rental', 'insurance'],
};

const FILTER_OPTIONS: FilterOption[] = ['All', 'Flights', 'Stays', 'Experiences', 'Other'];

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface RawBooking {
  _id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider?: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  confirmationNumber?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  tripId?: string;
  typeDetails?: Record<string, string>;
}

interface BookingTimelineProps {
  tripId: string;
  onBookingPress: (booking: BookingDetailData) => void;
  onAddBooking: () => void;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function BookingTimeline({
  tripId,
  onBookingPress,
  onAddBooking,
}: BookingTimelineProps) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterOption>('All');

  const { isAuthenticated } = useConvexAuth();
  const bookings = useQuery(
    api.bookings.listBookingsByTrip,
    isAuthenticated ? { tripId: tripId as Id<'trips'> } : 'skip',
  );

  // Filter + sort bookings
  const filtered = useMemo(() => {
    if (!bookings) return [];
    const allowed = FILTER_MAP[filter];
    return [...bookings]
      .filter((b) => allowed.includes(b.type as BookingType))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [bookings, filter]);

  // Group by date (YYYY-MM-DD key)
  const groups = useMemo(() => {
    const map = new Map<string, RawBooking[]>();
    for (const b of filtered) {
      const dateKey = b.startDate.slice(0, 10);
      const existing = map.get(dateKey) ?? [];
      existing.push(b as RawBooking);
      map.set(dateKey, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Build BookingDetailData from raw booking
  function toDetailData(b: RawBooking): BookingDetailData {
    let typeDetails: Record<string, string> | undefined;
    try {
      const raw = (b as unknown as Record<string, unknown>);
      const detailKey = `${b.type}Details` as keyof typeof raw;
      const detailStr = raw[detailKey];
      if (typeof detailStr === 'string') {
        typeDetails = JSON.parse(detailStr) as Record<string, string>;
      }
    } catch {
      // ignore
    }
    return {
      id: b._id,
      type: b.type,
      title: b.title,
      startDate: b.startDate,
      endDate: b.endDate,
      location: b.location,
      provider: b.provider,
      status: b.status,
      confirmationNumber: b.confirmationNumber,
      cost: b.cost,
      currency: b.currency,
      notes: b.notes,
      tripId: b.tripId,
      typeDetails,
    };
  }

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <SegmentedControl
        options={FILTER_OPTIONS}
        value={filter}
        onChange={(v) => setFilter(v as FilterOption)}
        variant="pill"
      />

      {/* Empty state */}
      {bookings !== undefined && filtered.length === 0 && (
        <View style={styles.emptyState}>
          <SectionKicker>NO BOOKINGS YET</SectionKicker>
          <Text style={[Type.body13, { color: colors.inkMute, marginTop: 8, textAlign: 'center' }]}>
            Add flights, hotels, experiences and more to keep everything in one place.
          </Text>
          <PillButton
            label="Add a booking"
            variant="soft"
            onPress={onAddBooking}
            style={{ marginTop: 16 }}
          />
        </View>
      )}

      {/* Timeline groups */}
      {groups.map(([dateKey, items]) => (
        <View key={dateKey} style={styles.group}>
          <SectionKicker style={styles.dateKicker}>
            {formatGroupDate(dateKey)}
          </SectionKicker>
          <View style={styles.rows}>
            {items.map((b) => {
              const timeLabel = formatTimeLabel(b.startDate);
              const venueStr = b.location ?? b.provider ?? undefined;
              return (
                <BookingRow
                  key={b._id}
                  type={b.type}
                  title={b.title}
                  venue={venueStr}
                  timeLabel={timeLabel || undefined}
                  onPress={() => onBookingPress(toDetailData(b))}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 4,
    gap: 20,
  },
  group: {
    gap: 8,
  },
  dateKicker: {
    marginBottom: 2,
  },
  rows: {
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
});

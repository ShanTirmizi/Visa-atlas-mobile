import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Mail, Plus } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { tabSlideIn } from '@/utils/tabAnimation';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { BookingRow } from './BookingRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Squiggle } from '@/components/ui/Squiggle';
import { Type } from '@/constants/typography';
import { FontFamily, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType } from '@/constants/bookings';
import type { BookingDetailData } from '@/components/booking/BookingDetailSheet';
import { Pressable } from 'react-native';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatGroupParts(dateStr: string): { month: string; day: number; dayName: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    month: MONTHS[d.getMonth()],
    day: d.getDate(),
    dayName: DAYS[d.getDay()],
  };
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
  // Track previous filter so the directional fade-slide knows the side.
  const prevFilterRef = useRef<FilterOption>('All');
  const filterDirection =
    FILTER_OPTIONS.indexOf(filter) >= FILTER_OPTIONS.indexOf(prevFilterRef.current)
      ? 1
      : -1;
  useEffect(() => {
    prevFilterRef.current = filter;
  }, [filter]);

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

      {/* Empty state — boarding pass illustration + italic headline + coral CTA */}
      {bookings !== undefined && filtered.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.passStack}>
            <View
              style={[
                styles.passCardBack,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.lineMid,
                },
                Shadows.subtle,
              ]}
            />
            <View
              style={[
                styles.passCardFront,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.lineMid,
                },
                Shadows.subtle,
              ]}
            >
              <Text
                style={[
                  Type.kickerSm,
                  {
                    color: colors.coral,
                    fontSize: 8,
                    letterSpacing: 8 * 0.18,
                  },
                ]}
              >
                BOARDING PASS
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 16,
                  fontWeight: '500',
                  letterSpacing: -16 * 0.012,
                  color: colors.ink,
                  marginTop: 6,
                }}
              >
                YOU → DEST
              </Text>
              <Text
                style={[
                  Type.kickerSm,
                  {
                    color: colors.inkMute,
                    fontSize: 8,
                    letterSpacing: 8 * 0.14,
                    marginTop: 4,
                  },
                ]}
              >
                SEAT 14A · 09:40
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 22,
              fontWeight: '500',
              letterSpacing: -22 * 0.018,
              color: colors.ink,
              marginTop: 28,
            }}
          >
            Nothing here,{' '}
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
              }}
            >
              yet
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>

          <Text
            style={[
              Type.body13,
              {
                color: colors.inkMute,
                textAlign: 'center',
                marginTop: 8,
                lineHeight: 19,
                maxWidth: 260,
              },
            ]}
          >
            Forward your confirmations and we&apos;ll add them automatically — or add one manually.
          </Text>

          <Pressable
            onPress={onAddBooking}
            style={({ pressed }) => ({
              marginTop: 18,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 999,
              backgroundColor: colors.coral,
              shadowColor: colors.coral,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 18,
              elevation: 6,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: FontFamily.bold,
                fontSize: 13,
                fontWeight: '700',
                color: '#FFFFFF',
              }}
            >
              Add booking manually
            </Text>
          </Pressable>
        </View>
      )}

      {/* "Add another booking" CTA — visible whenever there's at least one
          booking so users can keep adding. The empty-state has its own
          button, so we only render this when filtered has items. */}
      {filtered.length > 0 ? (
        <Pressable
          onPress={onAddBooking}
          style={({ pressed }) => [
            styles.addCta,
            {
              backgroundColor: colors.surface,
              borderColor: colors.coral,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.addCtaIcon,
              { backgroundColor: colors.coral },
            ]}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.coralDeep, fontSize: 9, letterSpacing: 9 * 0.18 },
              ]}
            >
              ADD ANOTHER
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 16,
                fontWeight: '500',
                color: colors.ink,
                marginTop: 2,
                letterSpacing: -16 * 0.012,
              }}
            >
              New booking
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* Timeline groups — keyed on filter so the entering animation
          replays whenever the user taps a different chip. */}
      <Animated.View key={filter} entering={tabSlideIn(filterDirection * 18)}>
        {groups.map(([dateKey, items]) => {
          const { month, day, dayName } = formatGroupParts(dateKey);
          return (
            <View key={dateKey} style={styles.group}>
              {/* Editorial date header — italic Fraunces day number with
                  coral period, mono kicker month + weekday, coral squiggle. */}
              <View style={styles.dateHeaderRow}>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 22,
                    lineHeight: 22,
                    letterSpacing: -22 * 0.022,
                    fontWeight: '500',
                    color: colors.ink,
                  }}
                >
                  {day}
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>
                <View style={{ marginLeft: 8 }}>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 9,
                      fontWeight: '700',
                      letterSpacing: 9 * 0.22,
                      textTransform: 'uppercase',
                      color: colors.inkMute,
                    }}
                  >
                    {month}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 9,
                      fontWeight: '700',
                      letterSpacing: 9 * 0.22,
                      textTransform: 'uppercase',
                      color: colors.inkFaint,
                      marginTop: 1,
                    }}
                  >
                    {dayName}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Squiggle width={48} color={colors.coral} />
                </View>
              </View>
              <View style={styles.rows}>
                {items.map((b) => {
                  const detail = toDetailData(b);
                  return (
                    <BookingRow
                      key={b._id}
                      type={b.type}
                      title={b.title}
                      startDate={b.startDate}
                      endDate={b.endDate}
                      typeDetails={detail.typeDetails}
                      cost={b.cost}
                      currency={b.currency}
                      confirmationNumber={b.confirmationNumber}
                      onPress={() => onBookingPress(detail)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </Animated.View>

      {/* Forward-to-email tip strip — paper-bg dashed border, mail icon,
          coral COPY action. Only shown when there's at least one booking. */}
      {filtered.length > 0 ? (
        <View
          style={[
            styles.forwardStrip,
            { borderColor: colors.lineMid, backgroundColor: 'transparent' },
          ]}
        >
          <Mail size={14} color={colors.teal} strokeWidth={1.8} />
          <Text
            style={[
              Type.body12_5,
              { color: colors.inkSoft, fontSize: 12, flex: 1 },
            ]}
            numberOfLines={2}
          >
            Forward to{' '}
            <Text style={{ fontWeight: '700', color: colors.ink }}>
              trips@visa.atlas
            </Text>{' '}
            for auto-import
          </Text>
          <Text
            style={[
              Type.kickerSm,
              {
                color: colors.coralDeep,
                fontSize: 9,
                letterSpacing: 9 * 0.18,
                fontWeight: '700',
              },
            ]}
          >
            COPY
          </Text>
        </View>
      ) : null}
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
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  rows: {
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  forwardStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passStack: {
    width: 160,
    height: 110,
    marginTop: 12,
  },
  passCardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    transform: [{ rotate: '-5deg' }],
  },
  passCardFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    transform: [{ rotate: '2deg' }],
  },
});

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { Globe, Heart, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Spacing, getVisaCategoryColor } from '@/constants/theme';
import { Type } from '@/constants/typography';

// ── UI Primitives ──────────────────────────────────────────
import BackButton from '@/components/ui/BackButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { PillButton } from '@/components/ui/PillButton';

// ── Trip Overview components ───────────────────────────────
import { TripOverviewHero } from '@/components/trip/overview/TripOverviewHero';
import { NextUpCard } from '@/components/trip/overview/NextUpCard';
import { HighlightsStrip, type HighlightItem } from '@/components/trip/overview/HighlightsStrip';

// ── Bookings ───────────────────────────────────────────────
import { BookingTimeline } from '@/components/trip/bookings/BookingTimeline';
import AddBookingSheet, { type AddBookingSheetRef } from '@/components/booking/AddBookingSheet';
import BookingDetailSheet, {
  type BookingDetailSheetRef,
  type BookingDetailData,
} from '@/components/booking/BookingDetailSheet';

// ── DayDeck (for Itinerary tab) ────────────────────────────
import DayDeck from '@/components/trip/DayDeck';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject?: string;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const s = new Date(startDate + 'T00:00:00');
  const startStr = `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  if (!endDate) return startStr;
  const e = new Date(endDate + 'T00:00:00');
  const endStr = `${MONTHS[e.getMonth()]} ${e.getDate()}`;
  return `${startStr} — ${endStr}`;
}

function getVisaLabel(category: string): string {
  const c = category?.toLowerCase() ?? '';
  if (c.includes('free')) return 'Visa Free';
  if (c.includes('arrival')) return 'On Arrival';
  if (c.includes('evisa') || c.includes('e-visa')) return 'e-Visa';
  if (c.includes('required')) return 'Visa Required';
  return category;
}

// ──────────────────────────────────────────────────────────
// Tab options
// ──────────────────────────────────────────────────────────

type TabKey = 'Overview' | 'Itinerary' | 'Bookings' | 'Visa';
const TABS: TabKey[] = ['Overview', 'Itinerary', 'Bookings', 'Visa'];

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addBookingRef = useRef<AddBookingSheetRef>(null);
  const bookingDetailRef = useRef<BookingDetailSheetRef>(null);

  const trip = useOfflineQuery(api.trips.getTrip, { id: id as Id<'trips'> });
  const heartbeatMutation = useMutation(api.tripPresence.heartbeat);
  const leaveMutation = useMutation(api.tripPresence.leave);

  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [saved, setSaved] = useState(false);

  // Presence heartbeat
  useEffect(() => {
    if (!id) return;
    const tripId = id as Id<'trips'>;
    heartbeatMutation({ tripId }).catch(() => {});
    const interval = setInterval(() => {
      heartbeatMutation({ tripId }).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(interval);
      leaveMutation({ tripId }).catch(() => {});
    };
  }, [id]);

  // ── Parsed data ──────────────────────────────────────────
  const itinerary = useMemo(
    () => safeParse<ItineraryDay[]>(trip?.itinerary, []),
    [trip?.itinerary],
  );

  const heroImage = useMemo(
    () =>
      safeParse<{ url: string; credit: string; creditUrl: string } | null>(
        trip?.heroImage,
        null,
      ),
    [trip?.heroImage],
  );

  const dayImages = useMemo(
    () =>
      safeParse<
        Array<{ url: string; thumb: string; credit: string; creditUrl: string } | null>
      >(trip?.dayImages, []),
    [trip?.dayImages],
  );

  const activityImages = useMemo(
    () =>
      safeParse<
        Array<{ url: string; thumb: string; credit: string; source: string } | null>
      >(trip?.activityImages, []),
    [trip?.activityImages],
  );

  // ── Derived: NextUpCard data ─────────────────────────────
  const firstActivity = useMemo(() => {
    if (itinerary.length === 0) return null;
    const day0 = itinerary[0];
    return {
      title: day0.morning,
      place: day0.morningPlace,
      imageUri: activityImages[0]?.thumb ?? activityImages[0]?.url ?? undefined,
    };
  }, [itinerary, activityImages]);

  // ── Derived: HighlightsStrip data ───────────────────────
  const highlights = useMemo<HighlightItem[]>(() => {
    if (itinerary.length === 0) {
      // Stub fallback
      return [
        { label: 'Kyoto temples', dayStamp: 'DAY 2', tone: 'sunset' },
        { label: 'Ramen tour', dayStamp: 'DAY 3', tone: 'forest' },
        { label: 'Mt. Fuji', dayStamp: 'DAY 5', tone: 'mountain' },
      ];
    }
    return itinerary.slice(0, 3).map((day, idx) => ({
      label: day.morning,
      dayStamp: `DAY ${day.day}`,
      imageUri: dayImages[idx]?.thumb ?? dayImages[idx]?.url ?? undefined,
    }));
  }, [itinerary, dayImages]);

  // ── Destination label ────────────────────────────────────
  const destinationLabel = trip
    ? trip.isMultiCountry && trip.routeTitle
      ? trip.routeTitle.split(/\s*→\s*/)[0]
      : trip.countryName ?? 'Destination'
    : 'Destination';

  const cityLabel = trip?.capital ?? destinationLabel;

  // ── Handle booking press ─────────────────────────────────
  function handleBookingPress(data: BookingDetailData) {
    bookingDetailRef.current?.open(data);
  }

  // ── Loading ──────────────────────────────────────────────
  if (trip === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={[Type.body13, { color: colors.inkMute, marginTop: 12 }]}>Loading trip...</Text>
      </View>
    );
  }

  if (trip === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl }]}>
        <Globe color={colors.inkMute} size={40} />
        <Text style={[Type.title15, { color: colors.inkSoft, marginTop: 12 }]}>Trip not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={[Type.body13, { color: colors.ink }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const catColor = getVisaCategoryColor(trip.visaCategory, colors);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);

  // ── Render ───────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* ─── HEADER ─── */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8, paddingHorizontal: 22 },
          ]}
        >
          {/* Left: back */}
          <BackButton />

          {/* Center: destination + date */}
          <View style={styles.headerCenter}>
            <Text style={[Type.title15, { color: colors.ink }]} numberOfLines={1}>
              {destinationLabel}
            </Text>
            {dateRange ? (
              <Text style={[Type.mono10, { color: colors.inkMute, letterSpacing: 10 * 0.1 }]}>
                {dateRange}
              </Text>
            ) : null}
          </View>

          {/* Right: heart save toggle */}
          <CircleBtn
            size={38}
            solid
            onPress={() => setSaved((v) => !v)}
            accessibilityLabel={saved ? 'Unsave trip' : 'Save trip'}
          >
            <Heart
              size={17}
              color={saved ? colors.danger : colors.ink}
              fill={saved ? colors.danger : 'none'}
            />
          </CircleBtn>
        </View>

        {/* ─── SEGMENTED TABS ─── */}
        <View style={{ paddingVertical: 10, paddingHorizontal: 22 }}>
          <SegmentedControl
            options={TABS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabKey)}
            variant="pill"
          />
        </View>

        {/* ─── TAB CONTENT ─── */}

        {/* ── Overview tab ── */}
        {activeTab === 'Overview' && (
          <View>
            {/* Hero card */}
            <TripOverviewHero
              tripName={trip.routeTitle ?? trip.countryName ?? ''}
              cityName={cityLabel}
              heroImageUrl={heroImage?.url}
              duration={typeof trip.duration === 'number' ? trip.duration : undefined}
            />

            {/* Next up card (only if itinerary has data) */}
            {firstActivity && (
              <NextUpCard
                title={firstActivity.title}
                meta={firstActivity.place ?? destinationLabel}
                imageUri={firstActivity.imageUri}
                onPress={() => router.push(`/trip/${id}/day/0` as const)}
              />
            )}

            {/* Highlights strip */}
            <HighlightsStrip
              items={highlights}
              onSeeAll={() => setActiveTab('Itinerary')}
            />
          </View>
        )}

        {/* ── Itinerary tab ── */}
        {activeTab === 'Itinerary' && (
          <View style={{ paddingTop: 8 }}>
            <DayDeck
              tripId={String(trip._id)}
              days={itinerary}
              dayImages={dayImages}
              tripHeroImage={heroImage}
              tripStartDate={trip.startDate}
              destination={trip.countryName}
            />
          </View>
        )}

        {/* ── Bookings tab ── */}
        {activeTab === 'Bookings' && (
          <View style={{ paddingTop: 8, paddingBottom: 20 }}>
            <BookingTimeline
              tripId={String(trip._id)}
              onBookingPress={handleBookingPress}
              onAddBooking={() => addBookingRef.current?.open(String(trip._id))}
            />
          </View>
        )}

        {/* ── Visa tab (stub) ── */}
        {activeTab === 'Visa' && (
          <View style={styles.visaStub}>
            <View style={[styles.visaCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <SectionKicker color={catColor}>VISA STATUS</SectionKicker>
              <Text style={[Type.title18, { color: colors.ink, marginTop: 8 }]}>
                {getVisaLabel(trip.visaCategory)}
              </Text>
              {trip.capital ? (
                <Text style={[Type.body13, { color: colors.inkMute, marginTop: 4 }]}>
                  {trip.countryName} · {trip.capital}
                </Text>
              ) : null}

              <View style={styles.visaIconRow}>
                <Shield size={40} color={catColor} strokeWidth={1.5} />
              </View>

              <PillButton
                label="Start visa application"
                variant="primary"
                fullWidth
                onPress={() => router.push('/more/visas' as const)}
                style={{ marginTop: 20 }}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── Booking sheets ─── */}
      <AddBookingSheet ref={addBookingRef} />
      <BookingDetailSheet ref={bookingDetailRef} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  visaStub: {
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  visaCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
  },
  visaIconRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { tabSlideIn } from '@/utils/tabAnimation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConvexAuth } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionKicker } from '@/components/ui/SectionKicker';

import { TripsGreeting } from '@/components/trips/TripsGreeting';
import { TripsSearch } from '@/components/trips/TripsSearch';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { NextTripHero } from '@/components/trips/NextTripHero';
import { TripRow } from '@/components/trips/TripRow';
import { EmptyAtlasCard } from '@/components/trips/EmptyAtlasCard';
import { HandPickedCard } from '@/components/trips/HandPickedCard';
import type { HandPickedTone } from '@/components/trips/HandPickedCard';

import TripPlannerSheet, {
  type TripPlannerSheetRef,
} from '@/components/trip/TripPlannerSheet';
import type { CountryVisa } from '@/data/visaData';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type FilterTab = 'All' | 'Upcoming' | 'Past' | 'Dreaming';
const FILTER_OPTIONS: FilterTab[] = ['All', 'Upcoming', 'Past', 'Dreaming'];

// Trip shape returned by listTrips (Convex Doc<"trips"> + _role)
interface RawTrip {
  _id: string;
  countryName: string;
  countryCode: string;
  visaCategory: string;
  status: string;
  duration: number;
  startDate?: string;
  endDate?: string;
  heroImage?: string;
  starred?: boolean;
  iataCode?: string;
  flightHours?: number;
  dailyBudget?: string;
  _creationTime: number;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Hand-picked destination tiles
// ──────────────────────────────────────────────
interface HandPickedDest {
  code: string;
  name: string;
  tag: string;
  tone: HandPickedTone;
}

const HAND_PICKED: HandPickedDest[] = [
  { code: 'JPN', name: 'Tokyo',  tag: 'CHERRY · APR', tone: 'plum'  },
  { code: 'IDN', name: 'Bali',   tag: 'BEACH · DRY',  tone: 'amber' },
  { code: 'PRT', name: 'Lisbon', tag: 'COAST · OCT',  tone: 'teal'  },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function isUpcoming(startDate: string | undefined): boolean {
  if (!startDate) return false;
  return new Date(startDate).getTime() > Date.now();
}

function isPast(startDate: string | undefined): boolean {
  if (!startDate) return false;
  return new Date(startDate).getTime() <= Date.now();
}

function applyFilter(trips: RawTrip[], filter: FilterTab): RawTrip[] {
  switch (filter) {
    case 'Upcoming': return trips.filter((t) => isUpcoming(t.startDate));
    case 'Past':     return trips.filter((t) => isPast(t.startDate));
    case 'Dreaming': return trips.filter((t) => !t.startDate);
    default:         return trips;
  }
}

// Stub country for TripPlannerSheet when there's no country context.
const STUB_COUNTRY: CountryVisa = {
  name: '',
  code: '',
  category: 'visa-required',
};

// ──────────────────────────────────────────────
// Empty state — premium version
// ──────────────────────────────────────────────
function EmptyStateContent({
  onPlan,
  onBrowse,
}: {
  onPlan: () => void;
  onBrowse: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <>
      {/* Dashed-border atlas card */}
      <EmptyAtlasCard onPlan={onPlan} onBrowse={onBrowse} />

      {/* "Try one of these" section header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginHorizontal: 22,
          marginTop: 28,
          marginBottom: 14,
        }}
      >
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 20,
            letterSpacing: -20 * 0.018,
            color: colors.ink,
          }}
        >
          Try one of these
        </Text>
        <SectionKicker color={colors.coral}>HAND-PICKED</SectionKicker>
      </View>

      {/* Horizontal scroll of destination tiles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, gap: 10 }}
      >
        {HAND_PICKED.map((dest) => (
          <HandPickedCard
            key={dest.code}
            countryCode={dest.code}
            name={dest.name}
            tag={dest.tag}
            tone={dest.tone}
            onPress={() => router.push(`/country/${dest.code}` as never)}
          />
        ))}
      </ScrollView>
    </>
  );
}

// ──────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────
export default function TripsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Planner sheet ref — used from search AI pill and empty state CTA
  const plannerRef = useRef<TripPlannerSheetRef>(null);

  // Search query — live-filters the rows list by country name.
  const [search, setSearch] = useState('');

  // Filter chip state + previous-filter ref so the rows-list swap knows
  // which side to fade-slide in from when the user taps a different tab.
  const [filter, setFilter] = useState<FilterTab>('All');
  const prevFilterRef = useRef<FilterTab>('All');
  const filterDirection =
    FILTER_OPTIONS.indexOf(filter) >= FILTER_OPTIONS.indexOf(prevFilterRef.current)
      ? 1
      : -1;
  useEffect(() => {
    prevFilterRef.current = filter;
  }, [filter]);

  // Convex query — gated on auth so a sign-out doesn't fire a query
  // against requireAuth() and surface a "Not authenticated" render error
  // before the router has a chance to redirect to /sign-in.
  const { isAuthenticated } = useConvexAuth();
  const trips = useOfflineQuery(
    api.trips.listTrips,
    isAuthenticated ? {} : 'skip',
  );

  // Sort: starred first, then upcoming (nearest startDate), no-date trips
  // last, then by creation desc.
  const sortedTrips = useMemo<RawTrip[]>(() => {
    if (!trips) return [];
    return [...(trips as unknown as RawTrip[])].sort((a, b) => {
      if (Boolean(a.starred) !== Boolean(b.starred)) {
        return a.starred ? -1 : 1;
      }
      const aT = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bT = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      if (aT !== bT) return aT - bT;
      return b._creationTime - a._creationTime;
    });
  }, [trips]);

  // Featured = first upcoming trip; fallback = first trip overall
  const featured = useMemo<RawTrip | null>(() => {
    if (sortedTrips.length === 0) return null;
    const upcoming = sortedTrips.find((t) => isUpcoming(t.startDate));
    return upcoming ?? sortedTrips[0];
  }, [sortedTrips]);

  // Rows = all trips except featured, filtered by tab + search query.
  const rows = useMemo<RawTrip[]>(() => {
    const withoutFeatured = featured
      ? sortedTrips.filter((t) => t._id !== featured._id)
      : sortedTrips;
    const filtered = applyFilter(withoutFeatured, filter);
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((t) =>
      t.countryName.toLowerCase().includes(q),
    );
  }, [sortedTrips, filter, featured, search]);

  // ── Loading ──────────────────────────────────────
  if (trips === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 12,
        }}
      >
        <TripsGreeting />
        <ActivityIndicator color={colors.inkMute} style={{ marginTop: 40 }} />
      </View>
    );
  }

  // ── Empty ────────────────────────────────────────
  if (trips.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting header */}
          <TripsGreeting />

          {/* Search + AI plan pill */}
          <View style={{ marginTop: 16 }}>
            <TripsSearch plannerRef={plannerRef} value={search} onChangeText={setSearch} />
          </View>

          {/* Empty state: dashed card + hand-picked row */}
          <EmptyStateContent
            onPlan={() => plannerRef.current?.present()}
            onBrowse={() => router.push('/(tabs)/explore' as never)}
          />

          <TripPlannerSheet
            ref={plannerRef}
            country={STUB_COUNTRY}
            meta={null}
            travel={null}
            resolved={{ category: 'visa-required' }}
            heldVisas={new Set()}
            onTripCreated={(tripId) => router.push(`/trip/${tripId}` as never)}
          />
        </ScrollView>
        <TopSafeAreaBlur />
      </View>
    );
  }

  // ── Main list ────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 110,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Greeting header */}
      <TripsGreeting />

      {/* 2. Search + AI plan pill */}
      <View style={{ marginTop: 16 }}>
        <TripsSearch plannerRef={plannerRef} value={search} onChangeText={setSearch} />
      </View>

      {/* 3. Filter chips */}
      <View style={{ marginTop: 14, paddingHorizontal: 22 }}>
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(v: string) => setFilter(v as FilterTab)}
          variant="pill"
        />
      </View>

      {/* 4. Featured hero — NextTripHero (4-block composition) */}
      {featured && (
        <View style={{ marginTop: 16 }}>
          <NextTripHero
            id={featured._id}
            name={featured.countryName}
            countryName={featured.countryName}
            countryCode={featured.countryCode}
            visaCategory={featured.visaCategory}
            startDate={featured.startDate}
            endDate={featured.endDate}
            duration={featured.duration}
            heroImage={featured.heroImage}
            status={featured.status}
            iataCode={featured.iataCode}
            flightHours={featured.flightHours}
            dailyBudget={featured.dailyBudget}
            loggedCost={0}
          />
        </View>
      )}

      {/* 5. More trips rows — keyed on filter so the entering animation
            replays whenever the user taps a different chip. */}
      {rows.length > 0 && (
        <Animated.View
          key={filter}
          entering={tabSlideIn(filterDirection * 18)}
          style={{ marginTop: 28, paddingHorizontal: 22, gap: 8 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingHorizontal: 2,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 22,
                fontWeight: '500',
                letterSpacing: -22 * 0.018,
                color: colors.ink,
              }}
            >
              More trips
            </Text>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.teal, fontSize: 10, letterSpacing: 0.6, fontWeight: '700' },
              ]}
            >
              SEE ALL
            </Text>
          </View>
          {rows.map((trip) => (
            <TripRow
              key={trip._id}
              id={trip._id}
              name={trip.countryName}
              countryName={trip.countryName}
              countryCode={trip.countryCode}
              visaCategory={trip.visaCategory}
              startDate={trip.startDate}
              endDate={trip.endDate}
              heroImage={trip.heroImage}
              starred={Boolean(trip.starred)}
            />
          ))}
        </Animated.View>
      )}

      {/* TripPlannerSheet — stub, no country context from this screen */}
      <TripPlannerSheet
        ref={plannerRef}
        country={STUB_COUNTRY}
        meta={null}
        travel={null}
        resolved={{ category: 'visa-required' }}
        heldVisas={new Set()}
        onTripCreated={(tripId) => router.push(`/trip/${tripId}` as never)}
      />
    </ScrollView>
    <TopSafeAreaBlur />
    </View>
  );
}

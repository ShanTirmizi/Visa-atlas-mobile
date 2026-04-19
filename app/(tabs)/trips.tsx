import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { PillButton } from '@/components/ui/PillButton';

import { TripsGreeting } from '@/components/trips/TripsGreeting';
import { TripsSearch } from '@/components/trips/TripsSearch';
import { FeaturedTripCard } from '@/components/trips/FeaturedTripCard';
import { TripRow } from '@/components/trips/TripRow';

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
  _creationTime: number;
  [key: string]: unknown;
}

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
// The sheet guard `if (!country || ...) return` prevents any actual API call.
const STUB_COUNTRY: CountryVisa = {
  name: '',
  code: '',
  category: 'visa-required',
};

// ──────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────
function EmptyState({ onPlan }: { onPlan: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          marginHorizontal: 22,
          marginTop: 24,
          borderRadius: 22,
          backgroundColor: colors.surface,
          paddingHorizontal: 24,
          paddingVertical: 36,
          alignItems: 'center',
          gap: 12,
        },
        Shadows.subtle,
      ]}
    >
      <SectionKicker>No trips yet</SectionKicker>
      <Text style={[Type.body14, { color: colors.inkMute, textAlign: 'center' }]}>
        Plan your first adventure
      </Text>
      <PillButton label="Plan a trip" onPress={onPlan} style={{ marginTop: 4 }} />
    </View>
  );
}

// ──────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────
export default function TripsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Planner sheet ref — used from search AI pill and empty state CTA
  const plannerRef = useRef<TripPlannerSheetRef>(null);

  // Filter chip state
  const [filter, setFilter] = useState<FilterTab>('All');

  // Convex query — same pattern as the original screen
  const trips = useOfflineQuery(api.trips.listTrips, {});

  // Sort: upcoming (nearest startDate) first; no-date trips last; then by creation desc
  const sortedTrips = useMemo<RawTrip[]>(() => {
    if (!trips) return [];
    return [...(trips as unknown as RawTrip[])].sort((a, b) => {
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

  // Rows = all trips except featured, then filtered by tab
  const rows = useMemo<RawTrip[]>(() => {
    const withoutFeatured = featured
      ? sortedTrips.filter((t) => t._id !== featured._id)
      : sortedTrips;
    return applyFilter(withoutFeatured, filter);
  }, [sortedTrips, filter, featured]);

  // ── Loading ──────────────────────────────────────
  if (trips === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top + 54,
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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 54,
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TripsGreeting />
        <View style={{ marginTop: 16 }}>
          <TripsSearch plannerRef={plannerRef} />
        </View>
        <View style={{ marginTop: 14, paddingHorizontal: 22 }}>
          <SegmentedControl
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(v: string) => setFilter(v as FilterTab)}
            variant="pill"
          />
        </View>
        <EmptyState onPlan={() => plannerRef.current?.present()} />

        <TripPlannerSheet
          ref={plannerRef}
          country={STUB_COUNTRY}
          meta={null}
          travel={null}
          resolved={{ category: 'visa-required' }}
          heldVisas={new Set()}
          onTripCreated={() => {}}
        />
      </ScrollView>
    );
  }

  // ── Main list ────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 54,
        paddingBottom: insets.bottom + 110,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Greeting header */}
      <TripsGreeting />

      {/* 2. Search + AI plan pill */}
      <View style={{ marginTop: 16 }}>
        <TripsSearch plannerRef={plannerRef} />
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

      {/* 4. Featured hero card */}
      {featured && (
        <View style={{ marginTop: 16 }}>
          <FeaturedTripCard
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
          />
        </View>
      )}

      {/* 5. More trips rows */}
      {rows.length > 0 && (
        <View style={{ marginTop: 28, paddingHorizontal: 20, gap: 10 }}>
          <SectionKicker style={{ marginBottom: 6, paddingHorizontal: 2 }}>
            More trips
          </SectionKicker>
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
            />
          ))}
        </View>
      )}

      {/* TripPlannerSheet — stub, no country context from this screen */}
      <TripPlannerSheet
        ref={plannerRef}
        country={STUB_COUNTRY}
        meta={null}
        travel={null}
        resolved={{ category: 'visa-required' }}
        heldVisas={new Set()}
        onTripCreated={() => {}}
      />
    </ScrollView>
  );
}

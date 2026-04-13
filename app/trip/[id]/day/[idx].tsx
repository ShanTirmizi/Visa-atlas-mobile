import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Share, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import DayDetailScreen, { type DayDetailDay } from '@/components/trip/DayDetailScreen';
import { useTheme } from '@/contexts/theme-context';

type DayImage = { url: string; thumb?: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = { url: string; thumb: string; credit: string; source: string } | null;

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export default function DayDetailRoute() {
  const { id, idx } = useLocalSearchParams<{ id: string; idx: string }>();
  const { colors } = useTheme();

  const tripId = id as Id<'trips'>;
  const dayIndex = Number(idx ?? '0');

  const trip = useQuery(api.trips.getTrip, tripId ? { id: tripId } : 'skip');

  const itinerary = useMemo<DayDetailDay[]>(
    () => safeParse<DayDetailDay[]>(trip?.itinerary, []),
    [trip?.itinerary],
  );
  const dayImages = useMemo<DayImage[]>(
    () => safeParse<DayImage[]>(trip?.dayImages, []),
    [trip?.dayImages],
  );
  const activityImages = useMemo<ActivityImage[]>(
    () => safeParse<ActivityImage[]>(trip?.activityImages, []),
    [trip?.activityImages],
  );

  const onBack = useCallback(() => {
    router.back();
  }, []);

  const onNavigateDay = useCallback((newIndex: number) => {
    router.setParams({ idx: String(newIndex) });
  }, []);

  const onShare = useCallback(async () => {
    const day = itinerary[dayIndex];
    if (!day) return;
    await Share.share({
      message: `Day ${day.day}: ${day.title}`,
    }).catch(() => {});
  }, [itinerary, dayIndex]);

  if (!trip || itinerary.length === 0) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  const clampedIndex = Math.max(0, Math.min(dayIndex, itinerary.length - 1));
  const day = itinerary[clampedIndex];

  return (
    <DayDetailScreen
      day={day}
      dayIndex={clampedIndex}
      numDays={itinerary.length}
      heroImage={dayImages[clampedIndex] ?? null}
      morningImage={activityImages[clampedIndex * 3] ?? null}
      afternoonImage={activityImages[clampedIndex * 3 + 1] ?? null}
      eveningImage={activityImages[clampedIndex * 3 + 2] ?? null}
      destination={trip.countryName}
      tripStartDate={trip.startDate}
      onBack={onBack}
      onShare={onShare}
      onNavigateDay={onNavigateDay}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

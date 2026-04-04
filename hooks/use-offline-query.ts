// hooks/use-offline-query.ts
// Drop-in replacement for Convex's useQuery that transparently serves cached
// data when the device is offline.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { getFunctionName } from 'convex/server';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { useOffline } from '@/contexts/offline-context';
import {
  cacheTrips,
  cacheTrip,
  getAllCachedTrips,
  getCachedTrip,
  cacheBookings,
  getAllCachedBookings,
  getCachedBookingsByTrip,
  cacheVisaGuide,
  cacheVisaGuides,
  getCachedVisaGuide,
  getCachedVisaGuideByCountry,
  getAllCachedVisaGuides,
  cacheTripMessages,
  getCachedTripMessages,
} from '@/lib/offline/database';

// ---------------------------------------------------------------------------
// Cache config
// ---------------------------------------------------------------------------

interface CacheConfig {
  cacheWrite: (data: unknown, args: Record<string, unknown>) => Promise<void>;
  cacheRead: (args: Record<string, unknown>) => Promise<unknown>;
}

// Keys ordered so more-specific names come before less-specific ones.
// findCacheConfig uses substring matching, so "listBookingsByTrip" must
// precede "listBookings" and "getGuideByCountry" must precede "getGuide".
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  listBookingsByTrip: {
    cacheWrite: async (data) =>
      cacheBookings(
        data as Array<{ _id: string; tripId?: string } & Record<string, unknown>>,
      ),
    cacheRead: async (args) => getCachedBookingsByTrip(args.tripId as string),
  },
  listBookings: {
    cacheWrite: async (data) =>
      cacheBookings(
        data as Array<{ _id: string; tripId?: string } & Record<string, unknown>>,
      ),
    cacheRead: async () => getAllCachedBookings(),
  },
  getGuideByCountry: {
    cacheWrite: async (data) => {
      if (data == null) return;
      const doc = data as { _id: string; countryCode: string };
      await cacheVisaGuide(doc._id, doc.countryCode, doc);
    },
    cacheRead: async (args) =>
      getCachedVisaGuideByCountry(args.countryCode as string),
  },
  getGuide: {
    cacheWrite: async (data) => {
      if (data == null) return;
      const doc = data as { _id: string; countryCode: string };
      await cacheVisaGuide(doc._id, doc.countryCode, doc);
    },
    cacheRead: async (args) => getCachedVisaGuide(args.id as string),
  },
  listTrips: {
    cacheWrite: async (data) =>
      cacheTrips(data as Array<{ _id: string } & Record<string, unknown>>),
    cacheRead: async () => getAllCachedTrips(),
  },
  getTrip: {
    cacheWrite: async (data) => {
      if (data == null) return;
      const doc = data as { _id: string };
      await cacheTrip(doc._id, doc);
    },
    cacheRead: async (args) => getCachedTrip(args.id as string),
  },
  listGuides: {
    cacheWrite: async (data) =>
      cacheVisaGuides(
        data as Array<{ _id: string; countryCode: string } & Record<string, unknown>>,
      ),
    cacheRead: async () => getAllCachedVisaGuides(),
  },
  getMessages: {
    cacheWrite: async (data, args) =>
      cacheTripMessages(
        args.tripId as string,
        data as Array<{ _id: string } & Record<string, unknown>>,
      ),
    cacheRead: async (args) => getCachedTripMessages(args.tripId as string),
  },
};

function findCacheConfig(queryRef: FunctionReference<'query'>): CacheConfig | null {
  const refName = getFunctionName(queryRef); // e.g. "trips:listTrips"
  for (const [key, config] of Object.entries(CACHE_CONFIGS)) {
    if (refName.includes(key)) {
      return config;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineQuery<Query extends FunctionReference<'query'>>(
  queryRef: Query,
  args: FunctionArgs<Query> | 'skip',
): FunctionReturnType<Query> | undefined {
  const { isOffline } = useOffline();
  const liveData = useQuery(queryRef, args);

  const [cachedData, setCachedData] = useState<
    FunctionReturnType<Query> | undefined
  >(undefined);

  // Stable serialised key so effects re-run when args actually change.
  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args);
  const resolvedArgs = useMemo<Record<string, unknown>>(
    () => (args === 'skip' ? {} : (args as Record<string, unknown>)),
    [argsKey],
  );

  // Write to cache whenever live data arrives.
  useEffect(() => {
    if (liveData === undefined) return;
    const config = findCacheConfig(queryRef);
    if (!config) return;

    config.cacheWrite(liveData, resolvedArgs).catch(() => {
      // Cache write failures are non-fatal — silently ignore.
    });
  }, [liveData, queryRef, resolvedArgs]);

  // Read from cache when offline and live data is unavailable.
  useEffect(() => {
    if (!isOffline || liveData !== undefined) return;
    const config = findCacheConfig(queryRef);
    if (!config) return;

    let cancelled = false;

    config
      .cacheRead(resolvedArgs)
      .then((result) => {
        if (!cancelled && result !== null && result !== undefined) {
          setCachedData(result as FunctionReturnType<Query>);
        }
      })
      .catch(() => {
        // Cache read failures are non-fatal — leave cachedData as-is.
      });

    return () => {
      cancelled = true;
    };
  }, [isOffline, liveData, queryRef, resolvedArgs]);

  // Prefer live data; fall back to cache only when offline.
  if (liveData !== undefined) return liveData;
  if (isOffline) return cachedData;
  return undefined;
}

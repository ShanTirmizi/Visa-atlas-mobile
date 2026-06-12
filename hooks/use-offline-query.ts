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
// Cache-write hygiene
// ---------------------------------------------------------------------------

/** Trailing debounce for cache writes. Convex re-emits the full document on
 *  every server patch (per-section/per-day updates while a trip streams in,
 *  message-list updates while the AI replies), and persisting each emission
 *  churns SQLite with snapshots that are stale milliseconds later. Instead
 *  we write at most once per quiet window, keeping the LAST payload seen. */
const CACHE_WRITE_DEBOUNCE_MS = 3000;

// Module-level (shared across hook instances): several screens often
// subscribe to the same query+args — e.g. trip detail and trip chat both
// read getTrip — so both maps are keyed on query name + serialized args.
// Duplicate subscriptions converge on one debounce timer, and a payload
// identical to the last one written is skipped entirely.
const lastWrittenHashByKey = new Map<string, string>();
const pendingWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Tiny non-cryptographic hash (djb2) over the serialized payload. We only
 *  need "did the payload change since the last write?", and retaining full
 *  serialized payloads per query key would pin megabytes of JS heap. The
 *  length prefix further cuts the (already negligible) collision risk. */
function hashPayload(serialized: string): string {
  let hash = 5381;
  for (let i = 0; i < serialized.length; i++) {
    hash = ((hash << 5) + hash + serialized.charCodeAt(i)) | 0;
  }
  return `${serialized.length}:${hash}`;
}

/** True when the doc is still streaming in server-side. Caching it would
 *  burn a disk write on data that's about to change again — we re-cache
 *  once it settles (status flips away from 'generating'). */
function isMidGeneration(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { status?: unknown }).status === 'generating'
  );
}

/** Drop mid-generation docs from a payload before caching: a single
 *  generating doc skips the write entirely (undefined); an array keeps only
 *  its settled members (upsert-style writes never delete the others). */
function omitMidGeneration(data: unknown): unknown {
  if (isMidGeneration(data)) return undefined;
  if (Array.isArray(data)) return data.filter((item) => !isMidGeneration(item));
  return data;
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

  // Write to cache whenever live data arrives — debounced (trailing,
  // CACHE_WRITE_DEBOUNCE_MS), deduped against the last payload written for
  // this query+args, and skipped while the doc is still mid-generation.
  useEffect(() => {
    if (liveData === undefined) return;
    const config = findCacheConfig(queryRef);
    if (!config) return;

    const writable = omitMidGeneration(liveData);
    if (writable === undefined) return; // mid-generation — re-cache on settle

    const cacheKey = `${getFunctionName(queryRef)}:${argsKey}`;
    const argsForWrite = resolvedArgs;

    // Trailing debounce on a module-level timer: every emission within the
    // window replaces the scheduled snapshot, so only the LAST one in a
    // burst hits SQLite. Deliberately NOT cleared on unmount — the final
    // write should still land if the user navigates away mid-window, and
    // the callback touches no React state.
    const existing = pendingWriteTimers.get(cacheKey);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingWriteTimers.delete(cacheKey);
      // Serialize once per quiet window (not per emission) — dedupes
      // identical payloads across hook instances subscribed to this key.
      const payloadHash = hashPayload(JSON.stringify(writable));
      if (lastWrittenHashByKey.get(cacheKey) === payloadHash) return;
      lastWrittenHashByKey.set(cacheKey, payloadHash);
      config.cacheWrite(writable, argsForWrite).catch(() => {
        // Cache write failures are non-fatal — forget the hash so the next
        // emission retries the write.
        lastWrittenHashByKey.delete(cacheKey);
      });
    }, CACHE_WRITE_DEBOUNCE_MS);
    pendingWriteTimers.set(cacheKey, timer);
  }, [liveData, queryRef, argsKey, resolvedArgs]);

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

// lib/offline/sync.ts
// Replays queued offline mutations and refreshes the local cache from Convex.

import type { ConvexReactClient } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  getPendingMutations,
  updateMutationStatus,
  clearCompletedMutations,
  cacheTrips,
  cacheBookings,
  cacheVisaGuides,
  removeStaleCacheEntries,
  setSyncMeta,
} from '@/lib/offline/database';
import type { MutationIntent } from '@/lib/offline/types';

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function executeMutationIntent(
  client: ConvexReactClient,
  intent: MutationIntent,
): Promise<void> {
  const { action, documentId, payload } = intent;

  switch (action) {
    case 'updateTripStatus': {
      const status = payload.status;
      if (typeof status !== 'string') {
        throw new Error(`updateTripStatus: expected string status, got ${typeof status}`);
      }
      await client.mutation(api.trips.updateTripStatus, {
        id: documentId as Id<'trips'>,
        status: status as 'planned' | 'completed',
      });
      break;
    }

    case 'updateTripField': {
      const field = payload.field;
      const value = payload.value;
      if (typeof field !== 'string') {
        throw new Error(`updateTripField: expected string field, got ${typeof field}`);
      }
      if (typeof value !== 'string') {
        throw new Error(`updateTripField: expected string value, got ${typeof value}`);
      }
      await client.mutation(api.trips.updateTripField, {
        id: documentId as Id<'trips'>,
        field,
        value,
      });
      break;
    }

    case 'updateVisaChecklist': {
      const checklist = payload.checklist;
      if (typeof checklist !== 'string') {
        throw new Error(
          `updateVisaChecklist: expected string checklist, got ${typeof checklist}`,
        );
      }
      await client.mutation(api.visaGuides.updateChecklist, {
        id: documentId as Id<'visaGuides'>,
        checklist,
      });
      break;
    }

    case 'updateVisaStatus': {
      const status = payload.status;
      if (typeof status !== 'string') {
        throw new Error(`updateVisaStatus: expected string status, got ${typeof status}`);
      }
      await client.mutation(api.visaGuides.updateStatus, {
        id: documentId as Id<'visaGuides'>,
        status: status as 'preparing' | 'submitted' | 'approved' | 'rejected',
      });
      break;
    }

    case 'updateBooking': {
      // Spread all payload fields as the updates argument.
      const { ...updates } = payload;
      await client.mutation(api.bookings.updateBooking, {
        id: documentId as Id<'bookings'>,
        ...updates,
      });
      break;
    }

    default: {
      // Exhaustiveness guard — TypeScript narrows `action` to `never` here.
      const _exhaustive: never = action;
      throw new Error(`Unknown mutation action: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Exported: replayMutationQueue
// ---------------------------------------------------------------------------

/**
 * Fetch all pending/failed mutations from the local queue, execute each one
 * against Convex, then clear completed entries.
 *
 * @returns The number of mutations that succeeded.
 */
export async function replayMutationQueue(client: ConvexReactClient): Promise<number> {
  const pending = await getPendingMutations();
  let successCount = 0;

  for (const queued of pending) {
    await updateMutationStatus(queued.id, 'processing');

    try {
      await executeMutationIntent(client, queued.intent);
      await updateMutationStatus(queued.id, 'completed');
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateMutationStatus(queued.id, 'failed', message);
    }
  }

  await clearCompletedMutations();
  return successCount;
}

// ---------------------------------------------------------------------------
// Exported: refreshCache
// ---------------------------------------------------------------------------

/**
 * Fetch all data from Convex and write it into the local SQLite cache,
 * removing any stale entries that are no longer present on the server.
 * Updates `last_full_sync` in sync_meta when successful.
 */
export async function refreshCache(client: ConvexReactClient): Promise<void> {
  try {
    // Fetch all data in parallel for faster sync on slow connections
    const [trips, bookings, guides] = await Promise.all([
      client.query(api.trips.listTrips, {}),
      client.query(api.bookings.listBookings, {}),
      client.query(api.visaGuides.listGuides, {}),
    ]);

    const tripDocs = trips as Array<{ _id: string } & Record<string, unknown>>;
    const bookingDocs = bookings as Array<
      { _id: string; tripId?: string } & Record<string, unknown>
    >;
    const guideDocs = guides as Array<
      { _id: string; countryCode: string } & Record<string, unknown>
    >;

    await cacheTrips(tripDocs);
    await removeStaleCacheEntries('cached_trips', tripDocs.map((t) => t._id));

    await cacheBookings(bookingDocs);
    await removeStaleCacheEntries('cached_bookings', bookingDocs.map((b) => b._id));

    await cacheVisaGuides(guideDocs);
    await removeStaleCacheEntries('cached_visa_guides', guideDocs.map((g) => g._id));

    await setSyncMeta('last_full_sync', String(Date.now()));
  } catch (err) {
    console.warn('[offline/sync] refreshCache failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Exported: syncOnReconnect
// ---------------------------------------------------------------------------

/**
 * Replay the pending mutation queue first, then refresh the local cache.
 *
 * @returns An object containing the count of successfully replayed mutations.
 */
export async function syncOnReconnect(
  client: ConvexReactClient,
): Promise<{ replayed: number }> {
  const replayed = await replayMutationQueue(client);
  await refreshCache(client);
  return { replayed };
}

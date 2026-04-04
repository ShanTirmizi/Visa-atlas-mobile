// lib/offline/precache.ts
// Pre-caches data for trips starting within 24 hours so they are available
// when the device goes offline.

import type { ConvexReactClient } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  cacheTrip,
  cacheBookings,
  cacheVisaGuide,
  cacheTripMessages,
  getSyncMeta,
  setSyncMeta,
} from '@/lib/offline/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Exported: shouldRunPrecache
// ---------------------------------------------------------------------------

/**
 * Returns true when more than 6 hours have elapsed since the last pre-cache
 * check (or when no check has ever been recorded).
 */
export async function shouldRunPrecache(): Promise<boolean> {
  const raw = await getSyncMeta('last_precache_check');
  if (raw === null) return true;

  const lastCheck = Number(raw);
  if (Number.isNaN(lastCheck)) return true;

  return Date.now() - lastCheck > SIX_HOURS_MS;
}

// ---------------------------------------------------------------------------
// Exported: precacheUpcomingTrips
// ---------------------------------------------------------------------------

/**
 * Fetches all trips from Convex, identifies those starting within the next
 * 24 hours, and pre-caches each trip along with its linked bookings, visa
 * guide, and messages.
 *
 * Sub-fetches for individual trips are non-critical: a failure for one trip
 * does not prevent the others from being cached.
 *
 * @returns The number of upcoming trips that were cached.
 */
export async function precacheUpcomingTrips(client: ConvexReactClient): Promise<number> {
  const trips = await client.query(api.trips.listTrips, {});
  const tripDocs = trips as Array<
    { _id: string; startDate?: number; countryCode?: string } & Record<string, unknown>
  >;

  const now = Date.now();
  const upcoming = tripDocs.filter((trip) => {
    if (typeof trip.startDate !== 'number') return false;
    const delta = trip.startDate - now;
    return delta >= 0 && delta <= TWENTY_FOUR_HOURS_MS;
  });

  let cachedCount = 0;

  for (const trip of upcoming) {
    // Always cache the trip document itself.
    await cacheTrip(trip._id, trip);

    const tripId = trip._id as Id<'trips'>;

    // Linked bookings — non-critical.
    try {
      const bookings = await client.query(api.bookings.listBookingsByTrip, {
        tripId,
      });
      const bookingDocs = bookings as Array<
        { _id: string; tripId?: string } & Record<string, unknown>
      >;
      await cacheBookings(bookingDocs);
    } catch (err) {
      console.warn(
        `[offline/precache] Failed to cache bookings for trip ${trip._id}:`,
        err,
      );
    }

    // Visa guide — non-critical.
    try {
      if (typeof trip.countryCode === 'string' && trip.countryCode.length > 0) {
        const guide = await client.query(api.visaGuides.getGuideByCountry, {
          countryCode: trip.countryCode,
        });
        if (guide !== null) {
          const guideDoc = guide as { _id: string; countryCode: string } & Record<
            string,
            unknown
          >;
          await cacheVisaGuide(guideDoc._id, guideDoc.countryCode, guideDoc);
        }
      }
    } catch (err) {
      console.warn(
        `[offline/precache] Failed to cache visa guide for trip ${trip._id}:`,
        err,
      );
    }

    // Trip messages — non-critical.
    try {
      const messages = await client.query(api.trips.getMessages, { tripId });
      const messageDocs = messages as Array<
        { _id: string } & Record<string, unknown>
      >;
      await cacheTripMessages(trip._id, messageDocs);
    } catch (err) {
      console.warn(
        `[offline/precache] Failed to cache messages for trip ${trip._id}:`,
        err,
      );
    }

    cachedCount++;
  }

  await setSyncMeta('last_precache_check', String(Date.now()));
  return cachedCount;
}

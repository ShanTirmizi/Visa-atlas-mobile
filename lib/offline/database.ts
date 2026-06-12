// lib/offline/database.ts
// SQLite schema + CRUD operations for the offline cache.

import * as SQLite from 'expo-sqlite';
import type {
  CachedDocument,
  CachedBooking,
  CachedVisaGuide,
  CachedTripMessage,
  MutationIntent,
  QueuedMutation,
} from './types';

// ---------------------------------------------------------------------------
// Singleton connection
// ---------------------------------------------------------------------------

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db !== null) return db;
  db = await SQLite.openDatabaseAsync('visa_atlas_offline.db');
  return db;
}

// ---------------------------------------------------------------------------
// Schema init
// ---------------------------------------------------------------------------

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cached_trips (
      id         TEXT    PRIMARY KEY,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_bookings (
      id         TEXT    PRIMARY KEY,
      trip_id    TEXT,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_visa_guides (
      id           TEXT    PRIMARY KEY,
      country_code TEXT    NOT NULL,
      data         TEXT    NOT NULL,
      updated_at   INTEGER NOT NULL,
      synced_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_trip_messages (
      id         TEXT    PRIMARY KEY,
      trip_id    TEXT    NOT NULL,
      data       TEXT    NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      intent      TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      error       TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = (): number => Date.now();

function serialize(data: unknown): string {
  return JSON.stringify(data);
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export async function cacheTrip(id: string, data: unknown): Promise<void> {
  const database = await getDatabase();
  const timestamp = now();
  await database.runAsync(
    'INSERT OR REPLACE INTO cached_trips (id, data, updated_at, synced_at) VALUES (?, ?, ?, ?)',
    id,
    serialize(data),
    timestamp,
    timestamp,
  );
}

export async function cacheTrips(
  trips: Array<{ _id: string } & Record<string, unknown>>,
): Promise<void> {
  await Promise.all(trips.map((trip) => cacheTrip(trip._id, trip)));
}

export async function getCachedTrip(id: string): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedDocument>(
    'SELECT * FROM cached_trips WHERE id = ?',
    id,
  );
  if (!row) return null;
  return JSON.parse(row.data) as unknown;
}

export async function getAllCachedTrips(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedDocument>(
    'SELECT * FROM cached_trips ORDER BY updated_at DESC',
  );
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export async function deleteCachedTrip(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_trips WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export async function cacheBooking(
  id: string,
  tripId: string | null,
  data: unknown,
): Promise<void> {
  const database = await getDatabase();
  const timestamp = now();
  await database.runAsync(
    'INSERT OR REPLACE INTO cached_bookings (id, trip_id, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)',
    id,
    tripId,
    serialize(data),
    timestamp,
    timestamp,
  );
}

export async function cacheBookings(
  bookings: Array<{ _id: string; tripId?: string } & Record<string, unknown>>,
): Promise<void> {
  await Promise.all(
    bookings.map((booking) =>
      cacheBooking(booking._id, booking.tripId ?? null, booking),
    ),
  );
}

export async function getCachedBookingsByTrip(tripId: string): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedBooking>(
    'SELECT * FROM cached_bookings WHERE trip_id = ? ORDER BY updated_at DESC',
    tripId,
  );
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export async function getAllCachedBookings(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedBooking>(
    'SELECT * FROM cached_bookings ORDER BY updated_at DESC',
  );
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export async function deleteCachedBooking(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_bookings WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Visa Guides
// ---------------------------------------------------------------------------

export async function cacheVisaGuide(
  id: string,
  countryCode: string,
  data: unknown,
): Promise<void> {
  const database = await getDatabase();
  const timestamp = now();
  await database.runAsync(
    'INSERT OR REPLACE INTO cached_visa_guides (id, country_code, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)',
    id,
    countryCode,
    serialize(data),
    timestamp,
    timestamp,
  );
}

export async function cacheVisaGuides(
  guides: Array<{ _id: string; countryCode: string } & Record<string, unknown>>,
): Promise<void> {
  await Promise.all(
    guides.map((guide) => cacheVisaGuide(guide._id, guide.countryCode, guide)),
  );
}

export async function getCachedVisaGuide(id: string): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedVisaGuide>(
    'SELECT * FROM cached_visa_guides WHERE id = ?',
    id,
  );
  if (!row) return null;
  return JSON.parse(row.data) as unknown;
}

export async function getCachedVisaGuideByCountry(
  countryCode: string,
): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedVisaGuide>(
    'SELECT * FROM cached_visa_guides WHERE country_code = ? ORDER BY updated_at DESC LIMIT 1',
    countryCode,
  );
  if (!row) return null;
  return JSON.parse(row.data) as unknown;
}

export async function getAllCachedVisaGuides(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedVisaGuide>(
    'SELECT * FROM cached_visa_guides ORDER BY updated_at DESC',
  );
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

export async function deleteCachedVisaGuide(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_visa_guides WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Trip Messages
// ---------------------------------------------------------------------------

export async function cacheTripMessages(
  tripId: string,
  messages: Array<{ _id: string } & Record<string, unknown>>,
): Promise<void> {
  const database = await getDatabase();
  const timestamp = now();
  // Upsert inside ONE transaction instead of the old delete-all +
  // insert-per-row: each chat update re-sends the same N messages plus one,
  // so rewriting every row churned the WAL on every new message (and a
  // crash between the DELETE and the INSERTs lost the whole thread).
  // ON CONFLICT touches only changed rows; the trailing DELETE prunes
  // messages removed server-side, preserving the old wipe semantics.
  await database.withTransactionAsync(async () => {
    for (const message of messages) {
      // Prefer the message's own timestamp for updated_at so the
      // chronological read order (ORDER BY updated_at ASC) survives
      // upserts — write-time stamps would tie across a whole batch.
      const messageTimestamp =
        typeof message.timestamp === 'number' ? message.timestamp : timestamp;
      await database.runAsync(
        `INSERT INTO cached_trip_messages (id, trip_id, data, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           trip_id    = excluded.trip_id,
           data       = excluded.data,
           updated_at = excluded.updated_at,
           synced_at  = excluded.synced_at`,
        message._id,
        tripId,
        serialize(message),
        messageTimestamp,
        timestamp,
      );
    }
    if (messages.length === 0) {
      await database.runAsync(
        'DELETE FROM cached_trip_messages WHERE trip_id = ?',
        tripId,
      );
    } else {
      const placeholders = messages.map(() => '?').join(', ');
      await database.runAsync(
        `DELETE FROM cached_trip_messages WHERE trip_id = ? AND id NOT IN (${placeholders})`,
        tripId,
        ...messages.map((message) => message._id),
      );
    }
  });
}

export async function getCachedTripMessages(tripId: string): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedTripMessage>(
    'SELECT * FROM cached_trip_messages WHERE trip_id = ? ORDER BY updated_at ASC',
    tripId,
  );
  return rows.map((row) => JSON.parse(row.data) as unknown);
}

// ---------------------------------------------------------------------------
// Mutation Queue
// ---------------------------------------------------------------------------

export async function enqueueMutation(intent: MutationIntent): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT INTO mutation_queue (intent, created_at, status, retry_count) VALUES (?, ?, ?, ?)',
    serialize(intent),
    now(),
    'pending',
    0,
  );
  return result.lastInsertRowId;
}

interface RawQueuedMutation {
  id: number;
  intent: string;
  created_at: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error: string | null;
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<RawQueuedMutation>(
    "SELECT * FROM mutation_queue WHERE (status = 'pending' OR status = 'failed') AND retry_count < 3 ORDER BY created_at ASC",
  );
  return rows.map((row) => ({
    id: row.id,
    intent: JSON.parse(row.intent) as MutationIntent,
    created_at: row.created_at,
    status: row.status,
    retry_count: row.retry_count,
    error: row.error,
  }));
}

export async function getPendingMutationCount(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM mutation_queue WHERE (status = 'pending' OR status = 'failed') AND retry_count < 3",
  );
  return row?.count ?? 0;
}

export async function updateMutationStatus(
  id: number,
  status: 'processing' | 'completed' | 'failed',
  error?: string,
): Promise<void> {
  const database = await getDatabase();
  if (status === 'failed') {
    await database.runAsync(
      'UPDATE mutation_queue SET status = ?, retry_count = retry_count + 1, error = ? WHERE id = ?',
      status,
      error ?? null,
      id,
    );
  } else {
    await database.runAsync(
      'UPDATE mutation_queue SET status = ?, error = ? WHERE id = ?',
      status,
      error ?? null,
      id,
    );
  }
}

export async function clearCompletedMutations(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM mutation_queue WHERE status = 'completed'",
  );
}

// ---------------------------------------------------------------------------
// Sync Meta
// ---------------------------------------------------------------------------

export async function getSyncMeta(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ key: string; value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
    key,
    value,
  );
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

export async function clearAllCache(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM cached_trips;
    DELETE FROM cached_bookings;
    DELETE FROM cached_visa_guides;
    DELETE FROM cached_trip_messages;
    DELETE FROM mutation_queue;
    DELETE FROM sync_meta;
  `);
}

export async function removeStaleCacheEntries(
  table: 'cached_trips' | 'cached_bookings' | 'cached_visa_guides',
  activeIds: string[],
): Promise<void> {
  if (activeIds.length === 0) {
    // No active IDs means remove everything from the table.
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM ${table}`);
    return;
  }

  const database = await getDatabase();
  // Build a parameterised NOT IN clause — expo-sqlite accepts varargs.
  const placeholders = activeIds.map(() => '?').join(', ');
  await database.runAsync(
    `DELETE FROM ${table} WHERE id NOT IN (${placeholders})`,
    ...activeIds,
  );
}

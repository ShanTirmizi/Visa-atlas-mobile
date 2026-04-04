# Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline support so travelers can access trips, bookings, and visa guides without connectivity, with queued mutations that sync on reconnect.

**Architecture:** Thin cache layer using expo-sqlite between Convex and UI. OfflineProvider context manages connectivity state. Custom hooks (`useOfflineQuery`, `useOfflineMutation`) replace direct Convex hooks in screens. Intent-based mutation queue for collaboration-ready offline edits.

**Tech Stack:** expo-sqlite, @react-native-community/netinfo, Convex, Expo SDK 54, React Native 0.81

---

## File Structure

### New Files
```
lib/offline/types.ts             — Shared types (MutationIntent, CacheEntry, SyncMeta)
lib/offline/database.ts          — SQLite schema + CRUD operations
lib/offline/sync.ts              — Mutation queue replay + cache refresh
lib/offline/precache.ts          — 24hr pre-departure caching logic
hooks/use-offline-query.ts       — Offline-aware query hook (replaces useQuery)
hooks/use-offline-mutation.ts    — Offline-aware mutation hook (replaces useMutation)
contexts/offline-context.tsx     — OfflineProvider: connectivity, sync lifecycle
components/OfflineIndicator.tsx  — Offline status banner UI
```

### Modified Files
```
package.json                     — Add expo-sqlite, @react-native-community/netinfo
app/_layout.tsx:151-161          — Wrap with OfflineProvider after ConvexProvider
app/(tabs)/trips.tsx:14-15,94-96 — Swap useQuery/useMutation to offline hooks
app/(tabs)/guides.tsx:13-14,126-127 — Swap useQuery/useMutation to offline hooks
app/trip/[id].tsx:12-13,158      — Swap useQuery to useOfflineQuery
app/guide/[id].tsx:11-13,211-213 — Swap useQuery/useMutation to offline hooks
app/chat/[tripId].tsx:15-16,43-45 — Swap useQuery to useOfflineQuery, add offline guard
```

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install expo-sqlite and netinfo**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
npx expo install expo-sqlite @react-native-community/netinfo
```

- [ ] **Step 2: Verify installation**

```bash
npx expo config --type public | grep -E "sqlite|netinfo"
```

Expected: Both packages listed in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-sqlite and netinfo for offline mode"
```

---

### Task 2: Offline Types

**Files:**
- Create: `lib/offline/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// lib/offline/types.ts

export interface CachedDocument {
  id: string;
  data: string; // JSON stringified document
  updated_at: number; // Unix timestamp ms
  synced_at: number; // Unix timestamp ms
}

export interface CachedBooking extends CachedDocument {
  trip_id: string | null;
}

export interface CachedVisaGuide extends CachedDocument {
  country_code: string;
}

export interface CachedTripMessage extends CachedDocument {
  trip_id: string;
}

export type MutationAction =
  | 'updateVisaChecklist'
  | 'updateVisaStatus'
  | 'updateTripStatus'
  | 'updateTripField'
  | 'updateBooking';

export interface MutationIntent {
  action: MutationAction;
  table: 'trips' | 'bookings' | 'visaGuides';
  documentId: string;
  payload: Record<string, unknown>;
}

export interface QueuedMutation {
  id: number;
  intent: MutationIntent;
  created_at: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error: string | null;
}

export interface OfflineContextValue {
  isOffline: boolean;
  lastSyncTime: Date | null;
  pendingMutationCount: number;
  isSyncing: boolean;
  forceSyncNow: () => Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/offline/types.ts
git commit -m "feat(offline): add shared types for offline mode"
```

---

### Task 3: SQLite Database Layer

**Files:**
- Create: `lib/offline/database.ts`

- [ ] **Step 1: Create the database module**

```typescript
// lib/offline/database.ts
import * as SQLite from 'expo-sqlite';
import type {
  CachedDocument,
  CachedBooking,
  CachedVisaGuide,
  CachedTripMessage,
  MutationIntent,
  QueuedMutation,
} from './types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('visa_atlas_offline.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cached_trips (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_bookings (
      id TEXT PRIMARY KEY,
      trip_id TEXT,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_visa_guides (
      id TEXT PRIMARY KEY,
      country_code TEXT,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_trip_messages (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intent TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ── Trips ──

export async function cacheTrip(id: string, data: unknown): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT OR REPLACE INTO cached_trips (id, data, updated_at, synced_at) VALUES (?, ?, ?, ?)`,
    id, JSON.stringify(data), now, now
  );
}

export async function cacheTrips(trips: Array<{ _id: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  for (const trip of trips) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_trips (id, data, updated_at, synced_at) VALUES (?, ?, ?, ?)`,
      trip._id, JSON.stringify(trip), now, now
    );
  }
}

export async function getCachedTrip(id: string): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedDocument>(
    'SELECT * FROM cached_trips WHERE id = ?', id
  );
  return row ? JSON.parse(row.data) : null;
}

export async function getAllCachedTrips(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedDocument>(
    'SELECT * FROM cached_trips ORDER BY updated_at DESC'
  );
  return rows.map(r => JSON.parse(r.data));
}

export async function deleteCachedTrip(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_trips WHERE id = ?', id);
}

// ── Bookings ──

export async function cacheBooking(id: string, tripId: string | null, data: unknown): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT OR REPLACE INTO cached_bookings (id, trip_id, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)`,
    id, tripId, JSON.stringify(data), now, now
  );
}

export async function cacheBookings(bookings: Array<{ _id: string; tripId?: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  for (const booking of bookings) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_bookings (id, trip_id, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)`,
      booking._id, booking.tripId ?? null, JSON.stringify(booking), now, now
    );
  }
}

export async function getCachedBookingsByTrip(tripId: string): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedBooking>(
    'SELECT * FROM cached_bookings WHERE trip_id = ? ORDER BY updated_at DESC', tripId
  );
  return rows.map(r => JSON.parse(r.data));
}

export async function getAllCachedBookings(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedDocument>(
    'SELECT * FROM cached_bookings ORDER BY updated_at DESC'
  );
  return rows.map(r => JSON.parse(r.data));
}

export async function deleteCachedBooking(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_bookings WHERE id = ?', id);
}

// ── Visa Guides ──

export async function cacheVisaGuide(id: string, countryCode: string, data: unknown): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT OR REPLACE INTO cached_visa_guides (id, country_code, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)`,
    id, countryCode, JSON.stringify(data), now, now
  );
}

export async function cacheVisaGuides(guides: Array<{ _id: string; countryCode: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  for (const guide of guides) {
    await database.runAsync(
      `INSERT OR REPLACE INTO cached_visa_guides (id, country_code, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)`,
      guide._id, guide.countryCode, JSON.stringify(guide), now, now
    );
  }
}

export async function getCachedVisaGuide(id: string): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedVisaGuide>(
    'SELECT * FROM cached_visa_guides WHERE id = ?', id
  );
  return row ? JSON.parse(row.data) : null;
}

export async function getCachedVisaGuideByCountry(countryCode: string): Promise<unknown | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<CachedVisaGuide>(
    'SELECT * FROM cached_visa_guides WHERE country_code = ?', countryCode
  );
  return row ? JSON.parse(row.data) : null;
}

export async function getAllCachedVisaGuides(): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedDocument>(
    'SELECT * FROM cached_visa_guides ORDER BY updated_at DESC'
  );
  return rows.map(r => JSON.parse(r.data));
}

export async function deleteCachedVisaGuide(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cached_visa_guides WHERE id = ?', id);
}

// ── Trip Messages ──

export async function cacheTripMessages(tripId: string, messages: Array<{ _id: string } & Record<string, unknown>>): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  // Clear old messages for this trip, then insert fresh
  await database.runAsync('DELETE FROM cached_trip_messages WHERE trip_id = ?', tripId);
  for (const msg of messages) {
    await database.runAsync(
      `INSERT INTO cached_trip_messages (id, trip_id, data, updated_at, synced_at) VALUES (?, ?, ?, ?, ?)`,
      msg._id, tripId, JSON.stringify(msg), now, now
    );
  }
}

export async function getCachedTripMessages(tripId: string): Promise<unknown[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CachedTripMessage>(
    'SELECT * FROM cached_trip_messages WHERE trip_id = ? ORDER BY updated_at ASC', tripId
  );
  return rows.map(r => JSON.parse(r.data));
}

// ── Mutation Queue ──

export async function enqueueMutation(intent: MutationIntent): Promise<number> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO mutation_queue (intent, created_at, status) VALUES (?, ?, 'pending')`,
    JSON.stringify(intent), Date.now()
  );
  return result.lastInsertRowId;
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: number; intent: string; created_at: number; status: string; retry_count: number; error: string | null }>(
    `SELECT * FROM mutation_queue WHERE status IN ('pending', 'failed') AND retry_count < 3 ORDER BY created_at ASC`
  );
  return rows.map(r => ({
    ...r,
    intent: JSON.parse(r.intent) as MutationIntent,
    status: r.status as QueuedMutation['status'],
  }));
}

export async function getPendingMutationCount(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM mutation_queue WHERE status IN ('pending', 'failed') AND retry_count < 3`
  );
  return row?.count ?? 0;
}

export async function updateMutationStatus(
  id: number,
  status: 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  const database = await getDatabase();
  if (status === 'failed') {
    await database.runAsync(
      `UPDATE mutation_queue SET status = ?, error = ?, retry_count = retry_count + 1 WHERE id = ?`,
      status, error ?? null, id
    );
  } else {
    await database.runAsync(
      `UPDATE mutation_queue SET status = ? WHERE id = ?`,
      status, id
    );
  }
}

export async function clearCompletedMutations(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM mutation_queue WHERE status = 'completed'`);
}

// ── Sync Meta ──

export async function getSyncMeta(key: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?', key
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`,
    key, value
  );
}

// ── Cache Management ──

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
  activeIds: string[]
): Promise<void> {
  if (activeIds.length === 0) return;
  const database = await getDatabase();
  const placeholders = activeIds.map(() => '?').join(',');
  await database.runAsync(
    `DELETE FROM ${table} WHERE id NOT IN (${placeholders})`,
    ...activeIds
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
npx tsc --noEmit lib/offline/database.ts lib/offline/types.ts 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/offline/database.ts
git commit -m "feat(offline): add SQLite database layer with CRUD for all entity types"
```

---

### Task 4: Sync Engine

**Files:**
- Create: `lib/offline/sync.ts`

This module replays the mutation queue and refreshes the cache. It receives the Convex client as a parameter (injected by OfflineProvider) to avoid importing Convex directly.

- [ ] **Step 1: Create the sync engine**

```typescript
// lib/offline/sync.ts
import { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  getPendingMutations,
  updateMutationStatus,
  clearCompletedMutations,
  cacheTrips,
  cacheBookings,
  cacheVisaGuides,
  removeStaleCacheEntries,
  setSyncMeta,
} from './database';
import type { MutationIntent } from './types';

async function executeMutationIntent(
  client: ConvexReactClient,
  intent: MutationIntent
): Promise<void> {
  switch (intent.action) {
    case 'updateTripStatus': {
      const { status } = intent.payload as { status: string };
      await client.mutation(api.trips.updateTripStatus, {
        id: intent.documentId as Id<'trips'>,
        status: status as 'planned' | 'completed',
      });
      break;
    }
    case 'updateTripField': {
      const { field, value } = intent.payload as { field: string; value: string };
      await client.mutation(api.trips.updateTripField, {
        id: intent.documentId as Id<'trips'>,
        field,
        value,
      });
      break;
    }
    case 'updateVisaChecklist': {
      const { checklist } = intent.payload as { checklist: string };
      await client.mutation(api.visaGuides.updateChecklist, {
        id: intent.documentId as Id<'visaGuides'>,
        checklist,
      });
      break;
    }
    case 'updateVisaStatus': {
      const { status } = intent.payload as { status: string };
      await client.mutation(api.visaGuides.updateStatus, {
        id: intent.documentId as Id<'visaGuides'>,
        status: status as 'preparing' | 'submitted' | 'approved' | 'rejected',
      });
      break;
    }
    case 'updateBooking': {
      const updates = intent.payload as Record<string, unknown>;
      await client.mutation(api.bookings.updateBooking, {
        id: intent.documentId as Id<'bookings'>,
        ...updates,
      });
      break;
    }
  }
}

export async function replayMutationQueue(client: ConvexReactClient): Promise<number> {
  const pending = await getPendingMutations();
  let successCount = 0;

  for (const mutation of pending) {
    await updateMutationStatus(mutation.id, 'processing');
    try {
      await executeMutationIntent(client, mutation.intent);
      await updateMutationStatus(mutation.id, 'completed');
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await updateMutationStatus(mutation.id, 'failed', message);
    }
  }

  await clearCompletedMutations();
  return successCount;
}

export async function refreshCache(client: ConvexReactClient): Promise<void> {
  try {
    // Fetch all data from Convex
    const [trips, bookings, guides] = await Promise.all([
      client.query(api.trips.listTrips),
      client.query(api.bookings.listBookings),
      client.query(api.visaGuides.listGuides),
    ]);

    // Cache everything
    if (trips) {
      await cacheTrips(trips as Array<{ _id: string } & Record<string, unknown>>);
      await removeStaleCacheEntries(
        'cached_trips',
        trips.map((t: { _id: string }) => t._id)
      );
    }

    if (bookings) {
      await cacheBookings(bookings as Array<{ _id: string; tripId?: string } & Record<string, unknown>>);
      await removeStaleCacheEntries(
        'cached_bookings',
        bookings.map((b: { _id: string }) => b._id)
      );
    }

    if (guides) {
      await cacheVisaGuides(guides as Array<{ _id: string; countryCode: string } & Record<string, unknown>>);
      await removeStaleCacheEntries(
        'cached_visa_guides',
        guides.map((g: { _id: string }) => g._id)
      );
    }

    await setSyncMeta('last_full_sync', new Date().toISOString());
  } catch (error) {
    console.warn('[OfflineSync] Cache refresh failed:', error);
  }
}

export async function syncOnReconnect(client: ConvexReactClient): Promise<{ replayed: number }> {
  // Replay mutations first, then refresh cache with latest server state
  const replayed = await replayMutationQueue(client);
  await refreshCache(client);
  return { replayed };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/offline/sync.ts
git commit -m "feat(offline): add sync engine with mutation replay and cache refresh"
```

---

### Task 5: Pre-cache Scheduler

**Files:**
- Create: `lib/offline/precache.ts`

- [ ] **Step 1: Create the pre-cache module**

```typescript
// lib/offline/precache.ts
import { ConvexReactClient } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  cacheTrip,
  cacheBookings,
  cacheVisaGuide,
  cacheTripMessages,
  setSyncMeta,
  getSyncMeta,
} from './database';

const PRECACHE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const PRECACHE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function shouldRunPrecache(): Promise<boolean> {
  const lastCheck = await getSyncMeta('last_precache_check');
  if (!lastCheck) return true;
  const elapsed = Date.now() - new Date(lastCheck).getTime();
  return elapsed >= PRECACHE_INTERVAL_MS;
}

export async function precacheUpcomingTrips(client: ConvexReactClient): Promise<number> {
  try {
    const trips = await client.query(api.trips.listTrips);
    if (!trips) return 0;

    const now = Date.now();
    let cachedCount = 0;

    for (const trip of trips) {
      const typedTrip = trip as { _id: string; startDate?: string; countryCode: string } & Record<string, unknown>;
      if (!typedTrip.startDate) continue;

      const startTime = new Date(typedTrip.startDate).getTime();
      const timeUntilDeparture = startTime - now;

      // Cache trips departing within 24 hours (or already started)
      if (timeUntilDeparture <= PRECACHE_WINDOW_MS) {
        // Cache the trip itself
        await cacheTrip(typedTrip._id, typedTrip);

        // Cache linked bookings
        try {
          const bookings = await client.query(api.bookings.listBookingsByTrip, {
            tripId: typedTrip._id as Id<'trips'>,
          });
          if (bookings) {
            await cacheBookings(
              bookings as Array<{ _id: string; tripId?: string } & Record<string, unknown>>
            );
          }
        } catch {
          // Non-critical — continue with other data
        }

        // Cache visa guide for destination
        try {
          const guide = await client.query(api.visaGuides.getGuideByCountry, {
            countryCode: typedTrip.countryCode,
          });
          if (guide) {
            const typedGuide = guide as { _id: string; countryCode: string } & Record<string, unknown>;
            await cacheVisaGuide(typedGuide._id, typedGuide.countryCode, typedGuide);
          }
        } catch {
          // Non-critical
        }

        // Cache trip messages
        try {
          const messages = await client.query(api.trips.getMessages, {
            tripId: typedTrip._id as Id<'trips'>,
          });
          if (messages) {
            await cacheTripMessages(
              typedTrip._id,
              messages as Array<{ _id: string } & Record<string, unknown>>
            );
          }
        } catch {
          // Non-critical
        }

        cachedCount++;
      }
    }

    await setSyncMeta('last_precache_check', new Date().toISOString());
    return cachedCount;
  } catch (error) {
    console.warn('[Precache] Failed:', error);
    return 0;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/offline/precache.ts
git commit -m "feat(offline): add 24hr pre-departure cache scheduler"
```

---

### Task 6: useOfflineQuery Hook

**Files:**
- Create: `hooks/use-offline-query.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/use-offline-query.ts
import { useEffect, useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { useOffline } from '@/contexts/offline-context';
import {
  getCachedTrip,
  getAllCachedTrips,
  getAllCachedBookings,
  getCachedBookingsByTrip,
  getCachedVisaGuide,
  getAllCachedVisaGuides,
  getCachedTripMessages,
  cacheTrip,
  cacheTrips,
  cacheBookings,
  cacheVisaGuide,
  cacheVisaGuides,
  cacheTripMessages,
  cacheBooking,
  getCachedVisaGuideByCountry,
} from '@/lib/offline/database';

type CacheConfig = {
  cacheWrite: (data: unknown, args: Record<string, unknown>) => Promise<void>;
  cacheRead: (args: Record<string, unknown>) => Promise<unknown>;
};

// Map query function names to cache operations.
// The key is matched by checking if the query reference string includes it.
const CACHE_CONFIGS: Record<string, CacheConfig> = {
  'listTrips': {
    cacheWrite: async (data) => {
      await cacheTrips(data as Array<{ _id: string } & Record<string, unknown>>);
    },
    cacheRead: async () => getAllCachedTrips(),
  },
  'getTrip': {
    cacheWrite: async (data, args) => {
      const doc = data as { _id: string } & Record<string, unknown>;
      await cacheTrip(doc._id, doc);
    },
    cacheRead: async (args) => getCachedTrip(args.id as string),
  },
  'listBookings': {
    cacheWrite: async (data) => {
      await cacheBookings(data as Array<{ _id: string; tripId?: string } & Record<string, unknown>>);
    },
    cacheRead: async () => getAllCachedBookings(),
  },
  'listBookingsByTrip': {
    cacheWrite: async (data, args) => {
      await cacheBookings(data as Array<{ _id: string; tripId?: string } & Record<string, unknown>>);
    },
    cacheRead: async (args) => getCachedBookingsByTrip(args.tripId as string),
  },
  'getGuide': {
    cacheWrite: async (data) => {
      const doc = data as { _id: string; countryCode: string } & Record<string, unknown>;
      await cacheVisaGuide(doc._id, doc.countryCode, doc);
    },
    cacheRead: async (args) => getCachedVisaGuide(args.id as string),
  },
  'listGuides': {
    cacheWrite: async (data) => {
      await cacheVisaGuides(data as Array<{ _id: string; countryCode: string } & Record<string, unknown>>);
    },
    cacheRead: async () => getAllCachedVisaGuides(),
  },
  'getGuideByCountry': {
    cacheWrite: async (data) => {
      const doc = data as { _id: string; countryCode: string } & Record<string, unknown>;
      await cacheVisaGuide(doc._id, doc.countryCode, doc);
    },
    cacheRead: async (args) => {
      return getCachedVisaGuideByCountry(args.countryCode as string);
    },
  },
  'getMessages': {
    cacheWrite: async (data, args) => {
      await cacheTripMessages(
        args.tripId as string,
        data as Array<{ _id: string } & Record<string, unknown>>
      );
    },
    cacheRead: async (args) => getCachedTripMessages(args.tripId as string),
  },
};

function findCacheConfig(queryRef: unknown): CacheConfig | null {
  // Convex function references have a string representation like "api.trips.listTrips"
  const refStr = String(queryRef);
  for (const [key, config] of Object.entries(CACHE_CONFIGS)) {
    if (refStr.includes(key)) {
      return config;
    }
  }
  return null;
}

export function useOfflineQuery<Query extends FunctionReference<'query'>>(
  queryRef: Query,
  args: FunctionArgs<Query> | 'skip'
): FunctionReturnType<Query> | undefined {
  const { isOffline } = useOffline();
  const [cachedData, setCachedData] = useState<unknown>(undefined);

  // Always call useQuery — Convex handles 'skip' and returns undefined when offline
  const liveData = useQuery(queryRef, args as FunctionArgs<Query>);

  const cacheConfig = findCacheConfig(queryRef);
  const argsObj = (args === 'skip' ? {} : args) as Record<string, unknown>;

  // When we get live data, write it to cache
  useEffect(() => {
    if (liveData !== undefined && cacheConfig) {
      cacheConfig.cacheWrite(liveData, argsObj).catch((err) => {
        console.warn('[OfflineQuery] Cache write failed:', err);
      });
    }
  }, [liveData]);

  // When offline and no live data, read from cache
  useEffect(() => {
    if (isOffline && liveData === undefined && cacheConfig && args !== 'skip') {
      cacheConfig.cacheRead(argsObj).then((data) => {
        if (data !== null && data !== undefined) {
          setCachedData(data);
        }
      }).catch((err) => {
        console.warn('[OfflineQuery] Cache read failed:', err);
      });
    }
  }, [isOffline, liveData, args]);

  // Return live data if available, otherwise cached data when offline
  if (liveData !== undefined) {
    return liveData;
  }
  if (isOffline && cachedData !== undefined) {
    return cachedData as FunctionReturnType<Query>;
  }
  return undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-offline-query.ts
git commit -m "feat(offline): add useOfflineQuery hook with automatic cache read/write"
```

---

### Task 7: useOfflineMutation Hook

**Files:**
- Create: `hooks/use-offline-mutation.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/use-offline-mutation.ts
import { useMutation } from 'convex/react';
import type { FunctionReference, FunctionArgs } from 'convex/server';
import { useOffline } from '@/contexts/offline-context';
import {
  enqueueMutation,
  getCachedTrip,
  cacheTrip,
  getCachedVisaGuide,
  cacheVisaGuide,
} from '@/lib/offline/database';
import type { MutationIntent } from '@/lib/offline/types';

// Optimistic updaters — apply the mutation intent to cached data locally
async function applyOptimisticUpdate(intent: MutationIntent): Promise<void> {
  switch (intent.action) {
    case 'updateTripStatus': {
      const trip = await getCachedTrip(intent.documentId);
      if (trip && typeof trip === 'object') {
        const updated = { ...(trip as Record<string, unknown>), status: intent.payload.status };
        await cacheTrip(intent.documentId, updated);
      }
      break;
    }
    case 'updateTripField': {
      const trip = await getCachedTrip(intent.documentId);
      if (trip && typeof trip === 'object') {
        const { field, value } = intent.payload as { field: string; value: unknown };
        const updated = { ...(trip as Record<string, unknown>), [field]: value };
        await cacheTrip(intent.documentId, updated);
      }
      break;
    }
    case 'updateVisaChecklist': {
      const guide = await getCachedVisaGuide(intent.documentId);
      if (guide && typeof guide === 'object') {
        const updated = {
          ...(guide as Record<string, unknown>),
          checklist: intent.payload.checklist,
        };
        const typedGuide = guide as { countryCode: string };
        await cacheVisaGuide(intent.documentId, typedGuide.countryCode, updated);
      }
      break;
    }
    case 'updateVisaStatus': {
      const guide = await getCachedVisaGuide(intent.documentId);
      if (guide && typeof guide === 'object') {
        const updated = {
          ...(guide as Record<string, unknown>),
          status: intent.payload.status,
        };
        const typedGuide = guide as { countryCode: string };
        await cacheVisaGuide(intent.documentId, typedGuide.countryCode, updated);
      }
      break;
    }
    // updateBooking doesn't need optimistic update for MVP — bookings are read-only offline
  }
}

export function useOfflineMutation<Mutation extends FunctionReference<'mutation'>>(
  mutationRef: Mutation
): (args: FunctionArgs<Mutation>) => Promise<void> {
  const { isOffline } = useOffline();
  const convexMutation = useMutation(mutationRef);

  return async (args: FunctionArgs<Mutation>) => {
    if (!isOffline) {
      // Online: call Convex directly
      await convexMutation(args);
      return;
    }

    // Offline: determine intent from the mutation reference and args
    const refStr = String(mutationRef);
    let intent: MutationIntent | null = null;

    if (refStr.includes('updateTripStatus')) {
      const typedArgs = args as { id: string; status: string };
      intent = {
        action: 'updateTripStatus',
        table: 'trips',
        documentId: typedArgs.id,
        payload: { status: typedArgs.status },
      };
    } else if (refStr.includes('updateTripField')) {
      const typedArgs = args as { id: string; field: string; value: string };
      intent = {
        action: 'updateTripField',
        table: 'trips',
        documentId: typedArgs.id,
        payload: { field: typedArgs.field, value: typedArgs.value },
      };
    } else if (refStr.includes('updateChecklist')) {
      const typedArgs = args as { id: string; checklist: string };
      intent = {
        action: 'updateVisaChecklist',
        table: 'visaGuides',
        documentId: typedArgs.id,
        payload: { checklist: typedArgs.checklist },
      };
    } else if (refStr.includes('updateStatus') && refStr.includes('visaGuide')) {
      const typedArgs = args as { id: string; status: string };
      intent = {
        action: 'updateVisaStatus',
        table: 'visaGuides',
        documentId: typedArgs.id,
        payload: { status: typedArgs.status },
      };
    } else if (refStr.includes('updateBooking')) {
      const typedArgs = args as { id: string } & Record<string, unknown>;
      intent = {
        action: 'updateBooking',
        table: 'bookings',
        documentId: typedArgs.id,
        payload: typedArgs,
      };
    }

    if (!intent) {
      throw new Error(`Mutation not supported offline: ${refStr}`);
    }

    // Queue the mutation and apply optimistic update
    await enqueueMutation(intent);
    await applyOptimisticUpdate(intent);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-offline-mutation.ts
git commit -m "feat(offline): add useOfflineMutation hook with intent queue and optimistic updates"
```

---

### Task 8: OfflineProvider Context

**Files:**
- Create: `contexts/offline-context.tsx`

- [ ] **Step 1: Create the provider**

```typescript
// contexts/offline-context.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useConvex } from 'convex/react';
import {
  initDatabase,
  getPendingMutationCount,
  getSyncMeta,
} from '@/lib/offline/database';
import { syncOnReconnect, refreshCache } from '@/lib/offline/sync';
import { shouldRunPrecache, precacheUpcomingTrips } from '@/lib/offline/precache';
import type { OfflineContextValue } from '@/lib/offline/types';

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  lastSyncTime: null,
  pendingMutationCount: 0,
  isSyncing: false,
  forceSyncNow: async () => {},
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const client = useConvex();
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const wasOfflineRef = useRef(false);
  const precacheIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize database and load sync state
  useEffect(() => {
    async function init() {
      await initDatabase();
      const lastSync = await getSyncMeta('last_full_sync');
      if (lastSync) setLastSyncTime(new Date(lastSync));
      const count = await getPendingMutationCount();
      setPendingMutationCount(count);
      setIsInitialized(true);
    }
    init();
  }, []);

  // Refresh pending mutation count periodically
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingMutationCount();
    setPendingMutationCount(count);
  }, []);

  // Sync logic
  const performSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOnReconnect(client);
      setLastSyncTime(new Date());
      await refreshPendingCount();
    } catch (error) {
      console.warn('[OfflineProvider] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [client, isSyncing, refreshPendingCount]);

  // Full cache refresh (without mutation replay)
  const performCacheRefresh = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await refreshCache(client);
      setLastSyncTime(new Date());
    } catch (error) {
      console.warn('[OfflineProvider] Cache refresh failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [client, isSyncing]);

  // Force sync exposed to consumers
  const forceSyncNow = useCallback(async () => {
    if (isOffline) return;
    await performSync();
  }, [isOffline, performSync]);

  // Listen for connectivity changes
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);

      if (wasOfflineRef.current && !offline) {
        // Came back online — sync
        performSync();
      }
      wasOfflineRef.current = offline;
    });

    return () => unsubscribe();
  }, [isInitialized, performSync]);

  // Listen for app foregrounding
  useEffect(() => {
    if (!isInitialized) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !isOffline) {
        performCacheRefresh();
        // Check if we should run pre-cache
        shouldRunPrecache().then((should) => {
          if (should) {
            precacheUpcomingTrips(client).catch((err) =>
              console.warn('[OfflineProvider] Precache failed:', err)
            );
          }
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isInitialized, isOffline, client, performCacheRefresh]);

  // Initial sync + precache on mount (when online)
  useEffect(() => {
    if (!isInitialized || isOffline) return;

    performCacheRefresh();
    precacheUpcomingTrips(client).catch((err) =>
      console.warn('[OfflineProvider] Initial precache failed:', err)
    );
  }, [isInitialized]);

  // Set up precache interval (every 6 hours)
  useEffect(() => {
    if (!isInitialized) return;

    precacheIntervalRef.current = setInterval(() => {
      if (!isOffline) {
        shouldRunPrecache().then((should) => {
          if (should) {
            precacheUpcomingTrips(client).catch((err) =>
              console.warn('[OfflineProvider] Interval precache failed:', err)
            );
          }
        });
      }
    }, 6 * 60 * 60 * 1000);

    return () => {
      if (precacheIntervalRef.current) clearInterval(precacheIntervalRef.current);
    };
  }, [isInitialized, isOffline, client]);

  return (
    <OfflineContext.Provider
      value={{ isOffline, lastSyncTime, pendingMutationCount, isSyncing, forceSyncNow }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add contexts/offline-context.tsx
git commit -m "feat(offline): add OfflineProvider with connectivity detection, sync, and precache"
```

---

### Task 9: OfflineIndicator Component

**Files:**
- Create: `components/OfflineIndicator.tsx`

- [ ] **Step 1: Create the component**

This needs to read from the existing theme context for colors. Based on the codebase pattern, `useTheme()` returns `{ colors }`.

```typescript
// components/OfflineIndicator.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useOffline } from '@/contexts/offline-context';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react-native';

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OfflineIndicator() {
  const { colors } = useTheme();
  const { isOffline, lastSyncTime, pendingMutationCount, isSyncing, forceSyncNow } = useOffline();

  if (!isOffline && !isSyncing) return null;

  const backgroundColor = isSyncing ? colors.card : '#F59E0B';
  const textColor = isSyncing ? colors.text : '#000';

  let message = '';
  if (isSyncing) {
    message = 'Syncing...';
  } else if (isOffline) {
    const syncInfo = lastSyncTime ? `Last synced ${formatTimeSince(lastSyncTime)}` : 'No cached data';
    const pendingInfo = pendingMutationCount > 0 ? ` · ${pendingMutationCount} pending` : '';
    message = `Offline · ${syncInfo}${pendingInfo}`;
  }

  return (
    <TouchableOpacity
      onPress={!isOffline ? forceSyncNow : undefined}
      activeOpacity={isOffline ? 1 : 0.7}
      style={[styles.container, { backgroundColor }]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={colors.text} style={styles.icon} />
      ) : (
        <WifiOff size={14} color={textColor} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/OfflineIndicator.tsx
git commit -m "feat(offline): add OfflineIndicator banner component"
```

---

### Task 10: Wire OfflineProvider into App Layout

**Files:**
- Modify: `app/_layout.tsx:36-41,151-161`

- [ ] **Step 1: Add import**

In `app/_layout.tsx`, add the OfflineProvider import after the existing context imports (around line 41):

```typescript
// After line 41 (import { ToastProvider } from '@/contexts/toast-context';)
// Add:
import { OfflineProvider } from '@/contexts/offline-context';
```

- [ ] **Step 2: Add OfflineIndicator import**

```typescript
// Add with other component imports:
import { OfflineIndicator } from '@/components/OfflineIndicator';
```

- [ ] **Step 3: Wrap with OfflineProvider**

In the provider nesting (around lines 151-161), add OfflineProvider after ConvexProvider but before ThemeProvider. The OfflineProvider needs Convex client (from ConvexProvider) and will be consumed by children:

Change the provider nesting from:
```tsx
<ConvexProvider>
  <ThemeProvider>
```

To:
```tsx
<ConvexProvider>
  <OfflineProvider>
    <ThemeProvider>
```

And close the OfflineProvider tag after the existing closing tags, matching the nesting.

- [ ] **Step 4: Add OfflineIndicator to ThemedApp**

Inside the `ThemedApp` component (the component that renders the Stack), add `<OfflineIndicator />` above the `<Stack>`:

```tsx
// Inside ThemedApp's return, before <Stack ...>:
<OfflineIndicator />
```

- [ ] **Step 5: Verify app boots without crash**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
npx expo start --clear
```

Expected: App boots, no crash. When online, no indicator visible.

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(offline): wire OfflineProvider and OfflineIndicator into app layout"
```

---

### Task 11: Migrate Trips Screen

**Files:**
- Modify: `app/(tabs)/trips.tsx:14-15,94-96`

- [ ] **Step 1: Swap imports**

Replace:
```typescript
import { useQuery, useMutation } from 'convex/react';
```

With:
```typescript
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
```

- [ ] **Step 2: Swap hook calls**

Replace (around line 94-96):
```typescript
const trips = useQuery(api.trips.listTrips);
const deleteTrip = useMutation(api.trips.deleteTrip);
const updateStatus = useMutation(api.trips.updateTripStatus);
```

With:
```typescript
const trips = useOfflineQuery(api.trips.listTrips, {});
const deleteTrip = useMutation(api.trips.deleteTrip); // Keep online-only (cascading delete)
const updateStatus = useOfflineMutation(api.trips.updateTripStatus);
```

Note: `deleteTrip` stays as regular `useMutation` because deleting a trip cascades to tripMessages and should not be done offline. Add the `useMutation` import back:

```typescript
import { useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
```

- [ ] **Step 3: Add offline guard for delete**

Find the delete handler and add an offline check. Import `useOffline`:

```typescript
import { useOffline } from '@/contexts/offline-context';
```

In the component, add:
```typescript
const { isOffline } = useOffline();
```

In the delete confirmation handler, add at the top:
```typescript
if (isOffline) return; // Delete not available offline
```

- [ ] **Step 4: Verify trips screen loads with cached data**

Open the app, navigate to Trips tab. Data should load normally (online). Toggle airplane mode — trips should still display from cache.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/trips.tsx
git commit -m "feat(offline): migrate trips screen to offline-aware hooks"
```

---

### Task 12: Migrate Guides Screen

**Files:**
- Modify: `app/(tabs)/guides.tsx:13-14,126-127`

- [ ] **Step 1: Swap imports**

Replace:
```typescript
import { useQuery, useMutation } from 'convex/react';
```

With:
```typescript
import { useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
```

- [ ] **Step 2: Swap query call**

Replace (around line 126):
```typescript
const guides = useQuery(api.visaGuides.listGuides);
```

With:
```typescript
const guides = useOfflineQuery(api.visaGuides.listGuides, {});
```

Keep `deleteGuide` as regular `useMutation` (online-only).

- [ ] **Step 3: Add offline guard for delete**

```typescript
import { useOffline } from '@/contexts/offline-context';
// In component:
const { isOffline } = useOffline();
// In delete handler:
if (isOffline) return;
```

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/guides.tsx
git commit -m "feat(offline): migrate guides screen to offline-aware hooks"
```

---

### Task 13: Migrate Trip Detail Screen

**Files:**
- Modify: `app/trip/[id].tsx:12-13,158`

- [ ] **Step 1: Swap imports**

Replace:
```typescript
import { useQuery } from 'convex/react';
```

With:
```typescript
import { useOfflineQuery } from '@/hooks/use-offline-query';
```

- [ ] **Step 2: Swap query call**

Replace (around line 158):
```typescript
const trip = useQuery(api.trips.getTrip, { id: id as any });
```

With:
```typescript
const trip = useOfflineQuery(api.trips.getTrip, { id: id as Id<'trips'> });
```

Also ensure `Id` is imported from `@/convex/_generated/dataModel` (it may already be).

- [ ] **Step 3: Commit**

```bash
git add app/trip/[id].tsx
git commit -m "feat(offline): migrate trip detail screen to offline-aware hooks"
```

---

### Task 14: Migrate Visa Guide Detail Screen

**Files:**
- Modify: `app/guide/[id].tsx:11-13,211-213`

- [ ] **Step 1: Swap imports**

Replace:
```typescript
import { useQuery, useMutation } from 'convex/react';
```

With:
```typescript
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
```

- [ ] **Step 2: Swap hook calls**

Replace (around line 211-213):
```typescript
const guide = useQuery(api.visaGuides.getGuide, id ? { id: id as Id<'visaGuides'> } : 'skip');
const updateChecklist = useMutation(api.visaGuides.updateChecklist);
const updateStatus = useMutation(api.visaGuides.updateStatus);
```

With:
```typescript
const guide = useOfflineQuery(api.visaGuides.getGuide, id ? { id: id as Id<'visaGuides'> } : 'skip');
const updateChecklist = useOfflineMutation(api.visaGuides.updateChecklist);
const updateStatus = useOfflineMutation(api.visaGuides.updateStatus);
```

- [ ] **Step 3: Commit**

```bash
git add app/guide/[id].tsx
git commit -m "feat(offline): migrate visa guide detail to offline-aware hooks with queued mutations"
```

---

### Task 15: Migrate Chat Screen

**Files:**
- Modify: `app/chat/[tripId].tsx:15-16,43-45`

- [ ] **Step 1: Swap import and add offline context**

Replace:
```typescript
import { useQuery } from 'convex/react';
```

With:
```typescript
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOffline } from '@/contexts/offline-context';
```

- [ ] **Step 2: Swap query call**

Replace (around line 43-45):
```typescript
const trip = useQuery(api.trips.getTrip, {
  id: tripId as Id<'trips'>,
});
```

With:
```typescript
const trip = useOfflineQuery(api.trips.getTrip, {
  id: tripId as Id<'trips'>,
});
```

- [ ] **Step 3: Add offline guard for chat input**

In the component, add:
```typescript
const { isOffline } = useOffline();
```

Find the chat input / send button area. When offline, disable the input and show a message:

```tsx
{isOffline && (
  <View style={{ padding: 16, alignItems: 'center' }}>
    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
      Chat is unavailable offline. Your trip details are still accessible above.
    </Text>
  </View>
)}
```

Wrap the existing input/send UI with `{!isOffline && ( ... )}`.

- [ ] **Step 4: Commit**

```bash
git add app/chat/[tripId].tsx
git commit -m "feat(offline): migrate chat screen with offline guard for AI chat"
```

---

### Task 16: End-to-End Verification

- [ ] **Step 1: Start the app fresh**

```bash
cd /Users/shahnawaztirmizi/Desktop/2026/personal/visa-atlas-mobile
npx expo start --clear
```

- [ ] **Step 2: Test online flow**

1. Open the app (online)
2. Navigate to Trips — verify trips load
3. Open a trip detail — verify all tabs work
4. Go to Guides — verify guides load
5. Open a guide detail — toggle a checklist item

All should work exactly as before.

- [ ] **Step 3: Test offline flow**

1. Toggle airplane mode on device/simulator
2. Verify OfflineIndicator appears (amber bar with "Offline" message)
3. Navigate to Trips — verify cached trips display
4. Open a trip detail — verify cached data renders
5. Go to Guides — verify cached guides display
6. Open a guide — toggle a checklist item (should work via queue)
7. Open chat — verify "Chat unavailable offline" message shows, but trip data is visible

- [ ] **Step 4: Test reconnection sync**

1. Turn off airplane mode
2. Verify OfflineIndicator shows "Syncing..."
3. Verify the checklist toggle from step 3.6 synced to Convex
4. Verify indicator disappears after sync completes

- [ ] **Step 5: Final commit**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(offline): adjustments from end-to-end verification"
```

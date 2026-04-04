# Offline Mode for International Travelers — Design Spec

## Problem

Visa Atlas users lose access to trip data when they have no connectivity — exactly when they need it most (landing in a foreign country, at hotel check-in, navigating without a SIM). Competitors either paywall offline (Wanderlog $40-50/yr) or don't offer it at all (Roamy). We will offer it free.

## Decisions

- **Architecture:** Thin cache layer (Approach 1) — an `OfflineProvider` between Convex and UI. Convex remains the source of truth; expo-sqlite is a read cache + mutation queue.
- **Storage engine:** expo-sqlite — relational, queryable, handles the mutation queue well, future-proof for collaboration.
- **Caching strategy:** Cache all trips + bookings proactively (option B). Data is small (~1.5MB per user). Prioritize upcoming trips.
- **Mutation queue:** Intent-based (option B from brainstorming). Each offline mutation is stored as a discrete intent (`{action, table, id, payload}`) rather than a state overwrite. This is collaboration-friendly for the planned collaboration feature.
- **Conflict resolution:** Idempotent operations (toggles, status changes) use last-write-wins. Text field conflicts surface a review prompt. This will be enhanced when the collaboration feature lands.

## Architecture

```
Convex Server  <-->  useQuery / useMutation (existing)
                          |
                    OfflineProvider
                     /          \
              Online?          Offline?
              /                     \
     Convex live data         expo-sqlite cache
     + write to cache         + mutation queue
```

### Core Components

#### 1. SQLite Database — `lib/offline/database.ts`

Manages the local SQLite database with these tables:

```sql
-- Cached Convex documents (one table per entity type)
CREATE TABLE cached_trips (
  id TEXT PRIMARY KEY,           -- Convex document _id
  data TEXT NOT NULL,            -- Full document as JSON
  updated_at INTEGER NOT NULL,   -- Local timestamp of last cache write
  synced_at INTEGER NOT NULL     -- Timestamp of last confirmed server sync
);

CREATE TABLE cached_bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT,                  -- For querying bookings by trip
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE cached_visa_guides (
  id TEXT PRIMARY KEY,
  country_code TEXT,             -- For querying by country
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE cached_trip_messages (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER NOT NULL
);

-- Offline mutation queue
CREATE TABLE mutation_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent TEXT NOT NULL,          -- JSON: {action, table, documentId, payload}
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | processing | completed | failed
  retry_count INTEGER DEFAULT 0,
  error TEXT                     -- Last error message if failed
);

-- Sync metadata
CREATE TABLE sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys: 'last_full_sync', 'last_precache_check', 'offline_since'
```

Exports:
- `initDatabase()` — create tables if not exist
- `cacheTrip(id, data)` / `getCachedTrip(id)` / `getAllCachedTrips()`
- `cacheBooking(id, tripId, data)` / `getCachedBookingsByTrip(tripId)` / `getAllCachedBookings()`
- `cacheVisaGuide(id, countryCode, data)` / `getCachedVisaGuide(id)` / `getCachedVisaGuideByCountry(code)`
- `cacheTripMessages(tripId, messages)` / `getCachedTripMessages(tripId)`
- `enqueueMutation(intent)` / `getPendingMutations()` / `markMutationCompleted(id)` / `markMutationFailed(id, error)`
- `getSyncMeta(key)` / `setSyncMeta(key, value)`
- `clearAllCache()` — for logout / debug

#### 2. Offline Provider — `contexts/offline-context.tsx`

A React context that wraps the app and manages connectivity state + sync lifecycle.

**Dependencies:** `@react-native-community/netinfo`

**State:**
- `isOffline: boolean` — current connectivity status
- `lastSyncTime: Date | null` — when data was last synced from server
- `pendingMutationCount: number` — queued mutations waiting to sync
- `isSyncing: boolean` — whether a sync is in progress

**Behavior:**
- On mount: initialize SQLite database, check connectivity, load sync meta
- On connectivity change (via NetInfo listener):
  - Online -> Offline: record `offline_since` timestamp, show toast "You're offline — cached data available"
  - Offline -> Online: trigger `replayMutationQueue()` then `refreshCache()`, show toast "Back online — syncing..."
- On app foreground (via AppState listener): check connectivity, trigger sync if online
- Exposes context value: `{isOffline, lastSyncTime, pendingMutationCount, isSyncing, forceSyncNow}`

#### 3. Custom Hooks — `hooks/use-offline-query.ts`

```typescript
function useOfflineQuery<T>(queryRef, args): T | undefined
```

**Behavior:**
- Calls Convex `useQuery(queryRef, args)` as normal
- When Convex returns data (online): write it to SQLite cache in background, return live data
- When Convex returns `undefined` AND we're offline: read from SQLite cache, return cached data
- Returns `undefined` only if both Convex and cache miss (should be rare)

**Cache key derivation:** Based on query reference name + serialized args. For example, `api.trips.getTrip({id: "abc"})` -> cache lookup by id "abc" in `cached_trips`.

The hook needs a mapping config that tells it which cache table and key to use for each query reference. This is a simple record:

```typescript
const QUERY_CACHE_MAP = {
  'trips:getTrip': { table: 'cached_trips', keyFrom: 'id' },
  'trips:listTrips': { table: 'cached_trips', type: 'list' },
  'bookings:listBookings': { table: 'cached_bookings', type: 'list' },
  'bookings:listBookingsByTrip': { table: 'cached_bookings', keyFrom: 'tripId', type: 'list' },
  'visaGuides:getGuide': { table: 'cached_visa_guides', keyFrom: 'id' },
  'visaGuides:listGuides': { table: 'cached_visa_guides', type: 'list' },
  'trips:getMessages': { table: 'cached_trip_messages', keyFrom: 'tripId', type: 'list' },
} as const;
```

#### 4. Offline Mutation Hook — `hooks/use-offline-mutation.ts`

```typescript
function useOfflineMutation(mutationRef): (args) => Promise<void>
```

**Behavior:**
- When online: call Convex mutation directly (existing behavior)
- When offline: store intent in mutation queue, apply optimistic update to SQLite cache, return immediately
- Intent format: `{action: string, table: string, documentId: string, payload: Record<string, unknown>, mutationRef: string}`

**Supported offline intents:**
- `updateVisaChecklist` — toggle checklist items in visa guides
- `updateTripStatus` — mark trip as completed/planned
- `updateBookingStatus` — update booking status
- `updateTripField` — update trip fields (notes, etc.)

Other mutations (create trip, delete trip, create booking) require online — these are complex operations that involve AI generation or cascading deletes.

#### 5. Sync Engine — `lib/offline/sync.ts`

**`replayMutationQueue()`**
- Get all pending mutations ordered by `created_at`
- For each: set status to `processing`, call Convex mutation, mark `completed` or `failed`
- Failed mutations: increment `retry_count`, retry up to 3 times with exponential backoff
- After 3 failures: mark as `failed`, surface to user via toast ("Some offline changes couldn't sync")

**`refreshCache()`**
- Fetch all trips, bookings, visa guides from Convex
- Upsert into SQLite cache tables
- Update `last_full_sync` in sync_meta
- Remove cached documents that no longer exist on server (user deleted while on another device)

**`syncOnReconnect()`**
- Called when going from offline -> online
- Order: `replayMutationQueue()` first, then `refreshCache()`
- Mutation replay must happen first so server has our offline changes before we pull latest state

#### 6. Pre-cache Scheduler — `lib/offline/precache.ts`

**`checkAndPrecache()`**
- Called on app foreground + every 6 hours (via a simple interval in OfflineProvider)
- Logic:
  1. Get all cached trips
  2. Find trips with `startDate` within 24 hours from now
  3. For each upcoming trip:
     - Ensure trip data is fully cached (all JSON fields populated)
     - Cache all linked bookings
     - Cache visa guide for the destination country (if exists)
     - Cache emergency info (this comes from static `data/localInfo.ts` — already bundled, no network needed)
  4. Update `last_precache_check` in sync_meta

**Pre-cache also triggers on:**
- Trip detail view (user opens a trip -> cache it immediately)
- After a new trip is created (cache the generated data)

#### 7. UI Components

**`OfflineIndicator` — `components/OfflineIndicator.tsx`**
- A small, non-intrusive bar/chip that appears when offline
- Shows: "Offline — last synced 2 hours ago"
- When syncing: "Syncing..." with a spinner
- When there are pending mutations: "Offline — 3 changes pending"
- Positioned at the top of the screen, below the status bar
- Tappable: shows a bottom sheet with sync details (last sync time, pending changes list, "Sync Now" button)

**Changes to existing screens:**
- Minimal. Replace `useQuery` with `useOfflineQuery` and `useMutation` with `useOfflineMutation` in:
  - `app/(tabs)/trips.tsx` — trip list
  - `app/(tabs)/guides.tsx` — visa guides list
  - `app/trip/[id].tsx` — trip detail
  - `app/guide/[id].tsx` — visa guide detail
  - `app/chat/[tripId].tsx` — trip messages (read-only when offline)

**Offline-specific UI behavior:**
- Chat screen: show "Chat unavailable offline" message, but display cached message history
- "Create Trip" button: disabled with tooltip "Requires internet connection"
- "Delete Trip" button: disabled when offline
- Checklist toggles, status changes, notes: work normally (queued)

## Data Flow Examples

### Example 1: User opens trip while online
1. `useOfflineQuery(api.trips.getTrip, {id})` calls Convex
2. Convex returns trip data
3. Hook writes data to `cached_trips` table in background
4. UI renders live data

### Example 2: User views trip while offline
1. `useOfflineQuery(api.trips.getTrip, {id})` calls Convex
2. Convex returns `undefined` (no connection)
3. Hook detects offline via OfflineProvider context
4. Hook reads from `cached_trips` where `id = ?`
5. UI renders cached data (identical experience)

### Example 3: User toggles visa checklist item while offline
1. `useOfflineMutation` detects offline
2. Stores intent: `{action: 'updateVisaChecklist', documentId: 'guide123', payload: {itemId: 'passport', checked: true}}`
3. Applies optimistic update to SQLite: reads cached guide, toggles item, writes back
4. UI updates immediately from cache
5. Later, on reconnect: intent replays as `api.visaGuides.updateChecklist` mutation

### Example 4: Pre-cache before departure
1. App foreground check runs at 6pm
2. Finds trip to Tokyo starting tomorrow at 10am (within 24hrs)
3. Fetches: full trip data, 4 linked bookings, Japan visa guide
4. Writes all to SQLite
5. User boards plane, loses connectivity
6. Opens app at Tokyo Narita — everything loads instantly from cache

## New Dependencies

- `expo-sqlite` — local SQLite database
- `@react-native-community/netinfo` — network connectivity detection

## Files to Create

```
lib/offline/database.ts          — SQLite schema + CRUD operations
lib/offline/sync.ts              — Sync engine (replay queue, refresh cache)
lib/offline/precache.ts          — Pre-cache scheduler
lib/offline/types.ts             — Shared types (MutationIntent, CacheEntry, etc.)
contexts/offline-context.tsx     — OfflineProvider context
hooks/use-offline-query.ts       — Offline-aware query hook
hooks/use-offline-mutation.ts    — Offline-aware mutation hook
components/OfflineIndicator.tsx  — Offline status UI component
```

## Files to Modify

```
app/_layout.tsx                  — Wrap app with OfflineProvider
app/(tabs)/trips.tsx             — Swap to useOfflineQuery/useOfflineMutation
app/(tabs)/guides.tsx            — Swap to useOfflineQuery
app/trip/[id].tsx                — Swap to useOfflineQuery/useOfflineMutation
app/guide/[id].tsx               — Swap to useOfflineQuery/useOfflineMutation
app/chat/[tripId].tsx            — Swap to useOfflineQuery (read-only offline)
package.json                     — Add expo-sqlite, @react-native-community/netinfo
```

## Out of Scope (for now)

- Offline map downloads (would need a map tile caching strategy — separate feature)
- Offline image caching (hero images, day images — could add with expo-image's built-in caching later)
- Full CRDT-based conflict resolution (deferred to collaboration feature)
- Offline trip creation (requires AI generation)
- Email/calendar sync while offline (requires OAuth + API calls)

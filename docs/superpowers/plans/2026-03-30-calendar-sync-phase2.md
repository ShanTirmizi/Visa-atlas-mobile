# Calendar Sync (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-import travel bookings from the user's device calendar (Apple Calendar via Expo Calendar API) by scanning for events from known travel providers, classifying them by booking type, and linking them to existing trips.

**Architecture:** On-device calendar access via `expo-calendar` (no server round-trip). A classification pipeline scores each event against known travel organizers, keywords, and location signals. High-confidence events auto-import as bookings; lower-confidence ones go to a "Review" list. A CalendarProvider context manages sync state via AsyncStorage. Connect/disconnect lives in the More tab settings.

**Tech Stack:** expo-calendar (Expo Calendar API for on-device access), AsyncStorage (sync state persistence), existing Convex bookings API, existing booking components from Phase 1.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `utils/calendarClassifier.ts` | **NEW** — Classification pipeline: known organizers, keywords, location signals, confidence scoring, booking type mapping |
| `utils/calendarSync.ts` | **NEW** — Orchestrator: fetch events, classify, dedup, create bookings, match to trips |
| `constants/calendarProviders.ts` | **NEW** — Curated lists of known travel organizer domains, keywords per booking type, confidence thresholds |
| `contexts/calendar-context.tsx` | **NEW** — CalendarProvider: sync state, connected status, last sync time, permissions |
| `app/(tabs)/more.tsx` | **MODIFY** — Add "Calendar" menu item + calendar settings section |
| `app/_layout.tsx` | **MODIFY** — Add CalendarProvider to provider stack |
| `components/booking/BookingsListView.tsx` | **MODIFY** — Add pull-to-refresh trigger, sync status indicator |
| `components/booking/CalendarReviewSheet.tsx` | **NEW** — Bottom sheet for reviewing low-confidence calendar imports |

---

### Task 1: Install expo-calendar dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install expo-calendar**

Run: `npx expo install expo-calendar`

Expected: `expo-calendar` added to package.json dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-calendar dependency"
```

---

### Task 2: Create known travel providers and classification constants

**Files:**
- Create: `constants/calendarProviders.ts`

- [ ] **Step 1: Create the calendar providers constants file**

Create `constants/calendarProviders.ts`:

```typescript
// Known travel booking organizer domains/emails
// Events from these organizers are high-confidence travel bookings
export const KNOWN_ORGANIZERS: Record<string, { type: BookingType; provider: string }> = {
  // Hotels
  'booking.com': { type: 'hotel', provider: 'Booking.com' },
  'hotels.com': { type: 'hotel', provider: 'Hotels.com' },
  'marriott.com': { type: 'hotel', provider: 'Marriott' },
  'hilton.com': { type: 'hotel', provider: 'Hilton' },
  'ihg.com': { type: 'hotel', provider: 'IHG' },
  'accor.com': { type: 'hotel', provider: 'Accor' },
  'hyatt.com': { type: 'hotel', provider: 'Hyatt' },
  'airbnb.com': { type: 'hotel', provider: 'Airbnb' },
  'vrbo.com': { type: 'hotel', provider: 'VRBO' },
  'hostelworld.com': { type: 'hotel', provider: 'Hostelworld' },

  // Flights
  'google.com/travel': { type: 'flight', provider: 'Google Flights' },
  'skyscanner.net': { type: 'flight', provider: 'Skyscanner' },
  'kayak.com': { type: 'flight', provider: 'Kayak' },
  'britishairways.com': { type: 'flight', provider: 'British Airways' },
  'emirates.com': { type: 'flight', provider: 'Emirates' },
  'ryanair.com': { type: 'flight', provider: 'Ryanair' },
  'easyjet.com': { type: 'flight', provider: 'easyJet' },
  'lufthansa.com': { type: 'flight', provider: 'Lufthansa' },
  'klm.com': { type: 'flight', provider: 'KLM' },
  'airfrance.com': { type: 'flight', provider: 'Air France' },
  'united.com': { type: 'flight', provider: 'United Airlines' },
  'delta.com': { type: 'flight', provider: 'Delta' },
  'aa.com': { type: 'flight', provider: 'American Airlines' },
  'qatarairways.com': { type: 'flight', provider: 'Qatar Airways' },
  'singaporeair.com': { type: 'flight', provider: 'Singapore Airlines' },

  // Experiences
  'getyourguide.com': { type: 'experience', provider: 'GetYourGuide' },
  'viator.com': { type: 'experience', provider: 'Viator' },
  'klook.com': { type: 'experience', provider: 'Klook' },

  // Car rental
  'hertz.com': { type: 'car_rental', provider: 'Hertz' },
  'avis.com': { type: 'car_rental', provider: 'Avis' },
  'europcar.com': { type: 'car_rental', provider: 'Europcar' },
  'enterprise.com': { type: 'car_rental', provider: 'Enterprise' },
  'sixt.com': { type: 'car_rental', provider: 'Sixt' },
  'turo.com': { type: 'car_rental', provider: 'Turo' },

  // Insurance
  'worldnomads.com': { type: 'insurance', provider: 'World Nomads' },
  'allianz-assistance.com': { type: 'insurance', provider: 'Allianz' },
  'axa.com': { type: 'insurance', provider: 'AXA' },

  // Restaurants
  'opentable.com': { type: 'restaurant', provider: 'OpenTable' },
  'thefork.com': { type: 'restaurant', provider: 'TheFork' },
  'resy.com': { type: 'restaurant', provider: 'Resy' },
};

import type { BookingType } from './bookings';

// Keywords that indicate travel-related events, grouped by booking type
export const TYPE_KEYWORDS: Record<BookingType, string[]> = {
  flight: [
    'flight', 'departing', 'arriving', 'departure', 'arrival',
    'boarding', 'gate', 'terminal', 'airline', 'airways',
    // Common airline codes in event titles
    'BA', 'EK', 'QR', 'SQ', 'LH', 'AF', 'UA', 'DL', 'AA', 'FR', 'U2',
  ],
  hotel: [
    'check-in', 'check-out', 'checkout', 'checkin',
    'hotel', 'resort', 'hostel', 'accommodation', 'room',
    'stay at', 'night at', 'booking confirmation',
  ],
  experience: [
    'tour', 'experience', 'activity', 'excursion', 'tickets',
    'guided', 'safari', 'diving', 'snorkeling', 'cooking class',
    'museum', 'entrance', 'admission',
  ],
  car_rental: [
    'car rental', 'car hire', 'pickup', 'pick-up', 'dropoff', 'drop-off',
    'rental car', 'vehicle', 'hertz', 'avis', 'europcar', 'sixt',
  ],
  insurance: [
    'travel insurance', 'policy', 'coverage', 'insured',
  ],
  restaurant: [
    'reservation', 'table for', 'dinner at', 'lunch at', 'brunch at',
    'restaurant', 'dining',
  ],
};

// Generic travel keywords (not type-specific but indicate travel)
export const GENERIC_TRAVEL_KEYWORDS: string[] = [
  'booking', 'reservation', 'confirmation', 'itinerary',
  'travel', 'trip', 'vacation', 'holiday',
];

// Confidence thresholds
export const CONFIDENCE = {
  AUTO_IMPORT: 0.7,   // Above this = auto-import
  REVIEW: 0.3,        // Between REVIEW and AUTO_IMPORT = show in review list
  // Below REVIEW = ignore
} as const;

// Scoring weights
export const SCORE_WEIGHTS = {
  KNOWN_ORGANIZER: 0.9,    // Known organizer match = almost certain
  TYPE_KEYWORD: 0.3,       // Type-specific keyword in title/description
  GENERIC_KEYWORD: 0.15,   // Generic travel keyword
  HAS_LOCATION: 0.1,       // Event has a location set
  MULTI_DAY: 0.05,         // Event spans multiple days (common for hotels)
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add constants/calendarProviders.ts
git commit -m "feat: add calendar provider constants and classification config"
```

---

### Task 3: Create the calendar classification pipeline

**Files:**
- Create: `utils/calendarClassifier.ts`

- [ ] **Step 1: Create the classifier**

Create `utils/calendarClassifier.ts`:

```typescript
import {
  KNOWN_ORGANIZERS,
  TYPE_KEYWORDS,
  GENERIC_TRAVEL_KEYWORDS,
  CONFIDENCE,
  SCORE_WEIGHTS,
} from '@/constants/calendarProviders';
import type { BookingType } from '@/constants/bookings';

export interface CalendarEvent {
  id: string;
  title: string;
  notes?: string;
  location?: string;
  startDate: string;  // ISO
  endDate: string;    // ISO
  organizer?: string; // email or name
  calendarId?: string;
}

export interface ClassifiedEvent {
  event: CalendarEvent;
  confidence: number;        // 0-1
  bookingType: BookingType;
  provider: string;          // detected provider name or 'Calendar'
  signals: string[];         // human-readable reasons for classification
}

/**
 * Classify a calendar event as a potential travel booking.
 * Returns null if confidence is below the review threshold.
 */
export function classifyEvent(event: CalendarEvent): ClassifiedEvent | null {
  let confidence = 0;
  let detectedType: BookingType | null = null;
  let provider = 'Calendar';
  const signals: string[] = [];

  const titleLower = (event.title || '').toLowerCase();
  const notesLower = (event.notes || '').toLowerCase();
  const organizerLower = (event.organizer || '').toLowerCase();
  const combined = `${titleLower} ${notesLower} ${organizerLower}`;

  // 1. Check known organizers
  for (const [domain, info] of Object.entries(KNOWN_ORGANIZERS)) {
    if (organizerLower.includes(domain) || combined.includes(domain)) {
      confidence += SCORE_WEIGHTS.KNOWN_ORGANIZER;
      detectedType = info.type;
      provider = info.provider;
      signals.push(`Known organizer: ${info.provider}`);
      break;
    }
  }

  // 2. Check type-specific keywords
  if (!detectedType) {
    let bestKeywordScore = 0;
    let bestType: BookingType | null = null;

    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [BookingType, string[]][]) {
      let typeScore = 0;
      for (const keyword of keywords) {
        if (combined.includes(keyword.toLowerCase())) {
          typeScore += SCORE_WEIGHTS.TYPE_KEYWORD;
          signals.push(`Keyword match: "${keyword}"`);
        }
      }
      if (typeScore > bestKeywordScore) {
        bestKeywordScore = typeScore;
        bestType = type;
      }
    }

    if (bestType) {
      confidence += Math.min(bestKeywordScore, 0.6); // Cap keyword contribution
      detectedType = bestType;
    }
  }

  // 3. Check generic travel keywords
  for (const keyword of GENERIC_TRAVEL_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      confidence += SCORE_WEIGHTS.GENERIC_KEYWORD;
      signals.push(`Generic keyword: "${keyword}"`);
      break; // Only count once
    }
  }

  // 4. Has location
  if (event.location && event.location.trim().length > 0) {
    confidence += SCORE_WEIGHTS.HAS_LOCATION;
    signals.push('Has location');
  }

  // 5. Multi-day event
  if (event.startDate !== event.endDate) {
    const start = new Date(event.startDate).getTime();
    const end = new Date(event.endDate).getTime();
    const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 1) {
      confidence += SCORE_WEIGHTS.MULTI_DAY;
      signals.push(`Multi-day (${Math.round(daysDiff)} days)`);
    }
  }

  // Cap at 1.0
  confidence = Math.min(confidence, 1.0);

  // Below review threshold = not travel
  if (confidence < CONFIDENCE.REVIEW || !detectedType) {
    return null;
  }

  return {
    event,
    confidence,
    bookingType: detectedType,
    provider,
    signals,
  };
}

/**
 * Batch classify events and split into auto-import and review lists.
 */
export function classifyEvents(events: CalendarEvent[]): {
  autoImport: ClassifiedEvent[];
  review: ClassifiedEvent[];
} {
  const autoImport: ClassifiedEvent[] = [];
  const review: ClassifiedEvent[] = [];

  for (const event of events) {
    const result = classifyEvent(event);
    if (!result) continue;

    if (result.confidence >= CONFIDENCE.AUTO_IMPORT) {
      autoImport.push(result);
    } else {
      review.push(result);
    }
  }

  // Sort by confidence descending
  autoImport.sort((a, b) => b.confidence - a.confidence);
  review.sort((a, b) => b.confidence - a.confidence);

  return { autoImport, review };
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/calendarClassifier.ts
git commit -m "feat: add calendar event classification pipeline"
```

---

### Task 4: Create the calendar sync orchestrator

**Files:**
- Create: `utils/calendarSync.ts`

- [ ] **Step 1: Create the sync orchestrator**

Create `utils/calendarSync.ts`:

```typescript
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { classifyEvents, type CalendarEvent, type ClassifiedEvent } from './calendarClassifier';
import { findMatchingTrip } from './tripMatcher';

export interface SyncResult {
  imported: number;
  forReview: ClassifiedEvent[];
  skipped: number;
  error?: string;
}

/**
 * Request calendar permissions.
 * Returns true if granted.
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if calendar permission is already granted.
 */
export async function hasCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Fetch calendar events from the last 30 days to 12 months ahead.
 */
async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Use all calendars (user can't pick specific ones in v1)
  const calendarIds = calendars.map((c) => c.id);
  if (calendarIds.length === 0) return [];

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30); // 30 days ago
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 12); // 12 months ahead

  const events = await Calendar.getEventsAsync(
    calendarIds,
    startDate,
    endDate
  );

  return events.map((e) => ({
    id: e.id,
    title: e.title || '',
    notes: e.notes || undefined,
    location: e.location || undefined,
    startDate: e.startDate
      ? new Date(e.startDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    endDate: e.endDate
      ? new Date(e.endDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    organizer: e.organizerEmail || undefined,
  }));
}

/**
 * Run the full calendar sync pipeline:
 * 1. Fetch events from device calendar
 * 2. Classify each event
 * 3. Deduplicate against existing bookings
 * 4. Auto-import high-confidence events
 * 5. Return review list for lower-confidence events
 */
export async function runCalendarSync(
  existingCalendarEventIds: Set<string>,
  createBookingFn: (args: any) => Promise<any>,
  linkBookingFn: (args: any) => Promise<void>,
  trips: any[]
): Promise<SyncResult> {
  try {
    // 1. Fetch
    const events = await fetchCalendarEvents();

    // 2. Dedup — skip events we've already imported
    const newEvents = events.filter((e) => !existingCalendarEventIds.has(e.id));

    // 3. Classify
    const { autoImport, review } = classifyEvents(newEvents);

    // 4. Auto-import high confidence
    let imported = 0;
    for (const classified of autoImport) {
      const { event, bookingType, provider } = classified;

      const bookingId = await createBookingFn({
        type: bookingType,
        source: 'calendar',
        provider,
        status: 'upcoming',
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate !== event.startDate ? event.endDate : undefined,
        location: event.location || undefined,
        calendarEventId: event.id,
        calendarSource: Platform.OS === 'ios' ? 'apple' : 'google',
      });

      // Try to match to a trip
      if (trips.length > 0) {
        const match = findMatchingTrip(
          undefined, // No countryCode from calendar events
          event.startDate,
          event.endDate,
          trips
        );
        if (match && match.confidence === 'high') {
          await linkBookingFn({
            id: bookingId,
            tripId: match.tripId,
            autoMatched: true,
          });
        }
      }

      imported++;
    }

    return {
      imported,
      forReview: review,
      skipped: events.length - newEvents.length,
    };
  } catch (error: any) {
    return {
      imported: 0,
      forReview: [],
      skipped: 0,
      error: error.message || 'Calendar sync failed',
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/calendarSync.ts
git commit -m "feat: add calendar sync orchestrator"
```

---

### Task 5: Create the CalendarProvider context

**Files:**
- Create: `contexts/calendar-context.tsx`

- [ ] **Step 1: Create the context provider**

Create `contexts/calendar-context.tsx`:

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { hasCalendarPermission, requestCalendarPermission, runCalendarSync, type SyncResult } from '@/utils/calendarSync';
import type { ClassifiedEvent } from '@/utils/calendarClassifier';

const STORAGE_KEYS = {
  CONNECTED: '@visa_atlas_calendar_connected',
  LAST_SYNC: '@visa_atlas_calendar_last_sync',
};

interface CalendarContextValue {
  isConnected: boolean;
  lastSyncTime: string | null;
  isSyncing: boolean;
  reviewItems: ClassifiedEvent[];
  lastSyncResult: SyncResult | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
  clearReviewItems: () => void;
  loaded: boolean;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reviewItems, setReviewItems] = useState<ClassifiedEvent[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  const createBooking = useMutation(api.bookings.createBooking);
  const linkBooking = useMutation(api.bookings.linkBookingToTrip);
  const bookings = useQuery(api.bookings.listBookings);
  const trips = useQuery(api.trips.listTrips);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [connected, syncTime] = await AsyncStorage.multiGet([
          STORAGE_KEYS.CONNECTED,
          STORAGE_KEYS.LAST_SYNC,
        ]);
        setIsConnected(connected[1] === 'true');
        setLastSyncTime(syncTime[1]);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Auto-sync on app open if connected and last sync > 24h ago
  useEffect(() => {
    if (!loaded || !isConnected || !bookings || !trips) return;

    if (lastSyncTime) {
      const hoursSinceSync = (Date.now() - new Date(lastSyncTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync < 24) return;
    }

    // Trigger auto-sync
    sync();
  }, [loaded, isConnected, bookings !== undefined, trips !== undefined]);

  const connect = useCallback(async (): Promise<boolean> => {
    const granted = await requestCalendarPermission();
    if (granted) {
      setIsConnected(true);
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED, 'true');
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(async () => {
    setIsConnected(false);
    setLastSyncTime(null);
    setReviewItems([]);
    setLastSyncResult(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.CONNECTED, STORAGE_KEYS.LAST_SYNC]);
  }, []);

  const sync = useCallback(async () => {
    if (isSyncing || !isConnected || !bookings || !trips) return;

    const hasPermission = await hasCalendarPermission();
    if (!hasPermission) {
      setIsConnected(false);
      await AsyncStorage.setItem(STORAGE_KEYS.CONNECTED, 'false');
      return;
    }

    setIsSyncing(true);

    // Build set of existing calendar event IDs for dedup
    const existingIds = new Set<string>();
    for (const b of bookings) {
      if (b.calendarEventId) {
        existingIds.add(b.calendarEventId);
      }
    }

    const result = await runCalendarSync(
      existingIds,
      createBooking,
      linkBooking,
      trips as any[]
    );

    const now = new Date().toISOString();
    setLastSyncTime(now);
    setLastSyncResult(result);
    setReviewItems(result.forReview);
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now);

    setIsSyncing(false);
  }, [isSyncing, isConnected, bookings, trips, createBooking, linkBooking]);

  const clearReviewItems = useCallback(() => {
    setReviewItems([]);
  }, []);

  const value = useMemo(
    () => ({
      isConnected,
      lastSyncTime,
      isSyncing,
      reviewItems,
      lastSyncResult,
      connect,
      disconnect,
      sync,
      clearReviewItems,
      loaded,
    }),
    [isConnected, lastSyncTime, isSyncing, reviewItems, lastSyncResult, connect, disconnect, sync, clearReviewItems, loaded]
  );

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add contexts/calendar-context.tsx
git commit -m "feat: add CalendarProvider context for sync state"
```

---

### Task 6: Add CalendarProvider to the app layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Read the current layout file**

Read `app/_layout.tsx` to see the provider stack.

- [ ] **Step 2: Add the CalendarProvider import and wrap**

Add import:
```typescript
import { CalendarProvider } from '@/contexts/calendar-context';
```

Add `<CalendarProvider>` inside the provider stack, after `<VisaProvider>` and before `<SafeAreaProvider>` (or wherever makes sense given the existing nesting):

```tsx
<VisaProvider>
  <CalendarProvider>
    {/* ...existing providers... */}
  </CalendarProvider>
</VisaProvider>
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add CalendarProvider to app layout"
```

---

### Task 7: Add Calendar section to More screen

**Files:**
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Read the current more.tsx file**

Read the full file to understand current structure.

- [ ] **Step 2: Add calendar imports and section**

Add to imports:
```typescript
import { Calendar as CalendarIcon, RefreshCw, Unlink } from 'lucide-react-native';
import { useCalendar } from '@/contexts/calendar-context';
```

Add to the Section type:
```typescript
type Section = 'main' | 'visas' | 'favorites' | 'visited' | 'settings' | 'calendar';
```

Add the `useCalendar` hook inside the component:
```typescript
const { isConnected, lastSyncTime, isSyncing, sync, connect, disconnect } = useCalendar();
```

- [ ] **Step 3: Add calendar menu item to renderMain**

Add a new menu item to the `menuItems` array, after 'visited' and before 'settings':

```typescript
{
  key: 'calendar' as Section,
  label: 'Calendar Sync',
  subtitle: isConnected
    ? `Last sync: ${lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Never'}`
    : 'Connect your calendar',
  icon: <CalendarIcon color="#FFFFFF" size={22} />,
  tint: colors.info,
},
```

Add a `formatRelativeTime` helper at the top of the file:
```typescript
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 4: Add renderCalendar section**

Add a new render function similar to the existing section patterns:

```tsx
const renderCalendar = () => (
  <View style={styles.sectionContent}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => setActiveSection('main')}
      hitSlop={12}
    >
      <ArrowLeft color={colors.foreground} size={20} />
    </TouchableOpacity>

    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
      Calendar Sync
    </Text>
    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
      Import travel bookings from your device calendar automatically.
    </Text>

    {!isConnected ? (
      // Not connected — show connect button
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.primary, borderWidth: 0 }]}
        onPress={async () => {
          const granted = await connect();
          if (!granted) {
            Alert.alert(
              'Permission Required',
              'Calendar access is needed to import your bookings. Please enable it in Settings.',
            );
          }
        }}
      >
        <View style={styles.settingInfo}>
          <CalendarIcon color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Connect Calendar
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>
    ) : (
      // Connected — show sync controls
      <>
        {/* Sync now button */}
        <TouchableOpacity
          style={[
            styles.settingRow,
            { backgroundColor: colors.primary, borderWidth: 0, opacity: isSyncing ? 0.6 : 1 },
          ]}
          onPress={() => sync()}
          disabled={isSyncing}
        >
          <View style={styles.settingInfo}>
            <RefreshCw color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </View>
          {lastSyncTime && (
            <Text style={[styles.settingValue, { color: 'rgba(255,255,255,0.70)' }]}>
              {formatRelativeTime(lastSyncTime)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Disconnect button */}
        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.danger, borderWidth: 0 }]}
          onPress={() => {
            Alert.alert(
              'Disconnect Calendar',
              'This will stop syncing new bookings from your calendar. Existing imported bookings will remain.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Disconnect',
                  style: 'destructive',
                  onPress: () => disconnect(),
                },
              ],
            );
          }}
        >
          <View style={styles.settingInfo}>
            <Unlink color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              Disconnect Calendar
            </Text>
          </View>
          <ChevronRight color="#FFFFFF" size={18} />
        </TouchableOpacity>
      </>
    )}
  </View>
);
```

- [ ] **Step 5: Add the calendar section to the render switch**

In the return block, add after the settings conditional:
```tsx
{activeSection === 'calendar' && renderCalendar()}
```

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/more.tsx
git commit -m "feat: add calendar sync section to More screen"
```

---

### Task 8: Create the Calendar Review bottom sheet

**Files:**
- Create: `components/booking/CalendarReviewSheet.tsx`

- [ ] **Step 1: Create the review sheet**

Create `components/booking/CalendarReviewSheet.tsx`:

```tsx
import React, { useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { BottomSheetModal, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Check, X } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Platform } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPES, type BookingType, getBookingColor, formatBookingDates } from '@/constants/bookings';
import type { ClassifiedEvent } from '@/utils/calendarClassifier';

export interface CalendarReviewSheetRef {
  open: (items: ClassifiedEvent[]) => void;
  close: () => void;
}

interface CalendarReviewSheetProps {
  onComplete?: () => void;
}

const CalendarReviewSheet = forwardRef<CalendarReviewSheetRef, CalendarReviewSheetProps>(
  ({ onComplete }, ref) => {
    const { colors, isDark } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [items, setItems] = useState<ClassifiedEvent[]>([]);
    const createBooking = useMutation(api.bookings.createBooking);

    useImperativeHandle(ref, () => ({
      open: (reviewItems: ClassifiedEvent[]) => {
        setItems(reviewItems);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    const handleAccept = useCallback(
      async (classified: ClassifiedEvent) => {
        const { event, bookingType, provider } = classified;
        await createBooking({
          type: bookingType,
          source: 'calendar' as const,
          provider,
          status: 'upcoming' as const,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate !== event.startDate ? event.endDate : undefined,
          location: event.location || undefined,
          calendarEventId: event.id,
          calendarSource: Platform.OS === 'ios' ? ('apple' as const) : ('google' as const),
        });
        setItems((prev) => prev.filter((i) => i.event.id !== event.id));
      },
      [createBooking]
    );

    const handleDismiss = useCallback((eventId: string) => {
      setItems((prev) => prev.filter((i) => i.event.id !== eventId));
    }, []);

    const renderItem = useCallback(
      ({ item }: { item: ClassifiedEvent }) => {
        const config = BOOKING_TYPES[item.bookingType];
        const typeColor = getBookingColor(item.bookingType, isDark);
        const Icon = config.icon;
        const confidencePct = Math.round(item.confidence * 100);

        return (
          <View
            style={[
              styles.reviewCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: typeColor + '18' }]}>
                <Icon color={typeColor} size={18} />
              </View>
              <View style={styles.cardContent}>
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.event.title}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {formatBookingDates(item.event.startDate, item.event.endDate)}
                  {item.event.location ? ` \u00B7 ${item.event.location}` : ''}
                </Text>
                <Text style={[styles.cardSignals, { color: colors.textMuted }]}>
                  {item.signals.slice(0, 2).join(' \u00B7 ')} \u00B7 {confidencePct}%
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() => handleAccept(item)}
                style={[styles.actionBtn, { backgroundColor: colors.secondary + '18' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Check color={colors.secondary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDismiss(item.event.id)}
                style={[styles.actionBtn, { backgroundColor: colors.danger + '18' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={colors.danger} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        );
      },
      [colors, isDark, handleAccept, handleDismiss]
    );

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['70%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onDismiss={() => {
          onComplete?.();
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Review Imports
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {items.length} event{items.length !== 1 ? 's' : ''} might be travel bookings
          </Text>
        </View>

        <BottomSheetFlatList
          data={items}
          keyExtractor={(item) => item.event.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                All caught up! No events to review.
              </Text>
            </View>
          }
        />
      </BottomSheetModal>
    );
  }
);

CalendarReviewSheet.displayName = 'CalendarReviewSheet';
export default CalendarReviewSheet;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: 10,
  },
  reviewCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  cardSignals: {
    fontFamily: FontFamily.condensed,
    fontSize: 10,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/CalendarReviewSheet.tsx
git commit -m "feat: add CalendarReviewSheet for reviewing low-confidence imports"
```

---

### Task 9: Add pull-to-refresh and sync status to BookingsListView

**Files:**
- Modify: `components/booking/BookingsListView.tsx`

- [ ] **Step 1: Read the current file**

Read `components/booking/BookingsListView.tsx` to see its current structure.

- [ ] **Step 2: Add calendar imports and hook**

Add imports:
```typescript
import { RefreshControl } from 'react-native';
import { useCalendar } from '@/contexts/calendar-context';
import CalendarReviewSheet, { type CalendarReviewSheetRef } from './CalendarReviewSheet';
```

Add inside the component:
```typescript
const { isConnected, isSyncing, sync, reviewItems, clearReviewItems } = useCalendar();
const reviewSheetRef = useRef<CalendarReviewSheetRef>(null);
```

- [ ] **Step 3: Add pull-to-refresh to the FlatList**

Add `refreshControl` prop to the FlatList in the main list section:
```tsx
<FlatList
  ...existing props...
  refreshControl={
    isConnected ? (
      <RefreshControl
        refreshing={isSyncing}
        onRefresh={() => sync()}
        tintColor={colors.primary}
      />
    ) : undefined
  }
/>
```

- [ ] **Step 4: Add review banner and sheet**

Add a review banner above the FlatList (after the unassigned inbox banner in ListHeaderComponent) when reviewItems exist:

```tsx
{reviewItems.length > 0 && (
  <TouchableOpacity
    onPress={() => reviewSheetRef.current?.open(reviewItems)}
    style={[styles.reviewBanner, { backgroundColor: colors.info + '15' }]}
  >
    <Text style={[styles.reviewBannerText, { color: colors.info }]}>
      {reviewItems.length} calendar event{reviewItems.length !== 1 ? 's' : ''} to review
    </Text>
  </TouchableOpacity>
)}
```

Add the CalendarReviewSheet at the bottom alongside the other sheets:
```tsx
<CalendarReviewSheet ref={reviewSheetRef} onComplete={clearReviewItems} />
```

Add the style:
```typescript
reviewBanner: {
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.sm,
  borderRadius: Radius.sm,
  marginBottom: Spacing.sm,
},
reviewBannerText: {
  fontFamily: FontFamily.condensedSemibold,
  fontSize: FontSize.sm,
},
```

- [ ] **Step 5: Commit**

```bash
git add components/booking/BookingsListView.tsx
git commit -m "feat: add pull-to-refresh and calendar review to BookingsListView"
```

---

### Task 10: Verify everything compiles and works

**Files:** None (testing only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No new errors (only the pre-existing chat/[tripId] serifItalic error if any).

- [ ] **Step 2: Fix any import or type errors**

Address any TypeScript errors that surface from the new code.

- [ ] **Step 3: Test the calendar flow manually**

1. Open app → More tab → verify "Calendar Sync" menu item appears
2. Tap it → verify "Connect Calendar" button shows
3. Tap connect → verify permission prompt appears
4. After granting → verify "Sync Now" and "Disconnect" buttons appear
5. Tap "Sync Now" → verify sync runs (may import events or show "review" banner)
6. Go to Trips → Bookings → pull to refresh → verify sync triggers
7. If review items exist → verify review sheet opens with accept/dismiss actions

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during calendar sync e2e testing"
```

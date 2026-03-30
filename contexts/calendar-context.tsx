import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  hasCalendarPermission,
  requestCalendarPermission,
  runCalendarSync,
  type SyncResult,
} from '@/utils/calendarSync';
import type { ClassifiedEvent } from '@/utils/calendarClassifier';

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────

const KEYS = {
  connected: '@visa_atlas_calendar_connected',
  lastSync: '@visa_atlas_calendar_last_sync',
} as const;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const CalendarContext = createContext<CalendarContextValue | undefined>(
  undefined,
);

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reviewItems, setReviewItems] = useState<ClassifiedEvent[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  const autoSyncFired = useRef(false);

  // ── Convex hooks ──

  const createBooking = useMutation(api.bookings.createBooking);
  const linkBooking = useMutation(api.bookings.linkBookingToTrip);
  const bookings = useQuery(api.bookings.listBookings);
  const trips = useQuery(api.trips.listTrips);

  // ── Load persisted state on mount ──

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEYS.connected),
      AsyncStorage.getItem(KEYS.lastSync),
    ]).then(([connectedRaw, lastSyncRaw]) => {
      setIsConnected(connectedRaw === 'true');
      setLastSyncTime(lastSyncRaw);
      setLoaded(true);
    });
  }, []);

  // ── sync() ──

  const sync = useCallback(async () => {
    if (isSyncing || !isConnected) return;
    if (bookings === undefined || trips === undefined) return;

    const permitted = await hasCalendarPermission();
    if (!permitted) {
      setIsConnected(false);
      await AsyncStorage.setItem(KEYS.connected, 'false');
      return;
    }

    setIsSyncing(true);
    try {
      // Build set of existing calendar event IDs from bookings
      const existingCalendarEventIds = new Set<string>();
      for (const booking of bookings) {
        if (booking.calendarEventId) {
          existingCalendarEventIds.add(booking.calendarEventId);
        }
      }

      const result = await runCalendarSync(
        existingCalendarEventIds,
        (data) => createBooking(data as any),
        (bookingId, tripId) =>
          linkBooking({ id: bookingId as any, tripId: tripId as any }),
        trips,
      );

      const now = new Date().toISOString();
      setLastSyncTime(now);
      setLastSyncResult(result);
      setReviewItems(result.forReview);
      await AsyncStorage.setItem(KEYS.lastSync, now);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isConnected, bookings, trips, createBooking, linkBooking]);

  // ── Auto-sync effect ──

  useEffect(() => {
    if (!loaded || !isConnected) return;
    if (bookings === undefined || trips === undefined) return;
    if (autoSyncFired.current) return;

    const shouldSync =
      lastSyncTime === null ||
      Date.now() - new Date(lastSyncTime).getTime() > TWENTY_FOUR_HOURS_MS;

    if (shouldSync) {
      autoSyncFired.current = true;
      sync();
    }
  }, [loaded, isConnected, bookings, trips, lastSyncTime, sync]);

  // ── connect() ──

  const connect = useCallback(async (): Promise<boolean> => {
    const granted = await requestCalendarPermission();
    if (granted) {
      setIsConnected(true);
      await AsyncStorage.setItem(KEYS.connected, 'true');
    }
    return granted;
  }, []);

  // ── disconnect() ──

  const disconnect = useCallback(async () => {
    setIsConnected(false);
    setLastSyncTime(null);
    setReviewItems([]);
    setLastSyncResult(null);
    await AsyncStorage.multiRemove([KEYS.connected, KEYS.lastSync]);
  }, []);

  // ── clearReviewItems() ──

  const clearReviewItems = useCallback(() => {
    setReviewItems([]);
  }, []);

  // ── Memoized value ──

  const value = useMemo<CalendarContextValue>(
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
    [
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
    ],
  );

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  );
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
}

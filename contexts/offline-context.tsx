// contexts/offline-context.tsx
// Manages connectivity state and SQLite sync lifecycle for the whole app.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useConvex, useConvexAuth } from 'convex/react';
import { initDatabase, getPendingMutationCount, getSyncMeta } from '@/lib/offline/database';
import { syncOnReconnect, refreshCache } from '@/lib/offline/sync';
import { shouldRunPrecache, precacheUpcomingTrips } from '@/lib/offline/precache';
import type { OfflineContextValue } from '@/lib/offline/types';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  lastSyncTime: null,
  pendingMutationCount: 0,
  isSyncing: false,
  forceSyncNow: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OfflineProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = useConvex();
  const { isAuthenticated } = useConvexAuth();
  // Mirror onto a ref so the long-lived effects below read the latest auth
  // state without forcing a re-subscribe each time it flips.
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track previous offline state so we can detect offline→online transitions.
  const wasOfflineRef = useRef(false);

  // Keep a ref to isSyncing so callbacks that close over stale state can still
  // read the latest value without needing to be re-created.
  const isSyncingRef = useRef(false);
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Keep a ref to isOffline for the same reason.
  const isOfflineRef = useRef(false);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  // ---------------------------------------------------------------------------
  // Internal: refreshPendingCount
  // ---------------------------------------------------------------------------

  const refreshPendingCount = useCallback(async (): Promise<void> => {
    const count = await getPendingMutationCount();
    setPendingMutationCount(count);
  }, []);

  // ---------------------------------------------------------------------------
  // Internal: performSync
  // ---------------------------------------------------------------------------

  const performSync = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) return;
    if (!isAuthenticatedRef.current) return; // skip sync when signed out
    setIsSyncing(true);
    isSyncingRef.current = true;
    try {
      await syncOnReconnect(client);
      setLastSyncTime(new Date());
      await refreshPendingCount();
    } catch (err) {
      console.warn('[OfflineProvider] performSync failed:', err);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [client, refreshPendingCount]);

  // ---------------------------------------------------------------------------
  // Internal: performCacheRefresh
  // ---------------------------------------------------------------------------

  const performCacheRefresh = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) return;
    if (!isAuthenticatedRef.current) return; // skip refresh when signed out
    // Deliberately do NOT call setIsSyncing(true) — this refresh runs
    // silently on app foreground (and on initial post-auth load), and
    // flashing the OfflineIndicator on every resume caused a visible
    // layout jump (the banner mounted/unmounted in the regular flow,
    // pushing content ~30px down then back up). Apple Mail / Linear
    // do these routine refreshes silently; the indicator should only
    // appear for user-initiated syncs and offline→online transitions.
    isSyncingRef.current = true;
    try {
      await refreshCache(client);
      setLastSyncTime(new Date());
    } catch (err) {
      console.warn('[OfflineProvider] performCacheRefresh failed:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [client]);

  // ---------------------------------------------------------------------------
  // Exported: forceSyncNow
  // ---------------------------------------------------------------------------

  const forceSyncNow = useCallback(async (): Promise<void> => {
    if (isOfflineRef.current) return;
    await performSync();
  }, [performSync]);

  // ---------------------------------------------------------------------------
  // On mount: init database, load persisted state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      await initDatabase();

      // Load last_full_sync from sync_meta.
      const raw = await getSyncMeta('last_full_sync');
      if (raw !== null && !cancelled) {
        const ts = Number(raw);
        if (!Number.isNaN(ts)) {
          setLastSyncTime(new Date(ts));
        }
      }

      // Load pending mutation count.
      await refreshPendingCount();

      if (!cancelled) {
        setIsInitialized(true);
      }
    }

    init().catch((err) => {
      console.warn('[OfflineProvider] init failed:', err);
      if (!cancelled) setIsInitialized(true); // still proceed so app is usable
    });

    return () => {
      cancelled = true;
    };
  }, [refreshPendingCount]);

  // ---------------------------------------------------------------------------
  // After init: connectivity listener
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      isOfflineRef.current = offline;

      const wasOffline = wasOfflineRef.current;
      wasOfflineRef.current = offline;

      // Trigger sync when transitioning from offline → online.
      if (wasOffline && !offline) {
        performSync().catch((err) => {
          console.warn('[OfflineProvider] sync on reconnect failed:', err);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isInitialized, performSync]);

  // ---------------------------------------------------------------------------
  // After init: AppState foreground listener
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          nextState === 'active'
          && !isOfflineRef.current
          && isAuthenticatedRef.current
        ) {
          performCacheRefresh().catch((err) => {
            console.warn('[OfflineProvider] foreground cache refresh failed:', err);
          });

          shouldRunPrecache()
            .then((should) => {
              if (should && !isOfflineRef.current && isAuthenticatedRef.current) {
                return precacheUpcomingTrips(client);
              }
              return Promise.resolve(0);
            })
            .catch((err) => {
              console.warn('[OfflineProvider] foreground precache failed:', err);
            });
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isInitialized, client, performCacheRefresh]);

  // ---------------------------------------------------------------------------
  // After init: initial sync when coming online
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized || isOffline) return;
    if (!isAuthenticated) return; // skip initial sync until user signs in

    performCacheRefresh().catch((err) => {
      console.warn('[OfflineProvider] initial cache refresh failed:', err);
    });

    precacheUpcomingTrips(client).catch((err) => {
      console.warn('[OfflineProvider] initial precache failed:', err);
    });
    // Re-run when auth state flips so post-sign-in we kick off the first
    // cache refresh + precache. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // After init: 6-hour precache interval
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized) return;

    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

    const intervalId = setInterval(() => {
      if (isOfflineRef.current) return;

      shouldRunPrecache()
        .then((should) => {
          if (should && !isOfflineRef.current) {
            return precacheUpcomingTrips(client);
          }
          return Promise.resolve(0);
        })
        .catch((err) => {
          console.warn('[OfflineProvider] interval precache failed:', err);
        });
    }, SIX_HOURS_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isInitialized, client]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const value: OfflineContextValue = {
    isOffline,
    lastSyncTime,
    pendingMutationCount,
    isSyncing,
    forceSyncNow,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

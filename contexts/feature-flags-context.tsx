// contexts/feature-flags-context.tsx
//
// Remote feature flags, resolved from Convex and cached locally.
//
// Resolution order, highest priority first:
//   1. Live Convex subscription (featureFlags:getFlags) — a dashboard toggle
//      propagates to every running app on the next websocket tick.
//   2. Last-known values persisted to AsyncStorage — so a cold start (or an
//      offline launch) shows the same state the user saw last time instead of
//      snapping back to the shipped default and popping the UI a beat later.
//   3. REMOTE_FLAG_DEFAULTS from constants/featureFlags.ts — the safe state
//      for a device that has never resolved the flag.
//
// Mirrors how Firebase Remote Config / LaunchDarkly clients behave: serve the
// cached value immediately, reconcile in the background, never block a render.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  REMOTE_FLAG_DEFAULTS,
  type RemoteFlagKey,
} from '@/constants/featureFlags';

type FlagMap = Record<RemoteFlagKey, boolean>;

const STORAGE_KEY = '@visa_atlas_feature_flags';

/** Keeps only keys this build knows about, so a flag removed server-side (or
 *  a stale cache entry) can't widen the record beyond RemoteFlagKey. */
function coerceFlags(raw: unknown): Partial<FlagMap> {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const out: Partial<FlagMap> = {};
  for (const key of Object.keys(REMOTE_FLAG_DEFAULTS) as RemoteFlagKey[]) {
    if (typeof source[key] === 'boolean') out[key] = source[key] as boolean;
  }
  return out;
}

interface FeatureFlagsValue {
  flags: FlagMap;
  /** False until the first live or cached value has been resolved. Screens
   *  that would otherwise flash a gated route can wait on this. */
  isReady: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsValue>({
  flags: { ...REMOTE_FLAG_DEFAULTS },
  isReady: false,
});

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth();

  // Cached snapshot — read once at mount, refreshed on every live response.
  const [cached, setCached] = useState<Partial<FlagMap> | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            setCached(coerceFlags(JSON.parse(raw) as unknown));
          } catch {
            // Corrupt cache — fall through to defaults.
          }
        }
      })
      .catch(() => {
        // Cache reads are best-effort; defaults cover us.
      })
      .finally(() => {
        if (!cancelled) setCacheLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // getFlags calls requireAuth (CLAUDE.md: every public function does), so
  // skip while signed out rather than firing a query that throws.
  const live = useQuery(api.featureFlags.getFlags, isAuthenticated ? {} : 'skip');

  // Persist each live response so the next cold start opens in the right state.
  useEffect(() => {
    if (live === undefined) return;
    const next = coerceFlags(live);
    setCached(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Non-fatal: we just lose the head start on the next launch.
    });
  }, [live]);

  const value = useMemo<FeatureFlagsValue>(() => {
    const resolvedLive = live === undefined ? {} : coerceFlags(live);
    return {
      flags: { ...REMOTE_FLAG_DEFAULTS, ...(cached ?? {}), ...resolvedLive },
      // Signed-out users never get a live response — the cache read alone
      // settles them, otherwise isReady would hang false forever.
      isReady: cacheLoaded && (live !== undefined || !isAuthenticated),
    };
  }, [live, cached, cacheLoaded, isAuthenticated]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/** All resolved flags plus `isReady`. Most callers want useFeatureFlag. */
export function useFeatureFlags(): FeatureFlagsValue {
  return useContext(FeatureFlagsContext);
}

/** One flag's current value. Re-renders when the backend toggles it. */
export function useFeatureFlag(key: RemoteFlagKey): boolean {
  return useContext(FeatureFlagsContext).flags[key];
}

/**
 * Route-level gate for a whole screen. Hiding the entry card isn't enough —
 * a deep link, a notification, or a back-stack entry left over from before
 * the flag flipped can still land on the route. Bounces to the Trips tab
 * once flags have resolved, so a genuinely-enabled feature never flickers.
 *
 * Returns whether the route may render; callers should render null (not a
 * partial screen) while it's false.
 */
export function useFeatureRouteGuard(key: RemoteFlagKey): boolean {
  const { flags, isReady } = useFeatureFlags();
  const router = useRouter();
  const enabled = flags[key];

  useEffect(() => {
    if (!isReady || enabled) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/trips');
  }, [isReady, enabled, router]);

  return enabled;
}

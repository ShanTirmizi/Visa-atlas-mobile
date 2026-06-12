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
import { useConvexAuth, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { type CountryVisa } from '@/data/visaData';

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────

const KEYS = {
  heldVisas: '@visa_atlas_held_visas',
  favorites: '@visa_atlas_favorites',
  visited: '@visa_atlas_visited',
  expiryDates: '@visa_atlas_expiry_dates',
  passports: '@visa_atlas_passports',
  visaMap: '@visa_atlas_visa_map',
  onboarded: '@visa_atlas_onboarded',
  residence: '@visa_atlas_residence',
  // Last server `updatedAt` this device has observed (pushed or hydrated).
  // Drives the multi-device conflict check in the push effect.
  lastSyncedAt: '@visa_atlas_last_synced_at',
} as const;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ExpiryDate {
  countryCode: string;
  date: string; // ISO date string
}

// TODO(convex-contract): a concurrent convex change is adding optional
// `favorites` / `visited` (string[] of country codes) and `expiryDates`
// (JSON-string Record<countryCode, ISO date>) to the visaProfiles table
// AND to saveVisaProfile's args. The table fields have landed in
// convex/schema.ts; until convex/visaProfiles.ts + the generated types
// catch up, this alias widens the inferred types on both the read (doc)
// and write (mutation args) sides. Delete it once `_generated` includes
// the fields natively.
type SyncedExtras = {
  favorites?: string[];
  visited?: string[];
  expiryDates?: string;
};

interface VisaContextValue {
  /** Array of country codes for held visas (e.g., ["US", "UK"]) */
  heldVisas: string[];
  /** Array of country codes the user has favorited */
  favorites: string[];
  /** Array of country codes the user has visited */
  visited: string[];
  /** Map of country code -> expiry date string */
  expiryDates: Record<string, string>;

  /** Toggle a visa in the held list */
  toggleHeldVisa: (countryCode: string) => void;
  /** Set the entire held visas list */
  setHeldVisas: (visas: string[]) => void;

  /** Toggle a country in favorites */
  toggleFavorite: (countryCode: string) => void;
  /** Check if a country is favorited */
  isFavorite: (countryCode: string) => boolean;

  /** Toggle a country in visited */
  toggleVisited: (countryCode: string) => void;
  /** Check if a country is visited */
  isVisited: (countryCode: string) => boolean;

  /** Set expiry date for a country's visa */
  setExpiryDate: (countryCode: string, date: string) => void;
  /** Remove expiry date for a country */
  removeExpiryDate: (countryCode: string) => void;
  /** Get expiry date for a country (or undefined) */
  getExpiryDate: (countryCode: string) => string | undefined;

  /** Whether the initial load from AsyncStorage has completed */
  loaded: boolean;

  /** User's passport country codes */
  passports: string[];
  /** AI-generated visa data for user's passport, or null if not yet generated */
  visaMap: CountryVisa[] | null;
  /** Whether onboarding has been completed */
  onboarded: boolean;

  /** Set passport country codes */
  setPassports: (codes: string[]) => void;
  /** Set the AI-generated visa map */
  setVisaMap: (map: CountryVisa[]) => void;
  /** Set onboarding completion */
  setOnboarded: (value: boolean) => void;

  /** Country code where user lives */
  residence: string | null;
  /** Set residence country code */
  setResidence: (code: string | null) => void;

  /**
   * Atlas self-heal flag. True for exactly one broken state: the account is
   * onboarded server-side, but there is NO server visa profile (query loaded
   * and returned null — an account onboarded before the visaProfiles sync
   * existed) AND no local visa map (fresh install / post-sign-out wipe). The
   * atlas renders grey and untappable ("0 ON ATLAS") in that state. The root
   * layout routes these users back through onboarding; rebuilding the map
   * clears the flag naturally (local visaMap becomes non-null) and the push
   * effect persists it server-side so the state can never recur. Guaranteed
   * false until auth + both profile queries have settled, so it can't
   * trigger redirect loops mid-load.
   */
  needsAtlasRebuild: boolean;
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const VisaContext = createContext<VisaContextValue | undefined>(undefined);

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function loadStringArray(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

async function loadRecord(key: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

function persistArray(key: string, value: string[]) {
  AsyncStorage.setItem(key, JSON.stringify(value));
}

function persistRecord(key: string, value: Record<string, string>) {
  AsyncStorage.setItem(key, JSON.stringify(value));
}

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export function VisaProvider({ children }: { children: React.ReactNode }) {
  const [heldVisas, setHeldVisasState] = useState<string[]>([]);
  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [visited, setVisitedState] = useState<string[]>([]);
  const [expiryDates, setExpiryDatesState] = useState<Record<string, string>>(
    {},
  );
  const [loaded, setLoaded] = useState(false);
  const [passports, setPassportsState] = useState<string[]>([]);
  const [visaMapData, setVisaMapState] = useState<CountryVisa[] | null>(null);
  const [onboarded, setOnboardedState] = useState(false);
  const [residence, setResidenceState] = useState<string | null>(null);

  // ── Convex: server-truth onboarded flag ────────────────────────────
  // AsyncStorage is device-scoped, so without this the previous account's
  // onboarded flag would survive a sign-out + new sign-up on the same
  // device. We treat the user-profile doc as the source of truth and fall
  // back to the local cache only while the query is still resolving.
  const { isAuthenticated } = useConvexAuth();
  const remoteProfile = useQuery(
    api.userProfiles.getCurrentProfile,
    isAuthenticated ? {} : 'skip',
  );
  const markOnboardedMutation = useMutation(api.userProfiles.markOnboarded);

  // ── Convex: server copy of the visa profile ────────────────────────
  // `onboarded` is server-truth, but the data behind it (passports, visa
  // map, residence, held visas) was historically device-local — so a fresh
  // install of an onboarded account reached the tabs with an EMPTY atlas
  // (and crashed the Atlas tab before the VisaMap zero-branch guard). The
  // server doc lets a fresh device rehydrate; the client pushes its state
  // up whenever the local profile changes.
  const remoteVisaProfile = useQuery(
    api.visaProfiles.getMyVisaProfile,
    isAuthenticated ? {} : 'skip',
  );
  const saveVisaProfileMutation = useMutation(api.visaProfiles.saveVisaProfile);

  // ── Multi-device sync watermark ─────────────────────────────────────
  // The last server `updatedAt` this device has observed — set on every
  // successful push AND on hydration. Lives in a ref + AsyncStorage (not
  // state): nothing renders it, and keeping it out of the push effect's
  // deps means watermark bumps can never re-fire the effect (which would
  // loop under client/server clock skew).
  const lastSyncedAtRef = useRef(0);
  const markSynced = useCallback((ts: number) => {
    lastSyncedAtRef.current = ts;
    AsyncStorage.setItem(KEYS.lastSyncedAt, String(ts)).catch(() => {});
  }, []);

  // Load all persisted data on mount
  useEffect(() => {
    Promise.all([
      loadStringArray(KEYS.heldVisas),
      loadStringArray(KEYS.favorites),
      loadStringArray(KEYS.visited),
      loadRecord(KEYS.expiryDates),
      AsyncStorage.getItem(KEYS.passports),
      AsyncStorage.getItem(KEYS.visaMap),
      AsyncStorage.getItem(KEYS.onboarded),
      AsyncStorage.getItem(KEYS.residence),
      AsyncStorage.getItem(KEYS.lastSyncedAt),
    ]).then(([h, f, v, e, passportsRaw, visaMapRaw, onboardedRaw, residenceRaw, lastSyncedRaw]) => {
      setHeldVisasState(h);
      setFavoritesState(f);
      setVisitedState(v);
      setExpiryDatesState(e);

      if (passportsRaw) {
        try { setPassportsState(JSON.parse(passportsRaw)); } catch {}
      }
      if (visaMapRaw) {
        try { setVisaMapState(JSON.parse(visaMapRaw)); } catch {}
      }
      if (onboardedRaw === 'true') setOnboardedState(true);
      if (residenceRaw) setResidenceState(residenceRaw);
      if (lastSyncedRaw) {
        const ts = Number(lastSyncedRaw);
        if (!Number.isNaN(ts)) lastSyncedAtRef.current = ts;
      }

      setLoaded(true);
    });
  }, []);

  // ── Held Visas ──

  const toggleHeldVisa = useCallback((countryCode: string) => {
    setHeldVisasState((prev) => {
      const next = prev.includes(countryCode)
        ? prev.filter((c) => c !== countryCode)
        : [...prev, countryCode];
      persistArray(KEYS.heldVisas, next);
      return next;
    });
  }, []);

  const setHeldVisas = useCallback((visas: string[]) => {
    setHeldVisasState(visas);
    persistArray(KEYS.heldVisas, visas);
  }, []);

  // ── Favorites ──

  const toggleFavorite = useCallback((countryCode: string) => {
    setFavoritesState((prev) => {
      const next = prev.includes(countryCode)
        ? prev.filter((c) => c !== countryCode)
        : [...prev, countryCode];
      persistArray(KEYS.favorites, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (countryCode: string) => favorites.includes(countryCode),
    [favorites],
  );

  // ── Visited ──

  const toggleVisited = useCallback((countryCode: string) => {
    setVisitedState((prev) => {
      const next = prev.includes(countryCode)
        ? prev.filter((c) => c !== countryCode)
        : [...prev, countryCode];
      persistArray(KEYS.visited, next);
      return next;
    });
  }, []);

  const isVisited = useCallback(
    (countryCode: string) => visited.includes(countryCode),
    [visited],
  );

  // ── Passports / VisaMap / Onboarded ──

  const setPassports = useCallback((codes: string[]) => {
    setPassportsState(codes);
    AsyncStorage.setItem(KEYS.passports, JSON.stringify(codes));
  }, []);

  const setVisaMap = useCallback((map: CountryVisa[]) => {
    setVisaMapState(map);
    AsyncStorage.setItem(KEYS.visaMap, JSON.stringify(map));
  }, []);

  const setOnboarded = useCallback((value: boolean) => {
    setOnboardedState(value);
    AsyncStorage.setItem(KEYS.onboarded, String(value));
    // Persist on the server so the flag follows the user, not the device.
    if (value && isAuthenticated) {
      void markOnboardedMutation({}).catch((err) => {
        console.warn('markOnboarded failed', err);
      });
    }
  }, [isAuthenticated, markOnboardedMutation]);

  // ── Rehydrate from the server when the local cache is empty ────────
  // Fires exactly once per empty-cache session: local `visaMapData === null`
  // is the trigger, and a successful hydrate makes it non-null. Local data,
  // when present, always wins — the server copy is a backup, not a source
  // of live truth. Favorites / visited / expiry dates follow the same
  // local-empty rule per slice (functional updaters check `prev`), so a
  // toggle made this session before the query resolved is never clobbered.
  useEffect(() => {
    if (!loaded || !isAuthenticated) return;
    if (visaMapData !== null) return; // local cache populated — nothing to do
    if (!remoteVisaProfile) return; // undefined = loading, null = never saved
    try {
      const parsed = JSON.parse(remoteVisaProfile.visaMap) as CountryVisa[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setVisaMapState(parsed);
      AsyncStorage.setItem(KEYS.visaMap, remoteVisaProfile.visaMap);
      setPassportsState(remoteVisaProfile.passports);
      AsyncStorage.setItem(
        KEYS.passports,
        JSON.stringify(remoteVisaProfile.passports),
      );
      setHeldVisasState(remoteVisaProfile.heldVisas);
      persistArray(KEYS.heldVisas, remoteVisaProfile.heldVisas);
      setResidenceState(remoteVisaProfile.residence);
      if (remoteVisaProfile.residence) {
        AsyncStorage.setItem(KEYS.residence, remoteVisaProfile.residence);
      }

      // Favorites / visited / expiry dates ride along on the same doc
      // (optional fields — pre-sync docs simply lack them).
      const remoteExtras = remoteVisaProfile as typeof remoteVisaProfile &
        SyncedExtras;
      if (
        Array.isArray(remoteExtras.favorites) &&
        remoteExtras.favorites.length > 0
      ) {
        const serverFavorites = remoteExtras.favorites;
        setFavoritesState((prev) => {
          if (prev.length > 0) return prev; // local wins — only fill empty
          persistArray(KEYS.favorites, serverFavorites);
          return serverFavorites;
        });
      }
      if (
        Array.isArray(remoteExtras.visited) &&
        remoteExtras.visited.length > 0
      ) {
        const serverVisited = remoteExtras.visited;
        setVisitedState((prev) => {
          if (prev.length > 0) return prev;
          persistArray(KEYS.visited, serverVisited);
          return serverVisited;
        });
      }
      if (typeof remoteExtras.expiryDates === 'string') {
        try {
          const record = JSON.parse(remoteExtras.expiryDates) as unknown;
          if (
            record &&
            typeof record === 'object' &&
            !Array.isArray(record) &&
            Object.keys(record).length > 0
          ) {
            const serverExpiry = record as Record<string, string>;
            setExpiryDatesState((prev) => {
              if (Object.keys(prev).length > 0) return prev;
              persistRecord(KEYS.expiryDates, serverExpiry);
              return serverExpiry;
            });
          }
        } catch {
          // Corrupt expiry record — keep local state.
        }
      }

      // This device has now observed this server revision.
      markSynced(remoteVisaProfile.updatedAt);
    } catch {
      // Corrupt server JSON — leave local state empty; onboarding's
      // validation prevents this from being written in the first place.
    }
  }, [loaded, isAuthenticated, visaMapData, remoteVisaProfile, markSynced]);

  // Mirror the live server doc onto a ref so the push effect can conflict-
  // check at fire time without taking the doc as a dep (which would re-push
  // on every remote revision and loop).
  const remoteVisaProfileRef = useRef(remoteVisaProfile);
  useEffect(() => {
    remoteVisaProfileRef.current = remoteVisaProfile;
  }, [remoteVisaProfile]);

  // ── Push local profile → server ─────────────────────────────────────
  // Trailing debounce coalesces bursts (e.g. toggling several held visas
  // in the editor) into one mutation — write-batching, not timing-derived
  // UI logic. Saving the just-hydrated state back once is harmless.
  //
  // Multi-device convergence rule: `lastSyncedAt` is the last server
  // revision THIS device has observed (set on every successful push and
  // on hydration). If the server doc is newer at push time, another device
  // wrote since we last synced — blind-pushing would clobber it. Instead:
  // merge server → local first (arrays: union; scalars: server wins), mark
  // the revision observed, and let the merged state re-fire this effect so
  // the next push sends the union. Both devices converge on the same
  // superset. A no-op merge (local already a superset) falls through and
  // pushes immediately. The closure values below are always fresh at fire
  // time: any local change re-runs the effect, and the cleanup cancels the
  // previous timer before it can fire with stale state.
  const remoteVisaProfileSettled = remoteVisaProfile !== undefined;
  useEffect(() => {
    if (!loaded || !isAuthenticated) return;
    if (!visaMapData || visaMapData.length === 0) return;
    // Hold pushes until the server copy has resolved — conflict detection
    // needs to know whether (and when) another device last wrote.
    if (!remoteVisaProfileSettled) return;
    const timer = setTimeout(() => {
      const remote = remoteVisaProfileRef.current as
        | (NonNullable<typeof remoteVisaProfile> & SyncedExtras)
        | null
        | undefined;

      if (remote && remote.updatedAt > lastSyncedAtRef.current) {
        // Another device wrote since this device last synced — merge.
        let changed = false;

        const union = (server: string[], local: string[]): string[] => {
          const merged = [...server];
          for (const code of local) {
            if (!merged.includes(code)) merged.push(code);
          }
          return merged;
        };
        // Order-insensitive equality: union output keeps server order, so
        // an order-only difference must not count as a local change.
        const sameSet = (a: string[], b: string[]): boolean =>
          a.length === b.length && a.every((x) => b.includes(x));

        const mergedPassports = union(remote.passports, passports);
        if (!sameSet(mergedPassports, passports)) {
          setPassportsState(mergedPassports);
          AsyncStorage.setItem(
            KEYS.passports,
            JSON.stringify(mergedPassports),
          );
          changed = true;
        }

        const mergedHeld = union(remote.heldVisas, heldVisas);
        if (!sameSet(mergedHeld, heldVisas)) {
          setHeldVisasState(mergedHeld);
          persistArray(KEYS.heldVisas, mergedHeld);
          changed = true;
        }

        const mergedFavorites = union(remote.favorites ?? [], favorites);
        if (!sameSet(mergedFavorites, favorites)) {
          setFavoritesState(mergedFavorites);
          persistArray(KEYS.favorites, mergedFavorites);
          changed = true;
        }

        const mergedVisited = union(remote.visited ?? [], visited);
        if (!sameSet(mergedVisited, visited)) {
          setVisitedState(mergedVisited);
          persistArray(KEYS.visited, mergedVisited);
          changed = true;
        }

        // Expiry dates: per-key merge, server wins on conflicting keys.
        let remoteExpiry: Record<string, string> = {};
        if (typeof remote.expiryDates === 'string') {
          try {
            const rec = JSON.parse(remote.expiryDates) as unknown;
            if (rec && typeof rec === 'object' && !Array.isArray(rec)) {
              remoteExpiry = rec as Record<string, string>;
            }
          } catch {
            // Corrupt server record — treat as empty.
          }
        }
        const mergedExpiry = { ...expiryDates, ...remoteExpiry };
        if (JSON.stringify(mergedExpiry) !== JSON.stringify(expiryDates)) {
          setExpiryDatesState(mergedExpiry);
          persistRecord(KEYS.expiryDates, mergedExpiry);
          changed = true;
        }

        // Scalars: server wins.
        if (remote.residence !== residence) {
          setResidenceState(remote.residence);
          if (remote.residence) {
            AsyncStorage.setItem(KEYS.residence, remote.residence);
          } else {
            AsyncStorage.removeItem(KEYS.residence);
          }
          changed = true;
        }
        try {
          const parsedMap = JSON.parse(remote.visaMap) as CountryVisa[];
          if (
            Array.isArray(parsedMap) &&
            parsedMap.length > 0 &&
            remote.visaMap !== JSON.stringify(visaMapData)
          ) {
            setVisaMapState(parsedMap);
            AsyncStorage.setItem(KEYS.visaMap, remote.visaMap);
            changed = true;
          }
        } catch {
          // Corrupt server map — keep the local one.
        }

        markSynced(remote.updatedAt);
        if (changed) return; // merged state re-fires this effect → pushes the union
        // No diff: local is already a superset of the server copy — push it.
      }

      // TODO(convex-contract): favorites/visited/expiryDates are optional
      // args being added to saveVisaProfile by the concurrent convex change
      // (expiryDates = JSON-string record). The intersection type keeps
      // this compiling until `_generated` picks them up — delete
      // SyncedExtras once it does.
      const payload: Parameters<typeof saveVisaProfileMutation>[0] &
        SyncedExtras = {
        passports,
        heldVisas,
        residence,
        visaMap: JSON.stringify(visaMapData),
        favorites,
        visited,
        expiryDates: JSON.stringify(expiryDates),
      };
      void saveVisaProfileMutation(payload)
        .then(() => {
          // Client/server clock skew is self-healing: if the server stamped
          // a later updatedAt than Date.now() here, the next push runs one
          // harmless no-op merge before falling through.
          markSynced(Date.now());
        })
        .catch((err) => {
          console.warn('visaProfile sync failed', err);
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    loaded,
    isAuthenticated,
    remoteVisaProfileSettled,
    visaMapData,
    passports,
    heldVisas,
    residence,
    favorites,
    visited,
    expiryDates,
    saveVisaProfileMutation,
    markSynced,
  ]);

  // Effective `onboarded` — server-truth when authenticated, local cache
  // otherwise. While the profile query is still resolving (`undefined`)
  // we fall back to the cache to avoid flickering the onboarding flow on
  // every cold start.
  const effectiveOnboarded = useMemo(() => {
    if (!isAuthenticated) return false;
    if (remoteProfile === undefined) return onboarded;
    return remoteProfile?.onboarded === true;
  }, [isAuthenticated, remoteProfile, onboarded]);

  // ── Atlas self-heal flag ────────────────────────────────────────────
  // Accounts onboarded before the visaProfiles sync existed are marked
  // onboarded server-side but have no server visa profile; after a
  // reinstall (or the sign-out wipe below) they also have no local visa
  // map — so the atlas renders grey and untappable. Flag exactly that
  // state for the root layout, which routes them back through onboarding.
  // Every input must be SETTLED: `loaded` (AsyncStorage read done),
  // `remoteProfile !== undefined` (onboarded flag resolved) and
  // `remoteVisaProfile === null` (profile query resolved AND absent —
  // `undefined` means still loading). That settledness is the loop guard:
  // the flag can never flicker true mid-load, and completing onboarding
  // clears it naturally because setVisaMap makes visaMapData non-null.
  const needsAtlasRebuild = useMemo(
    () =>
      loaded &&
      isAuthenticated &&
      remoteProfile !== undefined &&
      effectiveOnboarded &&
      remoteVisaProfile === null &&
      (!visaMapData || visaMapData.length === 0),
    [
      loaded,
      isAuthenticated,
      remoteProfile,
      effectiveOnboarded,
      remoteVisaProfile,
      visaMapData,
    ],
  );

  // Sign-out cleanup: when the auth state transitions from authed → not,
  // clear the user-scoped cache so the next account on this device starts
  // fresh. Without this, a fast new-account flow on the same device would
  // see the previous user's passports / visa map / onboarded flag.
  const wasAuthedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthedRef.current && !isAuthenticated) {
      AsyncStorage.multiRemove([
        KEYS.passports,
        KEYS.visaMap,
        KEYS.onboarded,
        KEYS.residence,
        KEYS.heldVisas,
        KEYS.favorites,
        KEYS.visited,
        KEYS.expiryDates,
        KEYS.lastSyncedAt,
      ]).catch(() => {});
      setPassportsState([]);
      setVisaMapState(null);
      setOnboardedState(false);
      setResidenceState(null);
      setHeldVisasState([]);
      setFavoritesState([]);
      setVisitedState([]);
      setExpiryDatesState({});
      // Reset the sync watermark too — the next account on this device must
      // not compare its server doc against the previous account's watermark
      // (a stale high watermark would let it blind-push over newer data).
      lastSyncedAtRef.current = 0;
    }
    wasAuthedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const setResidence = useCallback((code: string | null) => {
    setResidenceState(code);
    if (code) {
      AsyncStorage.setItem(KEYS.residence, code);
    } else {
      AsyncStorage.removeItem(KEYS.residence);
    }
  }, []);

  // ── Expiry Dates ──

  const setExpiryDate = useCallback(
    (countryCode: string, date: string) => {
      setExpiryDatesState((prev) => {
        const next = { ...prev, [countryCode]: date };
        persistRecord(KEYS.expiryDates, next);
        return next;
      });
    },
    [],
  );

  const removeExpiryDate = useCallback((countryCode: string) => {
    setExpiryDatesState((prev) => {
      const next = { ...prev };
      delete next[countryCode];
      persistRecord(KEYS.expiryDates, next);
      return next;
    });
  }, []);

  const getExpiryDate = useCallback(
    (countryCode: string) => expiryDates[countryCode],
    [expiryDates],
  );

  // ── Memoized value ──

  const value = useMemo<VisaContextValue>(
    () => ({
      heldVisas,
      favorites,
      visited,
      expiryDates,
      toggleHeldVisa,
      setHeldVisas,
      toggleFavorite,
      isFavorite,
      toggleVisited,
      isVisited,
      setExpiryDate,
      removeExpiryDate,
      getExpiryDate,
      loaded: loaded && (!isAuthenticated || remoteProfile !== undefined),
      passports,
      visaMap: visaMapData,
      onboarded: effectiveOnboarded,
      setPassports,
      setVisaMap,
      setOnboarded,
      residence,
      setResidence,
      needsAtlasRebuild,
    }),
    [
      heldVisas,
      favorites,
      visited,
      expiryDates,
      toggleHeldVisa,
      setHeldVisas,
      toggleFavorite,
      isFavorite,
      toggleVisited,
      isVisited,
      setExpiryDate,
      removeExpiryDate,
      getExpiryDate,
      loaded,
      isAuthenticated,
      remoteProfile,
      passports,
      visaMapData,
      effectiveOnboarded,
      setPassports,
      setVisaMap,
      setOnboarded,
      residence,
      setResidence,
      needsAtlasRebuild,
    ],
  );

  return (
    <VisaContext.Provider value={value}>{children}</VisaContext.Provider>
  );
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useVisa(): VisaContextValue {
  const context = useContext(VisaContext);
  if (!context) {
    throw new Error('useVisa must be used within VisaProvider');
  }
  return context;
}

/**
 * Returns the AI-generated visa data if available, falling back to hardcoded data.
 * Components should use this instead of importing visaData directly.
 */
export function useVisaData(): CountryVisa[] {
  const { visaMap, passports, residence } = useVisa();
  // Onboarding is mandatory — visaMap is always populated
  const base = visaMap ?? [];

  // Mark residence and passport countries as "home" (visa-free)
  const homeCodes = new Set<string>([
    ...passports,
    ...(residence ? [residence] : []),
  ]);

  if (homeCodes.size === 0) return base;

  return base.map((country) => {
    if (homeCodes.has(country.code) && country.category !== 'visa-free') {
      return { ...country, category: 'visa-free' as const, notes: 'Home country' };
    }
    return country;
  });
}

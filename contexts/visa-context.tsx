import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ──────────────────────────────────────────────
// Storage keys
// ──────────────────────────────────────────────

const KEYS = {
  heldVisas: '@visa_atlas_held_visas',
  favorites: '@visa_atlas_favorites',
  visited: '@visa_atlas_visited',
  expiryDates: '@visa_atlas_expiry_dates',
} as const;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ExpiryDate {
  countryCode: string;
  date: string; // ISO date string
}

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

  // Load all persisted data on mount
  useEffect(() => {
    Promise.all([
      loadStringArray(KEYS.heldVisas),
      loadStringArray(KEYS.favorites),
      loadStringArray(KEYS.visited),
      loadRecord(KEYS.expiryDates),
    ]).then(([h, f, v, e]) => {
      setHeldVisasState(h);
      setFavoritesState(f);
      setVisitedState(v);
      setExpiryDatesState(e);
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
      loaded,
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

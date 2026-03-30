import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Generic AsyncStorage hook that mirrors the web app's useLocalStorage.
 *
 * Returns a tuple of [value, setValue, isLoading].
 *
 * - `value` starts as `defaultValue` and is updated once the stored value loads.
 * - `setValue` accepts either a new value or an updater function (prev => next).
 * - `isLoading` is true until the initial read from AsyncStorage completes.
 */
export function useAsyncStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [state, setState] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef<T>(defaultValue);

  // Keep ref in sync for use in the updater callback
  stateRef.current = state;

  // Load persisted value on mount
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw) as T;
            setState(parsed);
            stateRef.current = parsed;
          } catch {
            // Invalid JSON — keep default
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const setValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      const nextValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(stateRef.current)
          : valueOrUpdater;

      setState(nextValue);
      stateRef.current = nextValue;
      AsyncStorage.setItem(key, JSON.stringify(nextValue));
    },
    [key],
  );

  return [state, setValue, isLoading];
}

/**
 * AsyncStorage hook specialized for Set<T> types.
 *
 * Internally stores the set as a JSON array, and exposes it as a Set.
 * The setter accepts either a new Set or an updater function.
 */
export function useAsyncStorageSet<T>(
  key: string,
  defaultValue: Set<T> = new Set(),
): [Set<T>, (value: Set<T> | ((prev: Set<T>) => Set<T>)) => void, boolean] {
  const [state, setState] = useState<Set<T>>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef<Set<T>>(defaultValue);

  stateRef.current = state;

  // Load persisted value on mount
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (raw !== null) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const set = new Set<T>(parsed);
              setState(set);
              stateRef.current = set;
            }
          } catch {
            // Invalid JSON — keep default
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const setValue = useCallback(
    (valueOrUpdater: Set<T> | ((prev: Set<T>) => Set<T>)) => {
      const nextValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: Set<T>) => Set<T>)(stateRef.current)
          : valueOrUpdater;

      setState(nextValue);
      stateRef.current = nextValue;
      AsyncStorage.setItem(key, JSON.stringify([...nextValue]));
    },
    [key],
  );

  return [state, setValue, isLoading];
}

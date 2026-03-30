import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Linking } from 'react-native';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { endpoints } from '@/constants/api';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface EmailContextValue {
  gmailAccount: any | null;
  isSyncing: boolean;
  lastSyncResult: { imported: number; error: string | null } | null;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  syncGmail: () => Promise<void>;
  loaded: boolean;
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const EmailContext = createContext<EmailContextValue | null>(null);

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    imported: number;
    error: string | null;
  } | null>(null);

  const autoSyncFired = useRef(false);

  // ── Convex hooks ──

  const gmailAccount = useQuery(api.emailAccounts.getByProvider, {
    provider: 'gmail',
  });
  const scanGmail = useAction(api.emailSync.scanGmail);
  const disconnectAccount = useMutation(api.emailAccounts.disconnect);

  const loaded = gmailAccount !== undefined;
  const isConnected = gmailAccount !== undefined && gmailAccount !== null;

  // ── syncGmail() ──

  const syncGmail = useCallback(async () => {
    if (isSyncing || !isConnected) return;

    setIsSyncing(true);
    try {
      const result = await scanGmail({ accountId: gmailAccount!._id });
      setLastSyncResult(result);
    } catch (err: any) {
      setLastSyncResult({ imported: 0, error: err.message ?? 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isConnected, scanGmail]);

  // ── Auto-sync effect ──

  useEffect(() => {
    if (!loaded || !isConnected) return;
    if (autoSyncFired.current) return;

    const lastScanTime = gmailAccount?.lastScanTime;
    const shouldSync =
      lastScanTime == null ||
      Date.now() - new Date(lastScanTime).getTime() > TWENTY_FOUR_HOURS_MS;

    if (shouldSync) {
      autoSyncFired.current = true;
      syncGmail();
    }
  }, [loaded, isConnected, gmailAccount, syncGmail]);

  // ── connectGmail() ──

  const connectGmail = useCallback(async () => {
    await Linking.openURL(endpoints.gmailAuth);
  }, []);

  // ── disconnectGmail() ──

  const disconnectGmail = useCallback(async () => {
    if (!gmailAccount?._id) return;
    await disconnectAccount({ id: gmailAccount._id });
  }, [gmailAccount, disconnectAccount]);

  // ── Memoized value ──

  const value = useMemo<EmailContextValue>(
    () => ({
      gmailAccount: gmailAccount ?? null,
      isSyncing,
      lastSyncResult,
      connectGmail,
      disconnectGmail,
      syncGmail,
      loaded,
    }),
    [
      gmailAccount,
      isSyncing,
      lastSyncResult,
      connectGmail,
      disconnectGmail,
      syncGmail,
      loaded,
    ],
  );

  return (
    <EmailContext.Provider value={value}>{children}</EmailContext.Provider>
  );
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useEmail(): EmailContextValue {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmail must be used within EmailProvider');
  }
  return context;
}

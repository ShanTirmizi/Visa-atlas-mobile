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

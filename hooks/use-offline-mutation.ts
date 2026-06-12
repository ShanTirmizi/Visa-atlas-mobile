// hooks/use-offline-mutation.ts
// Drop-in replacement for Convex's useMutation that enqueues mutations and
// applies optimistic SQLite updates when the device is offline.

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { getFunctionName } from 'convex/server';
import type { FunctionReference, FunctionArgs } from 'convex/server';
import { useOffline, notifyMutationQueued } from '@/contexts/offline-context';
import {
  enqueueMutation,
  getCachedTrip,
  cacheTrip,
  getCachedVisaGuide,
  cacheVisaGuide,
} from '@/lib/offline/database';
import type { MutationIntent } from '@/lib/offline/types';

// ---------------------------------------------------------------------------
// Intent resolution
// ---------------------------------------------------------------------------

function resolveIntent(
  refStr: string,
  args: Record<string, unknown>,
): MutationIntent {
  if (refStr.includes('updateTripStatus')) {
    return {
      action: 'updateTripStatus',
      table: 'trips',
      documentId: args.id as string,
      payload: { status: args.status },
    };
  }

  if (refStr.includes('updateTripField')) {
    return {
      action: 'updateTripField',
      table: 'trips',
      documentId: args.id as string,
      payload: { field: args.field, value: args.value },
    };
  }

  if (refStr.includes('updateChecklist')) {
    return {
      action: 'updateVisaChecklist',
      table: 'visaGuides',
      documentId: args.id as string,
      payload: { checklist: args.checklist },
    };
  }

  // 'updateStatus' is ambiguous — only match it for visaGuides context.
  // The ref string for visa guide mutations will contain 'visaGuide' or similar,
  // but the spec says to match 'updateStatus' (for visaGuides) after the more
  // specific patterns above have already been checked.
  if (refStr.includes('updateStatus')) {
    return {
      action: 'updateVisaStatus',
      table: 'visaGuides',
      documentId: args.id as string,
      payload: { status: args.status },
    };
  }

  if (refStr.includes('updateBooking')) {
    return {
      action: 'updateBooking',
      table: 'bookings',
      documentId: args.id as string,
      payload: args,
    };
  }

  throw new Error(`Mutation not supported offline: ${refStr}`);
}

// ---------------------------------------------------------------------------
// Optimistic update helpers
// ---------------------------------------------------------------------------

async function applyOptimisticUpdate(
  intent: MutationIntent,
): Promise<void> {
  switch (intent.action) {
    case 'updateTripStatus': {
      const trip = await getCachedTrip(intent.documentId);
      if (trip === null) return;
      const updated = {
        ...(trip as Record<string, unknown>),
        status: intent.payload.status,
      };
      await cacheTrip(intent.documentId, updated);
      break;
    }

    case 'updateTripField': {
      const trip = await getCachedTrip(intent.documentId);
      if (trip === null) return;
      const field = intent.payload.field as string;
      const updated = {
        ...(trip as Record<string, unknown>),
        [field]: intent.payload.value,
      };
      await cacheTrip(intent.documentId, updated);
      break;
    }

    case 'updateVisaChecklist': {
      const guide = await getCachedVisaGuide(intent.documentId);
      if (guide === null) return;
      const raw = guide as { _id: string; countryCode: string } & Record<string, unknown>;
      const updated = { ...raw, checklist: intent.payload.checklist };
      await cacheVisaGuide(intent.documentId, raw.countryCode, updated);
      break;
    }

    case 'updateVisaStatus': {
      const guide = await getCachedVisaGuide(intent.documentId);
      if (guide === null) return;
      const raw = guide as { _id: string; countryCode: string } & Record<string, unknown>;
      const updated = { ...raw, status: intent.payload.status };
      await cacheVisaGuide(intent.documentId, raw.countryCode, updated);
      break;
    }

    case 'updateBooking':
      // Bookings are read-only offline in MVP — skip optimistic update.
      break;

    default: {
      // Exhaustiveness guard — TypeScript will catch unhandled cases at
      // compile time via the never type.
      const _exhaustive: never = intent.action;
      throw new Error(`Unhandled optimistic update action: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineMutation<Mutation extends FunctionReference<'mutation'>>(
  mutationRef: Mutation,
): (args: FunctionArgs<Mutation>) => Promise<void> {
  const { isOffline } = useOffline();
  const convexMutate = useMutation(mutationRef);

  return useCallback(
    async (args: FunctionArgs<Mutation>): Promise<void> => {
      if (!isOffline) {
        await convexMutate(args);
        return;
      }

      const refStr = getFunctionName(mutationRef);
      const argsRecord = args as Record<string, unknown>;

      const intent = resolveIntent(refStr, argsRecord);
      await enqueueMutation(intent);
      // Nudge the offline banner's "N pending" count the moment the row
      // lands — before the optimistic cache write, so the count is fresh
      // even if that write fails.
      notifyMutationQueued();
      await applyOptimisticUpdate(intent);
    },
    // convexMutate identity is stable per Convex docs; isOffline and mutationRef
    // are the meaningful reactive deps here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOffline, mutationRef, convexMutate],
  );
}

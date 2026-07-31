import { useCallback } from 'react';

// ── Point the AI features at the standalone FastAPI backend (Render) ──────────
//
// Drop-in replacement for `useAction(api.aiProxy.<fn>)`. You call the returned
// function with `{ body }` (the JSON-encoded payload, exactly like the Convex
// proxy) and it POSTs that body to the matching FastAPI route and returns the
// parsed JSON response.
//
//   const proxyCompare = useAIBackend('compare');
//   const data = await proxyCompare({ body: JSON.stringify(payload) });
//
// Config (set in .env.local for dev, or eas.json env for builds):
//   EXPO_PUBLIC_AI_BACKEND_URL    e.g. https://visa-atlas-api.onrender.com
//   EXPO_PUBLIC_AI_BACKEND_TOKEN  bearer token the API accepts. For testing,
//                                 set the API to ENVIRONMENT=development with a
//                                 DEV_AUTH_TOKEN and use the SAME value here.
//                                 (Real multi-user auth = forward the Convex
//                                 Auth JWT instead — see notes in chat.)
const BASE = (process.env.EXPO_PUBLIC_AI_BACKEND_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.EXPO_PUBLIC_AI_BACKEND_TOKEN ?? '';

export function useAIBackend(route: string) {
  return useCallback(
    async ({ body }: { body: string }): Promise<unknown> => {
      const res = await fetch(`${BASE}/${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `AI backend ${route} failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`AI backend ${route} returned non-JSON`);
      }
    },
    [route],
  );
}

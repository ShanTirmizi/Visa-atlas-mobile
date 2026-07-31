// convex/lib/aiFetch.ts
//
// Bounded fetch for the AI proxy routes, shared by every durable job runner
// (comparisons, aiJobs, tripChat).
//
// Why a timeout is mandatory, not defensive polish: a Convex action is killed
// by the runtime at 5 minutes. When that happens the action's own catch block
// never runs, so the row it was filling in stays "generating"/"thinking"
// FOREVER — a fresh hang, just one level down from the useAction bug this
// whole migration set out to fix.
//
// Measured against production on 2026-07-31:
//   /api/trip-chat with a real 22KB itinerary → HTTP 504 after 300.6s
//   (Vercel's own gateway limit; the route never returns for real trips)
//
// So the upstream can and does exceed the action budget. Aborting below it
// means the catch runs, the row flips to "failed", and the user gets a retry
// affordance instead of a spinner that never ends.

/** Comfortably under Convex's 5-minute action ceiling, and under Vercel's own
 *  300s gateway timeout, so we fail on our terms rather than being killed. */
export const AI_FETCH_TIMEOUT_MS = 180_000;

/** Belt-and-braces deadline for the watchdog that sweeps orphaned rows: longer
 *  than the fetch budget, shorter than "forever". */
export const AI_WATCHDOG_MS = 240_000;

export class AiFetchTimeout extends Error {
  constructor(ms: number) {
    super(`upstream did not respond within ${ms}ms`);
    this.name = "AiFetchTimeout";
  }
}

/**
 * POST to an AI proxy route with a hard deadline.
 * Throws AiFetchTimeout on expiry, or the underlying network error.
 */
export async function aiFetch(
  url: string,
  secret: string,
  body: string,
  timeoutMs: number = AI_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-atlas-proxy-secret": secret,
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    // An abort surfaces as a DOMException/AbortError — translate it so callers
    // can log "timed out" rather than an opaque abort.
    if (controller.signal.aborted) throw new AiFetchTimeout(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

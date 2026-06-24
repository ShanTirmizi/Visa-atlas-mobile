import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";
import { checkRateLimit, HOUR_MS } from "./lib/rateLimit";

// ── Authenticated AI proxy ───────────────────────────────────────
//
// The Vercel /api/* LLM endpoints (compare, surprise, visa-guide,
// visa-chat, scan-booking) were called directly from the client with no
// auth — anyone with the URL could burn Anthropic credits. These actions
// put Convex auth + per-user rate limits in front of them and forward the
// request with a shared secret header (`x-atlas-proxy-secret`) that the
// Vercel routes verify, so the endpoints can stop accepting anonymous
// traffic entirely.
//
// Contract (client migrates in a later wave):
//   const result = await useAction(api.aiProxy.compare)({
//     body: JSON.stringify(payload),   // the exact JSON body the client
//   });                                 // used to POST to the endpoint
//
// `body` is the raw JSON-encoded request body — forwarded byte-for-byte,
// so the Vercel routes need no request-shape changes. The parsed response
// JSON is returned as-is.

const API_BASE = "https://visa-atlas.vercel.app";

/** Per-route hourly limits — generous for real use, fatal for abuse. */
const LIMITS = {
  compare: { route: "compare", key: "aiProxy:compare", max: 20 },
  surprise: { route: "surprise", key: "aiProxy:surprise", max: 10 },
  visaGuide: { route: "visa-guide", key: "aiProxy:visaGuide", max: 5 },
  visaChat: { route: "visa-chat", key: "aiProxy:visaChat", max: 30 },
  scanBooking: { route: "scan-booking", key: "aiProxy:scanBooking", max: 10 },
  tripChat: { route: "trip-chat", key: "aiProxy:tripChat", max: 30 },
} as const;

// Generic, user-safe copy — upstream details are logged, never surfaced
// (thrown action messages render verbatim in the client).
const UPSTREAM_ERROR_MESSAGE =
  "The travel service is briefly unavailable — please try again.";

/** Rate-limit gate for the proxy actions. Actions have no ctx.db, so the
 *  fixed-window check runs in this internal mutation; the auth context
 *  propagates from the client-called action, so requireAuth still derives
 *  the real caller. */
export const _consumeRateLimit = internalMutation({
  args: { key: v.string(), max: v.number(), windowMs: v.number() },
  handler: async (ctx, { key, max, windowMs }) => {
    const userId = await requireAuth(ctx);
    await checkRateLimit(ctx, userId, key, max, windowMs);
  },
});

async function forwardToVercel(
  ctx: ActionCtx,
  limit: { route: string; key: string; max: number },
  body: string,
): Promise<unknown> {
  await requireAuth(ctx);
  await ctx.runMutation(internal.aiProxy._consumeRateLimit, {
    key: limit.key,
    max: limit.max,
    windowMs: HOUR_MS,
  });

  const secret = process.env.AI_PROXY_SECRET;
  if (!secret) {
    // Configuration problem, not a user problem — log the real cause.
    console.error("aiProxy: AI_PROXY_SECRET env var is not set");
    throw new Error(UPSTREAM_ERROR_MESSAGE);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/${limit.route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-atlas-proxy-secret": secret,
      },
      body,
    });
  } catch (err) {
    console.error(`aiProxy ${limit.route} fetch failed:`, err);
    throw new Error(UPSTREAM_ERROR_MESSAGE);
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(
      `aiProxy ${limit.route} upstream ${res.status}:`,
      text.slice(0, 300),
    );
    throw new Error(UPSTREAM_ERROR_MESSAGE);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error(
      `aiProxy ${limit.route} returned non-JSON:`,
      text.slice(0, 300),
    );
    throw new Error(UPSTREAM_ERROR_MESSAGE);
  }
}

/** Country comparison (Compare tab). 20/hour. */
export const compare = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.compare, body),
});

/** Surprise-me destination pick. 10/hour. */
export const surprise = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.surprise, body),
});

/** Personalized visa guide generation. 5/hour. */
export const visaGuide = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.visaGuide, body),
});

/** Visa guide chat replies. 30/hour. */
export const visaChat = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.visaChat, body),
});

/** Booking screenshot OCR/extraction. 10/hour. */
export const scanBooking = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.scanBooking, body),
});

/** Trip copilot chat replies. 30/hour. */
export const tripChat = action({
  args: { body: v.string() },
  handler: async (ctx, { body }): Promise<unknown> =>
    forwardToVercel(ctx, LIMITS.tripChat, body),
});

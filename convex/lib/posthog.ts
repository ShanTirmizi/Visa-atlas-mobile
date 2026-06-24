// convex/lib/posthog.ts
//
// Server-side PostHog capture for Convex actions — LLM cost/usage observability
// plus backend product events.
//
// Why raw fetch instead of posthog-node: Convex actions are short-lived. The
// posthog-node SDK buffers events and flushes on an interval/shutdown — in a
// serverless context that drops events when the action returns before the flush.
// A single awaited fetch to PostHog's capture endpoint is strictly more reliable
// and works in both Convex runtimes. (PostHog HTTP API:
// https://posthog.com/docs/api/capture — POST /i/v0/e/, distinct_id top-level.)
//
// Every export is wrapped so analytics can NEVER fail a generation. If the key is
// unset, every call is a no-op (local dev without POSTHOG_API_KEY just works).

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_KEY = process.env.POSTHOG_API_KEY;

// ── Pricing (USD per token) ──────────────────────────────────────────────
// Every call site uses claude-sonnet-4-6. We compute cost ourselves and send
// it explicitly ($ai_*_cost_usd) rather than relying on PostHog's model→cost
// map, which may not yet recognise a brand-new model id. Tokens + model are
// ALSO sent so the native LLM-analytics dashboards still work.
//
// claude-sonnet-4-6 (per 1M tokens): input $3.00, output $15.00,
// cache read $0.30 (0.1x), cache write 5m $3.75 (1.25x). Web search $10/1k.
interface ModelPricing {
  input: number; // $/token
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-6": {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
};

/** Anthropic web search tool: $10 per 1,000 searches. */
const WEB_SEARCH_COST_USD = 0.01;

export interface AnthropicUsage {
  /** Uncached input tokens (Anthropic uses EXCLUSIVE counting — cache tokens are separate). */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  /** server_tool_use web_search invocations, if any. */
  webSearches?: number;
}

interface AiCost {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

/** Compute USD cost from a model + token usage. Unknown models → zeros (tokens still tracked). */
export function aiCostUsd(model: string, usage: AnthropicUsage): AiCost {
  const p = PRICING[model];
  if (!p) return { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 };
  const inputCostUsd =
    usage.inputTokens * p.input +
    (usage.cacheReadTokens ?? 0) * p.cacheRead +
    (usage.cacheCreationTokens ?? 0) * p.cacheWrite;
  const outputCostUsd = usage.outputTokens * p.output;
  const webCostUsd = (usage.webSearches ?? 0) * WEB_SEARCH_COST_USD;
  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd + webCostUsd,
  };
}

/** Low-level: POST one event to PostHog. Never throws. Awaited, so the event is sent before the action returns. */
async function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  if (!POSTHOG_KEY) return;
  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Analytics is best-effort and must never break a generation.
    console.warn("[posthog] capture failed", event, String(err));
  }
}

/** A generic backend product event (e.g. user_signed_up fired server-side for the activation funnel). */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  await capture(distinctId, event, { $lib: "convex", ...properties });
}

export interface AiGenerationEvent {
  /** Convex user id when known; falls back to a stable anonymous bucket otherwise. */
  distinctId?: string;
  /** Conversation/run id — groups generations into one trace in LLM analytics. */
  traceId: string;
  /** Short label for what this call is (itinerary, dining, day_plan, refinement, …). */
  purpose: string;
  model: string;
  usage: AnthropicUsage;
  /** Wall-clock latency in seconds. */
  latencySeconds?: number;
  httpStatus?: number;
  isError?: boolean;
  error?: string;
  maxTokens?: number;
  /** Optional correlations surfaced as plain properties for product analytics. */
  tripId?: string;
  planId?: string;
}

/**
 * Capture one LLM call as a PostHog `$ai_generation` event. Sends the standard
 * `$ai_*` schema (model, provider, tokens, latency, cost) so the call shows up in
 * PostHog's LLM Analytics, AND a few flat properties (purpose, tripId, planId) so
 * it's queryable as an ordinary product event. Cost is computed locally and sent
 * explicitly so it's correct even for a model id PostHog's price map doesn't know.
 */
export async function captureAIGeneration(ev: AiGenerationEvent): Promise<void> {
  if (!POSTHOG_KEY) return;
  const cost = aiCostUsd(ev.model, ev.usage);
  const distinctId = ev.distinctId ?? "server:anonymous";

  await capture(distinctId, "$ai_generation", {
    $ai_trace_id: ev.traceId,
    $ai_span_name: ev.purpose,
    $ai_model: ev.model,
    $ai_provider: "anthropic",
    $ai_base_url: "https://api.anthropic.com",
    $ai_input_tokens: ev.usage.inputTokens,
    $ai_output_tokens: ev.usage.outputTokens,
    $ai_cache_read_input_tokens: ev.usage.cacheReadTokens ?? 0,
    $ai_cache_creation_input_tokens: ev.usage.cacheCreationTokens ?? 0,
    $ai_input_cost_usd: cost.inputCostUsd,
    $ai_output_cost_usd: cost.outputCostUsd,
    $ai_total_cost_usd: cost.totalCostUsd,
    ...(ev.usage.webSearches ? { $ai_web_search_count: ev.usage.webSearches } : {}),
    ...(ev.latencySeconds != null ? { $ai_latency: ev.latencySeconds } : {}),
    ...(ev.httpStatus != null ? { $ai_http_status: ev.httpStatus } : {}),
    ...(ev.isError ? { $ai_is_error: true } : {}),
    ...(ev.error ? { $ai_error: ev.error } : {}),
    ...(ev.maxTokens != null ? { $ai_max_tokens: ev.maxTokens } : {}),
    // Flat product-analytics correlations.
    purpose: ev.purpose,
    ...(ev.tripId ? { tripId: ev.tripId } : {}),
    ...(ev.planId ? { planId: ev.planId } : {}),
    $lib: "convex",
  });
}

// convex/lib/voyage.ts
//
// Voyage AI embeddings for the visa RAG corpus.
//
// Raw fetch, no SDK — matching every other LLM call in this backend
// (lib/anthropicStream.ts, tripRefinement.ts, lib/posthog.ts). Deliberately NO
// "use node": fetch works in Convex's default runtime, and the guidelines are
// explicit that you don't reach for the Node runtime just to call an HTTP API.
// This file exports only helpers, no Convex functions, so it's importable from
// any action.
//
// Model choice: voyage-4, 1024 dimensions (the model default, and what
// visaChunks.by_embedding is built for). voyage-3.5 costs the same $0.06/1M but
// is superseded and carries no free-token allowance; voyage-4 includes the
// first 200M tokens free, which covers this entire corpus many times over.
// Docs: https://docs.voyageai.com/reference/embeddings-api

import { captureEmbedding } from "./posthog";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export const EMBEDDING_MODEL = "voyage-4";
/** Must equal visaChunks.by_embedding's `dimensions`. Changing one without the
 *  other is a deploy-time schema error, which is the failure mode we want. */
export const EMBEDDING_DIMENSIONS = 1024;

// Voyage caps a request at 1,000 inputs and 320K tokens for voyage-4. We batch
// far below both: 64 keeps any single failed request cheap to retry, and keeps
// the resulting vectors comfortably inside Convex's 5 MiB action-argument limit
// when they're handed to a write mutation (64 × 1024 floats ≈ 1.3 MB of JSON).
export const EMBED_BATCH_SIZE = 64;
/** Secondary guard: whichever binds first, count or characters. */
const MAX_BATCH_CHARS = 400_000;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

interface VoyageEmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}

interface VoyageResponse {
  object: string;
  data: VoyageEmbeddingData[];
  model: string;
  usage?: { total_tokens?: number };
}

export interface EmbedResult {
  /** Same order as the input array. */
  embeddings: number[][];
  tokens: number;
  model: string;
}

export interface EmbedOptions {
  /** Forwarded to PostHog so corpus spend is attributable per tier. */
  purpose: string;
  traceId: string;
  distinctId?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One Voyage request. `inputType` is passed positionally by the two public
 * wrappers below and is never caller-controlled — see the note on
 * `embedDocuments`.
 */
async function embedBatch(
  texts: string[],
  inputType: "document" | "query",
  opts: EmbedOptions
): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY is not set on the Convex deployment. Set it with: npx convex env set VOYAGE_API_KEY <key>"
    );
  }
  if (texts.length === 0) {
    return { embeddings: [], tokens: 0, model: EMBEDDING_MODEL };
  }

  const startedAt = Date.now();
  let lastError = "";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
          input_type: inputType,
          // Over-length inputs are clipped rather than erroring the whole
          // batch. The chunker already keeps us far under the limit; this is
          // just so one pathological page can't fail an entire crawl batch.
          truncation: true,
        }),
        signal: controller.signal,
      });
      lastStatus = res.status;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastError = `Voyage ${res.status}: ${body.slice(0, 300)}`;
        // 4xx other than 429 is a bad request — retrying sends the identical
        // body and fails identically. Only back off on rate limits and 5xx.
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) throw new Error(lastError);

        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2 ** attempt * 500 + Math.floor(Math.random() * 250);
        await sleep(backoff);
        continue;
      }

      const json = (await res.json()) as VoyageResponse;
      const data = json.data ?? [];
      if (data.length !== texts.length) {
        throw new Error(
          `Voyage returned ${data.length} embeddings for ${texts.length} inputs`
        );
      }

      // Sort by the returned index rather than trusting response order. Free
      // insurance against a silent misalignment between chunk text and vector,
      // which would corrupt the index in a way no test would catch later.
      const ordered = [...data].sort((a, b) => a.index - b.index);
      const embeddings = ordered.map((d) => d.embedding);

      for (const vec of embeddings) {
        if (vec.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Voyage returned ${vec.length}-dim vector, expected ${EMBEDDING_DIMENSIONS}`
          );
        }
      }

      const tokens = json.usage?.total_tokens ?? 0;
      await captureEmbedding({
        traceId: opts.traceId,
        purpose: opts.purpose,
        distinctId: opts.distinctId,
        model: EMBEDDING_MODEL,
        tokens,
        inputCount: texts.length,
        latencySeconds: (Date.now() - startedAt) / 1000,
        httpStatus: lastStatus,
      });

      return { embeddings, tokens, model: EMBEDDING_MODEL };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const isAbort = lastError.includes("abort");
      if (attempt === MAX_ATTEMPTS || (!isAbort && lastStatus > 0 && lastStatus < 500 && lastStatus !== 429)) {
        await captureEmbedding({
          traceId: opts.traceId,
          purpose: opts.purpose,
          distinctId: opts.distinctId,
          model: EMBEDDING_MODEL,
          tokens: 0,
          inputCount: texts.length,
          latencySeconds: (Date.now() - startedAt) / 1000,
          httpStatus: lastStatus || undefined,
          isError: true,
          error: lastError,
        });
        throw new Error(lastError);
      }
      await sleep(2 ** attempt * 500 + Math.floor(Math.random() * 250));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError || "Voyage request failed");
}

/** Split into batches bounded by BOTH count and total characters. */
function batched(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let chars = 0;

  for (const text of texts) {
    const wouldExceed =
      current.length >= EMBED_BATCH_SIZE ||
      (current.length > 0 && chars + text.length > MAX_BATCH_CHARS);
    if (wouldExceed) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Embed corpus text for storage.
 *
 * Why this is a separate function from `embedQuery` rather than one function
 * with an `inputType` argument: Voyage prepends a different instruction prefix
 * for documents vs queries, and mismatching them degrades recall measurably
 * while failing completely silently — no error, no exception, just quietly
 * worse results. Making it impossible to pass the wrong value is worth the
 * duplicated wrapper.
 */
export async function embedDocuments(
  texts: string[],
  opts: EmbedOptions
): Promise<EmbedResult> {
  const all: number[][] = [];
  let tokens = 0;
  for (const batch of batched(texts)) {
    const result = await embedBatch(batch, "document", opts);
    all.push(...result.embeddings);
    tokens += result.tokens;
  }
  return { embeddings: all, tokens, model: EMBEDDING_MODEL };
}

/** Embed a single user question for retrieval. See `embedDocuments` on why the split. */
export async function embedQuery(
  text: string,
  opts: EmbedOptions
): Promise<{ embedding: number[]; tokens: number }> {
  const result = await embedBatch([text], "query", opts);
  return { embedding: result.embeddings[0], tokens: result.tokens };
}

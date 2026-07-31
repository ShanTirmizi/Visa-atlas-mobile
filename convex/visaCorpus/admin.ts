// convex/visaCorpus/admin.ts
//
// Operator-facing internal actions for the visa RAG corpus: verify the
// embeddings provider is reachable, and inspect corpus health. Internal only —
// these burn API credits and expose cross-user counts, so they must never be
// callable from a client. Run them with `npx convex run`.

import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  embedDocuments,
  embedQuery,
} from "../lib/voyage";

/**
 * End-to-end check that VOYAGE_API_KEY is set, the model answers, and the
 * vectors match the dimension the schema's vector index was built for.
 *
 * Also asserts the query/document distinction is actually doing something: the
 * two input types prepend different instruction prefixes, so embedding the same
 * text both ways must NOT produce an identical vector. If it does, the
 * input_type parameter is being ignored and retrieval quality is silently
 * degraded — exactly the failure this design is trying to prevent.
 *
 *   npx convex run visaCorpus/admin:embedSmokeTest
 */
export const embedSmokeTest = internalAction({
  args: { text: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    const text =
      args.text ??
      "Thailand entry requirements for an Indian passport holder: permitted stay and visa category.";

    const doc = await embedDocuments([text], {
      purpose: "smoke_test",
      traceId: "smoke",
    });
    const query = await embedQuery(text, {
      purpose: "smoke_test",
      traceId: "smoke",
    });

    const docVec = doc.embeddings[0];
    const queryVec = query.embedding;

    // Cosine between the two encodings of the same string. Expect high but
    // strictly below 1.0.
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < docVec.length; i++) {
      dot += docVec[i] * queryVec[i];
      magA += docVec[i] * docVec[i];
      magB += queryVec[i] * queryVec[i];
    }
    const cosine = dot / (Math.sqrt(magA) * Math.sqrt(magB));

    return {
      model: EMBEDDING_MODEL,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      actualDimensions: docVec.length,
      dimensionsMatch: docVec.length === EMBEDDING_DIMENSIONS,
      documentTokens: doc.tokens,
      queryTokens: query.tokens,
      docVsQueryCosine: Number(cosine.toFixed(6)),
      // The assertion that matters: if this is false, input_type is a no-op.
      inputTypeIsHonoured: cosine < 0.999999,
      sample: docVec.slice(0, 4).map((n) => Number(n.toFixed(6))),
    };
  },
});

/** Corpus counts by tier and status. Cheap operator visibility into ingestion. */
export const _corpusStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Bounded: the corpus is ~300 sources, and .take() keeps this honest even
    // if a runaway crawl ever inflates it (guidelines: never unbounded collect).
    const sources = await ctx.db.query("visaSources").take(2000);

    const byTier: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let chunkTotal = 0;
    for (const s of sources) {
      byTier[s.tier] = (byTier[s.tier] ?? 0) + 1;
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      chunkTotal += s.chunkCount ?? 0;
    }

    return {
      sources: sources.length,
      chunksFromSourceCounters: chunkTotal,
      byTier,
      byStatus,
    };
  },
});

/**
 * Sources that failed or were rejected by the crawl quality gate, so a bad
 * origin surfaces instead of quietly contributing nothing.
 *
 *   npx convex run visaCorpus/admin:listProblemSources
 */
export const _listProblemSources = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    const failed = await ctx.db
      .query("visaSources")
      .withIndex("by_status_and_nextCheckAt", (q) => q.eq("status", "failed"))
      .take(limit);
    const blocked = await ctx.db
      .query("visaSources")
      .withIndex("by_status_and_nextCheckAt", (q) => q.eq("status", "blocked"))
      .take(limit);

    return [...failed, ...blocked].map((s) => ({
      externalId: s.externalId,
      url: s.url,
      status: s.status,
      httpStatus: s.httpStatus,
      failureCount: s.failureCount ?? 0,
      errorMessage: s.errorMessage,
    }));
  },
});

export const corpusStats = internalAction({
  args: {},
  handler: async (ctx): Promise<unknown> =>
    await ctx.runQuery(internal.visaCorpus.admin._corpusStats, {}),
});

export const listProblemSources = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<unknown> =>
    await ctx.runQuery(internal.visaCorpus.admin._listProblemSources, args),
});

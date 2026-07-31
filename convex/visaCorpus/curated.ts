// convex/visaCorpus/curated.ts
//
// Tier A ingest: the curated in-repo datasets (data/visaData.ts +
// data/localInfo.ts) into visaSources / visaChunks.
//
// Shape follows the house pattern for long-running work: an action does a
// bounded slice, writes through internal mutations, then schedules itself for
// the next slice (guidelines: batch + ctx.scheduler.runAfter self-continuation
// rather than one transaction that blows its limits).
//
// Idempotent by construction. Re-running is cheap and safe:
//   - unchanged document (same docHash)  → no chunking, no embedding at all
//   - changed document                   → only chunks whose contentHash moved
//                                          are re-embedded; the rest are kept
// So a full re-run after editing one country costs a handful of embeddings.

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  type ActionCtx,
} from "../_generated/server";
import { chunkDocument, contentHash } from "../lib/chunker";
import { buildAllCuratedDocs, type CuratedDoc } from "../lib/curatedDocs";
import { EMBEDDING_MODEL, embedDocuments } from "../lib/voyage";
import { ownerScopeFor, pubScope } from "../lib/visaScope";

/** Documents per action invocation. Each yields ~1-3 chunks, so a batch is
 *  ~40-120 embeddings — one or two Voyage calls, a few seconds of wall clock,
 *  far inside the action time budget. */
const DOCS_PER_BATCH = 40;

/** Chunks per write mutation. A 1024-float vector is ~20 KB of JSON, so 32
 *  keeps each call ~640 KB — well under Convex's 5 MiB action-argument cap,
 *  which is the limit that actually bites here (not action wall-clock). */
const CHUNKS_PER_WRITE = 32;

// ── Internal writes ─────────────────────────────────────────────────────────

/**
 * Create or update the source row. Returns `changed: false` when the rendered
 * text is byte-identical to what we already stored, which lets the caller skip
 * chunking and embedding entirely.
 */
export const _upsertSource = internalMutation({
  args: {
    externalId: v.string(),
    countryCode: v.string(),
    title: v.string(),
    label: v.string(),
    url: v.optional(v.string()),
    asOf: v.string(),
    text: v.string(),
    docHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visaSources")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    const now = Date.now();

    if (existing) {
      const unchanged =
        existing.docHash === args.docHash && existing.status === "ready";
      await ctx.db.patch(existing._id, {
        title: args.title,
        label: args.label,
        url: args.url,
        asOf: args.asOf,
        extractedText: args.text,
        docHash: args.docHash,
        lastIngestedAt: now,
        ...(unchanged
          ? {}
          : { contentVersion: existing.contentVersion + 1, status: "ready" as const }),
      });
      return { sourceId: existing._id, changed: !unchanged };
    }

    const sourceId = await ctx.db.insert("visaSources", {
      tier: "curated",
      externalId: args.externalId,
      countryCode: args.countryCode,
      title: args.title,
      label: args.label,
      url: args.url,
      asOf: args.asOf,
      status: "ready",
      docHash: args.docHash,
      extractedText: args.text,
      lastIngestedAt: now,
      contentVersion: 1,
    });
    return { sourceId, changed: true };
  },
});

/**
 * Which of this source's chunk hashes already exist. The caller embeds only the
 * misses — editing one section of a document costs one embedding, not a full
 * re-embed of every chunk in it.
 */
export const _existingChunkHashes = internalMutation({
  args: { sourceId: v.id("visaSources") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("visaChunks")
      .withIndex("by_sourceId_and_ordinal", (q) => q.eq("sourceId", args.sourceId))
      .take(500);
    return rows.map((r) => ({ id: r._id, contentHash: r.contentHash }));
  },
});

export const _writeChunks = internalMutation({
  args: {
    sourceId: v.id("visaSources"),
    chunks: v.array(
      v.object({
        text: v.string(),
        heading: v.optional(v.string()),
        ordinal: v.number(),
        contentHash: v.string(),
        embedding: v.array(v.float64()),
      })
    ),
    scope: v.string(),
    ownerScope: v.string(),
    countryCode: v.string(),
    sourceLabel: v.string(),
    sourceUrl: v.optional(v.string()),
    asOf: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const chunk of args.chunks) {
      await ctx.db.insert("visaChunks", {
        sourceId: args.sourceId,
        scope: args.scope,
        ownerScope: args.ownerScope,
        text: chunk.text,
        heading: chunk.heading,
        ordinal: chunk.ordinal,
        contentHash: chunk.contentHash,
        tier: "curated",
        countryCode: args.countryCode,
        sourceLabel: args.sourceLabel,
        sourceUrl: args.sourceUrl,
        asOf: args.asOf,
        embedding: chunk.embedding,
        embeddingModel: EMBEDDING_MODEL,
        embeddedAt: now,
      });
    }
    return args.chunks.length;
  },
});

/** Drop chunks that no longer appear in the freshly rendered document. */
export const _deleteChunks = internalMutation({
  args: { ids: v.array(v.id("visaChunks")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) await ctx.db.delete(id);
    return args.ids.length;
  },
});

export const _setChunkCount = internalMutation({
  args: { sourceId: v.id("visaSources"), chunkCount: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, { chunkCount: args.chunkCount });
  },
});

// ── Run bookkeeping ─────────────────────────────────────────────────────────

export const _startRun = internalMutation({
  args: { kind: v.literal("curated") },
  handler: async (ctx, args) =>
    await ctx.db.insert("visaIngestRuns", {
      kind: args.kind,
      status: "running",
      processed: 0,
      failed: 0,
      chunksWritten: 0,
      tokensEmbedded: 0,
      startedAt: Date.now(),
    }),
});

export const _advanceRun = internalMutation({
  args: {
    runId: v.id("visaIngestRuns"),
    cursor: v.optional(v.string()),
    processed: v.number(),
    failed: v.number(),
    chunksWritten: v.number(),
    tokensEmbedded: v.number(),
    done: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return; // run was deleted mid-flight; nothing to settle
    await ctx.db.patch(args.runId, {
      cursor: args.cursor,
      processed: run.processed + args.processed,
      failed: run.failed + args.failed,
      chunksWritten: run.chunksWritten + args.chunksWritten,
      tokensEmbedded: run.tokensEmbedded + args.tokensEmbedded,
      ...(args.done
        ? {
            status: args.errorMessage ? ("failed" as const) : ("done" as const),
            finishedAt: Date.now(),
            errorMessage: args.errorMessage,
          }
        : {}),
    });
  },
});

// ── The ingest action ───────────────────────────────────────────────────────

/**
 * Ingest one batch of curated documents, then schedule the next.
 *
 *   npx convex run visaCorpus/curated:ingestCurated '{}'
 *
 * `cursor` is an index into buildAllCuratedDocs(), which is sorted by
 * externalId and fully deterministic — so resuming after a scheduler hop can
 * neither skip nor duplicate a document.
 */
export const ingestCurated = internalAction({
  args: {
    runId: v.optional(v.id("visaIngestRuns")),
    cursor: v.optional(v.number()),
    /** Cap the corpus for a smoke run. Omit for a full ingest. */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ runId: Id<"visaIngestRuns">; done: boolean; processed: number }> => {
    const runId =
      args.runId ??
      (await ctx.runMutation(internal.visaCorpus.curated._startRun, {
        kind: "curated",
      }));

    const all = buildAllCuratedDocs();
    const docs = args.limit ? all.slice(0, args.limit) : all;
    const start = args.cursor ?? 0;
    const batch = docs.slice(start, start + DOCS_PER_BATCH);

    let processed = 0;
    let failed = 0;
    let chunksWritten = 0;
    let tokensEmbedded = 0;

    for (const doc of batch) {
      try {
        const written = await ingestOne(ctx, runId, doc);
        chunksWritten += written.chunks;
        tokensEmbedded += written.tokens;
        processed += 1;
      } catch (err) {
        // One bad document must not abort the run — record and continue.
        failed += 1;
        console.error(
          `[curated] ${doc.externalId} failed:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    const nextCursor = start + batch.length;
    const done = nextCursor >= docs.length;

    await ctx.runMutation(internal.visaCorpus.curated._advanceRun, {
      runId,
      cursor: String(nextCursor),
      processed,
      failed,
      chunksWritten,
      tokensEmbedded,
      done,
    });

    if (!done) {
      await ctx.scheduler.runAfter(0, internal.visaCorpus.curated.ingestCurated, {
        runId,
        cursor: nextCursor,
        limit: args.limit,
      });
    }

    return { runId, done, processed };
  },
});

interface ExistingChunk {
  id: Id<"visaChunks">;
  contentHash: string;
}

/** Ingest a single curated document. Returns what it actually cost. */
async function ingestOne(
  ctx: ActionCtx,
  runId: Id<"visaIngestRuns">,
  doc: CuratedDoc
): Promise<{ chunks: number; tokens: number }> {
  const docHash = contentHash(doc.text);

  const { sourceId, changed } = await ctx.runMutation(
    internal.visaCorpus.curated._upsertSource,
    {
      externalId: doc.externalId,
      countryCode: doc.countryCode,
      title: doc.title,
      label: doc.label,
      url: doc.url,
      asOf: doc.asOf,
      text: doc.text,
      docHash,
    }
  );

  // Unchanged since last ingest — nothing to chunk, nothing to embed.
  if (!changed) return { chunks: 0, tokens: 0 };

  const chunks = chunkDocument({ text: doc.text, breadcrumb: doc.breadcrumb });
  if (chunks.length === 0) return { chunks: 0, tokens: 0 };

  const hashed = chunks.map((c) => ({ ...c, contentHash: contentHash(c.text) }));

  const existing: ExistingChunk[] = await ctx.runMutation(
    internal.visaCorpus.curated._existingChunkHashes,
    { sourceId }
  );
  const existingByHash = new Map(existing.map((e) => [e.contentHash, e.id]));
  const keptHashes = new Set<string>();
  const toEmbed = hashed.filter((c) => {
    if (existingByHash.has(c.contentHash)) {
      keptHashes.add(c.contentHash);
      return false;
    }
    return true;
  });

  // Anything present before but absent now is stale — remove it, or a corrected
  // fee would linger alongside its replacement and both would be retrievable.
  const stale = existing
    .filter((e) => !keptHashes.has(e.contentHash))
    .map((e) => e.id);
  if (stale.length > 0) {
    await ctx.runMutation(internal.visaCorpus.curated._deleteChunks, {
      ids: stale,
    });
  }

  let tokens = 0;
  if (toEmbed.length > 0) {
    const embedded = await embedDocuments(
      toEmbed.map((c) => c.text),
      { purpose: "corpus_curated", traceId: runId }
    );
    tokens = embedded.tokens;

    const rows = toEmbed.map((c, i) => ({
      text: c.text,
      heading: c.heading,
      ordinal: c.ordinal,
      contentHash: c.contentHash,
      embedding: embedded.embeddings[i],
    }));

    for (let i = 0; i < rows.length; i += CHUNKS_PER_WRITE) {
      await ctx.runMutation(internal.visaCorpus.curated._writeChunks, {
        sourceId,
        chunks: rows.slice(i, i + CHUNKS_PER_WRITE),
        scope: pubScope(doc.countryCode),
        ownerScope: ownerScopeFor(),
        countryCode: doc.countryCode,
        sourceLabel: doc.label,
        sourceUrl: doc.url,
        asOf: doc.asOf,
      });
    }
  }

  await ctx.runMutation(internal.visaCorpus.curated._setChunkCount, {
    sourceId,
    chunkCount: hashed.length,
  });

  return { chunks: toEmbed.length, tokens };
}

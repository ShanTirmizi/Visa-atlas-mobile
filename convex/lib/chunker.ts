// convex/lib/chunker.ts
//
// Splits a document into embeddable chunks. Shared by all three corpus tiers
// (curated data, user guides, crawled official pages) so retrieval behaves
// identically regardless of where the text came from.
//
// Two properties matter more than the exact sizes:
//
//  1. DETERMINISM. Same input must always produce the same chunks, byte for
//     byte. `contentHash` is what lets a re-crawl skip re-embedding unchanged
//     sections, so any nondeterminism here silently turns every refresh into a
//     full re-embed of the corpus.
//
//  2. THE BREADCRUMB. Each chunk is embedded with a "Thailand — Tourist visa —
//     gov.uk" prefix. Retrieval chunks are short and frequently lose their
//     subject ("...the fee is £127" — a fee for what, where?). Prefixing the
//     context is a cheap approximation of Anthropic's contextual-retrieval
//     result and measurably lifts recall. We store the EXACT embedded string,
//     prefix included, so re-embedding is reproducible.

/** Target size in characters. ~350 tokens — small enough to stay on-topic,
 *  large enough to carry a complete requirement (fee + validity + entries). */
export const TARGET_CHARS = 1400;
/** Overlap between adjacent chunks, so a fact split across a boundary still
 *  appears whole in one of them. */
export const OVERLAP_CHARS = 210; // ~15%
/** Anything longer than this is force-split even without a sentence boundary. */
export const MAX_CHARS = 6000;
/** Below this a chunk is noise (a stray heading, a nav crumb). */
export const MIN_CHARS = 120;

export interface ChunkInput {
  text: string;
  /** Rendered as the embedded prefix, e.g. ["Thailand", "Tourist visa", "gov.uk"]. */
  breadcrumb?: string[];
}

export interface Chunk {
  /** EXACTLY what gets embedded and stored — breadcrumb included. */
  text: string;
  /** The breadcrumb line on its own, for display/debugging. */
  heading?: string;
  ordinal: number;
}

/** Collapse whitespace without destroying paragraph structure. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildBreadcrumb(parts?: string[]): string | undefined {
  if (!parts || parts.length === 0) return undefined;
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(" — ") : undefined;
}

/**
 * Split on the "## " headings our HTML extractor emits, keeping each heading
 * attached to the prose beneath it. A document with no headings is one section.
 */
function splitIntoSections(text: string): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line) && current.some((l) => l.trim())) {
      sections.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.some((l) => l.trim())) sections.push(current.join("\n").trim());
  return sections.filter(Boolean);
}

/** Sentence-ish boundaries. Kept deliberately simple and dependency-free. */
function splitIntoSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?:])\s+(?=[A-Z0-9£$€"'\-•])|\n+/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Pack sentences up to TARGET_CHARS, never splitting mid-sentence unless a
 * single sentence exceeds MAX_CHARS (then it's hard-split, since an
 * unsplittable 20 KB run of text would otherwise blow the embedding call).
 */
function packSentences(section: string): string[] {
  if (section.length <= TARGET_CHARS) return [section];

  const sentences = splitIntoSentences(section);
  const packed: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHARS) {
      if (current) {
        packed.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += MAX_CHARS) {
        packed.push(sentence.slice(i, i + MAX_CHARS));
      }
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > TARGET_CHARS && current) {
      packed.push(current);
      // Carry a tail of the previous chunk forward so a fact spanning the
      // boundary survives intact in at least one chunk.
      const tail = current.slice(-OVERLAP_CHARS);
      const tailStart = tail.search(/[A-Z0-9]/);
      current = (tailStart >= 0 ? tail.slice(tailStart) : "") + " " + sentence;
      current = current.trim();
    } else {
      current = candidate;
    }
  }
  if (current.trim()) packed.push(current.trim());
  return packed;
}

/**
 * Chunk a document. Returns [] for text that is entirely below MIN_CHARS —
 * callers treat that as "nothing worth indexing" rather than an error.
 */
export function chunkDocument(input: ChunkInput): Chunk[] {
  const normalized = normalizeText(input.text);
  if (!normalized) return [];

  const heading = buildBreadcrumb(input.breadcrumb);
  const prefix = heading ? `${heading}\n\n` : "";

  const pieces: string[] = [];
  for (const section of splitIntoSections(normalized)) {
    pieces.push(...packSentences(section));
  }

  const chunks: Chunk[] = [];
  for (const piece of pieces) {
    const body = piece.trim();
    // Measure the body, not the prefix — otherwise a long breadcrumb would
    // rescue chunks that are pure noise.
    if (body.length < MIN_CHARS) continue;
    chunks.push({
      text: `${prefix}${body}`,
      heading,
      ordinal: chunks.length,
    });
  }

  // A short document is still worth indexing if it's all we have — the
  // MIN_CHARS filter is there to drop fragments, not whole small documents.
  if (chunks.length === 0 && normalized.length > 0) {
    return [{ text: `${prefix}${normalized}`, heading, ordinal: 0 }];
  }
  return chunks;
}

// ── Content hashing ─────────────────────────────────────────────────────────
// Used for two things: skip re-embedding unchanged chunks on a re-crawl, and
// detect that a whole document is unchanged before doing any work at all.

/**
 * FNV-1a 64-bit, rendered as hex.
 *
 * Deliberately NOT crypto.subtle.digest: that is async, and hashing is called
 * per-chunk from synchronous pure code that is jest-tested without a runtime.
 * Collision resistance against an adversary is irrelevant here — hashes are
 * only ever compared within a single sourceId to answer "did this text
 * change?", so the cost of a collision is one stale chunk, not a security
 * property.
 */
export function contentHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c << 3) | (c >>> 5);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return (
    h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
  );
}

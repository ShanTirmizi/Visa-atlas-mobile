import type { Id } from "../_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval scope strings — the multi-tenancy boundary for the RAG corpus.
//
// Convex's vector-search filter builder supports ONLY `q.eq` and `q.or`. There
// is no `and` (see node_modules/convex/dist/*/server/vector_search.d.ts). So
// "public chunks for Thailand OR this user's own Thailand chunks" cannot be
// expressed as a conjunction — every AND condition has to be pre-joined into a
// single denormalized string, which is what these helpers produce.
//
// Why this matters more than it looks: `limit` is applied by the index scan
// BEFORE any post-filter we could write in application code. Filtering after
// the fact would silently shrink result sets (ask for 24, get 6 back because 18
// belonged to someone else) — and worse, it would mean another user's chunks
// were read at all. Baking tenancy into the indexed filter keeps the isolation
// inside the scan.
//
// Format:
//   pub:*          public, country-agnostic
//   pub:THA        public, Thailand
//   usr:<id>:THA   private to one user, Thailand
//
// The `usr:` prefix is what makes cross-tenant collision impossible: a scope
// string containing user B's id can never appear in the allowlist built for
// user A. See convex/lib/__tests__/visaScope.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Sentinel country for corpus entries that apply everywhere. */
export const GLOBAL_COUNTRY = "*";

/**
 * Country codes are alpha-3 and case-normalized on both the write and read
 * path. Without this, a chunk written as "tha" would be invisible to a search
 * for "THA" — a silent recall hole rather than a loud failure.
 *
 * The `:` strip is load-bearing, not cosmetic. `usr:<id>:<country>` is parsed
 * positionally, so a country value that itself contained a colon could forge a
 * different user's scope string: userScope("a", "B:C") and userScope("a:B",
 * "C") would both render "usr:a:B:C". Convex ids are alphanumeric so the
 * second form can't occur today, but stripping the delimiter here makes the
 * invariant structural instead of assumed.
 */
export function normalizeCountry(countryCode: string): string {
  return countryCode.trim().toUpperCase().replace(/[^A-Z0-9*]/g, "");
}

/** Public chunks for one country. */
export function pubScope(countryCode: string): string {
  return `pub:${normalizeCountry(countryCode)}`;
}

/** Public chunks that apply regardless of destination. */
export function pubGlobal(): string {
  return `pub:${GLOBAL_COUNTRY}`;
}

/** Private chunks belonging to exactly one user, for one country. */
export function userScope(userId: Id<"users">, countryCode: string): string {
  return `usr:${userId}:${normalizeCountry(countryCode)}`;
}

/**
 * The coarse owner key stored alongside `scope`. Backs two things: an
 * unscoped-by-country search (expressible as a single eq, no AND needed), and
 * the defense-in-depth ownership re-check applied during hydration.
 */
export function ownerScopeFor(userId?: Id<"users">): string {
  return userId ? `usr:${userId}` : "pub";
}

/**
 * Every scope string a given user is allowed to retrieve from, for a given set
 * of destinations. This is the complete allowlist — anything not returned here
 * cannot match, because the filter is `or(eq(scope, s) for s in allowlist)`.
 *
 * Deduped and order-stable so the resulting filter (and any test asserting on
 * it) is deterministic.
 */
export function scopeAllowlist(
  userId: Id<"users">,
  countryCodes: string[]
): string[] {
  const out: string[] = [pubGlobal()];
  const seen = new Set(out);

  for (const raw of countryCodes) {
    if (!raw || !raw.trim()) continue;
    for (const scope of [pubScope(raw), userScope(userId, raw)]) {
      if (!seen.has(scope)) {
        seen.add(scope);
        out.push(scope);
      }
    }
  }
  return out;
}

/**
 * Defense in depth. `scopeAllowlist` is only as correct as the writer that
 * built each chunk's `scope` string; a writer bug would otherwise leak across
 * tenants silently. Re-checking `ownerScope` at hydration downgrades that class
 * of bug from "user A reads user B's private guide" to "a result is dropped".
 *
 * Call this on every chunk returned from a vector search before it reaches a
 * prompt.
 */
export function canUserReadOwnerScope(
  userId: Id<"users">,
  ownerScope: string
): boolean {
  return ownerScope === "pub" || ownerScope === ownerScopeFor(userId);
}

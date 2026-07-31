import type { Id } from "../../_generated/dataModel";
import {
  GLOBAL_COUNTRY,
  canUserReadOwnerScope,
  normalizeCountry,
  ownerScopeFor,
  pubGlobal,
  pubScope,
  scopeAllowlist,
  userScope,
} from "../visaScope";

// Convex ids are opaque branded strings; in a pure-logic test we only care
// about their textual behaviour.
const uid = (s: string) => s as Id<"users">;

const USER_A = uid("jd7abc123def456ghi789jkl");
const USER_B = uid("jd7zzz999yyy888xxx777www");

describe("normalizeCountry", () => {
  it("upper-cases and trims so 'tha' and 'THA' address the same chunks", () => {
    expect(normalizeCountry(" tha ")).toBe("THA");
    expect(normalizeCountry("Tha")).toBe("THA");
  });

  it("preserves the global sentinel", () => {
    expect(normalizeCountry(GLOBAL_COUNTRY)).toBe("*");
  });

  it("strips the scope delimiter so a country can't forge a user segment", () => {
    // Without this, userScope(A, "B:C") and userScope("A:B", "C") collide.
    expect(normalizeCountry("B:C")).toBe("BC");
    expect(normalizeCountry("../../etc")).toBe("ETC");
  });
});

describe("scope builders", () => {
  it("namespaces public and private scopes under distinct prefixes", () => {
    expect(pubScope("THA")).toBe("pub:THA");
    expect(pubGlobal()).toBe("pub:*");
    expect(userScope(USER_A, "THA")).toBe(`usr:${USER_A}:THA`);
  });

  it("derives owner scope from presence of a user", () => {
    expect(ownerScopeFor()).toBe("pub");
    expect(ownerScopeFor(USER_A)).toBe(`usr:${USER_A}`);
  });
});

describe("scopeAllowlist", () => {
  it("always includes the global public scope", () => {
    expect(scopeAllowlist(USER_A, ["THA"])).toContain("pub:*");
  });

  it("includes public + own-private scope for each country", () => {
    expect(scopeAllowlist(USER_A, ["THA", "JPN"])).toEqual([
      "pub:*",
      "pub:THA",
      `usr:${USER_A}:THA`,
      "pub:JPN",
      `usr:${USER_A}:JPN`,
    ]);
  });

  it("dedupes repeated and differently-cased countries", () => {
    const list = scopeAllowlist(USER_A, ["THA", "tha", " THA "]);
    expect(list).toEqual(["pub:*", "pub:THA", `usr:${USER_A}:THA`]);
    expect(new Set(list).size).toBe(list.length);
  });

  it("skips empty and whitespace-only country codes", () => {
    expect(scopeAllowlist(USER_A, ["", "   "])).toEqual(["pub:*"]);
  });

  it("returns only the global scope when no countries are given", () => {
    expect(scopeAllowlist(USER_A, [])).toEqual(["pub:*"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The regression that matters. Retrieval filters with
// `or(eq(scope, s) for s in scopeAllowlist(...))`, so if a string another user's
// writer can produce ever lands in this list, that user's private guide chunks
// get read straight into someone else's prompt. Everything below asserts that
// cannot happen.
// ─────────────────────────────────────────────────────────────────────────────
describe("cross-tenant isolation", () => {
  const COUNTRIES = ["THA", "JPN", "USA", "GBR", "*"];

  it("never admits another user's private scope, across many countries", () => {
    const allowed = new Set(scopeAllowlist(USER_A, COUNTRIES));
    for (const cc of COUNTRIES) {
      expect(allowed.has(userScope(USER_B, cc))).toBe(false);
    }
  });

  it("holds for adversarial user ids", () => {
    const hostile = [
      uid("a:b"), // embedded delimiter
      uid("*"), // the global sentinel
      uid(`${USER_A}:THA`), // A's own scope tail appended
      uid(""), // empty
      uid("pub"), // tries to masquerade as the public owner scope
    ];

    for (const other of hostile) {
      const allowed = new Set(scopeAllowlist(USER_A, COUNTRIES));
      for (const cc of COUNTRIES) {
        // The only legitimate overlap is a user compared against themselves.
        if (String(other) === String(USER_A)) continue;
        expect(allowed.has(userScope(other, cc))).toBe(false);
      }
    }
  });

  it("does not let a crafted country code forge another user's scope", () => {
    // The collision this defends: "usr:<A>:THA" reachable by some other
    // (user, country) pair. normalizeCountry strips ':' so the tail can never
    // introduce a new segment.
    const forged = userScope(USER_B, `${USER_A}:THA`);
    expect(scopeAllowlist(USER_A, ["THA"])).not.toContain(forged);
    expect(forged.startsWith(`usr:${USER_B}:`)).toBe(true);
  });

  it("keeps public scopes free of any user segment", () => {
    for (const cc of COUNTRIES) {
      expect(pubScope(cc).startsWith("pub:")).toBe(true);
      expect(pubScope(cc)).not.toContain("usr:");
    }
  });
});

describe("canUserReadOwnerScope (hydration re-check)", () => {
  it("allows public chunks", () => {
    expect(canUserReadOwnerScope(USER_A, "pub")).toBe(true);
  });

  it("allows the user's own private chunks", () => {
    expect(canUserReadOwnerScope(USER_A, ownerScopeFor(USER_A))).toBe(true);
  });

  it("rejects another user's private chunks", () => {
    expect(canUserReadOwnerScope(USER_A, ownerScopeFor(USER_B))).toBe(false);
  });

  it("rejects unrecognised owner scopes rather than defaulting open", () => {
    for (const bogus of ["", "usr:", "USR:pub", "public", "*"]) {
      expect(canUserReadOwnerScope(USER_A, bogus)).toBe(false);
    }
  });

  it("rejects a prefix-extension of the user's own scope", () => {
    // "usr:<A>" must not be satisfied by "usr:<A>extra".
    expect(canUserReadOwnerScope(USER_A, `${ownerScopeFor(USER_A)}extra`)).toBe(
      false
    );
  });
});

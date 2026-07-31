import {
  MAX_CHARS,
  MIN_CHARS,
  TARGET_CHARS,
  chunkDocument,
  contentHash,
  normalizeText,
} from "../chunker";

const sentence = (n: number) =>
  `Applicants must supply document number ${n} at the visa appointment centre. `;

/** Build prose long enough to force splitting. */
const longText = (count: number) =>
  Array.from({ length: count }, (_, i) => sentence(i)).join("");

describe("normalizeText", () => {
  it("collapses runs of spaces and blank lines but keeps paragraphs", () => {
    expect(normalizeText("a   b\n\n\n\nc")).toBe("a b\n\nc");
  });

  it("normalizes CRLF", () => {
    expect(normalizeText("a\r\nb")).toBe("a\nb");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeText("  \n hello \n ")).toBe("hello");
  });
});

describe("chunkDocument", () => {
  it("returns nothing for empty input", () => {
    expect(chunkDocument({ text: "" })).toEqual([]);
    expect(chunkDocument({ text: "   \n  " })).toEqual([]);
  });

  it("keeps a short document as a single chunk even below MIN_CHARS", () => {
    // The MIN_CHARS filter exists to drop fragments of a larger doc, not to
    // discard a small document that is all we have.
    const chunks = chunkDocument({ text: "Visa free for 30 days." });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Visa free for 30 days.");
  });

  it("prepends the breadcrumb to the embedded text", () => {
    const chunks = chunkDocument({
      text: longText(3),
      breadcrumb: ["Thailand", "Tourist visa", "gov.uk"],
    });
    expect(chunks[0].text.startsWith("Thailand — Tourist visa — gov.uk\n\n")).toBe(
      true
    );
    expect(chunks[0].heading).toBe("Thailand — Tourist visa — gov.uk");
  });

  it("drops empty breadcrumb parts rather than emitting stray separators", () => {
    const chunks = chunkDocument({
      text: longText(3),
      breadcrumb: ["Thailand", "", "  "],
    });
    expect(chunks[0].heading).toBe("Thailand");
    expect(chunks[0].text).not.toContain("— —");
  });

  it("omits the prefix entirely when no breadcrumb is given", () => {
    const chunks = chunkDocument({ text: longText(3) });
    expect(chunks[0].heading).toBeUndefined();
    expect(chunks[0].text.startsWith("Applicants")).toBe(true);
  });

  it("splits long text into multiple chunks with sequential ordinals", () => {
    const chunks = chunkDocument({ text: longText(80) });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.ordinal)).toEqual(
      chunks.map((_, i) => i)
    );
  });

  it("never splits mid-sentence for ordinary prose", () => {
    for (const chunk of chunkDocument({ text: longText(80) })) {
      expect(chunk.text.trim()).toMatch(/[.!?:]$/);
    }
  });

  it("keeps chunk bodies near the target size", () => {
    for (const chunk of chunkDocument({ text: longText(80) })) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it("starts a new chunk at each heading", () => {
    const text = [
      "## Fees",
      longText(2),
      "## Processing time",
      longText(2),
      "## Documents",
      longText(2),
    ].join("\n");
    const chunks = chunkDocument({ text });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.filter((c) => c.text.includes("## Fees"))).toHaveLength(1);
    expect(
      chunks.filter((c) => c.text.includes("## Processing time"))
    ).toHaveLength(1);
  });

  it("hard-splits a single sentence longer than MAX_CHARS", () => {
    // An unsplittable run of text would otherwise blow the embedding request.
    const monster = "x".repeat(MAX_CHARS * 2 + 500);
    const chunks = chunkDocument({ text: monster });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHARS + 200);
    }
  });

  it("overlaps adjacent chunks so a boundary-spanning fact survives", () => {
    const chunks = chunkDocument({ text: longText(80) });
    expect(chunks.length).toBeGreaterThan(1);
    // Some content from the tail of chunk N should reappear at the head of N+1.
    const tailWords = chunks[0].text.trim().split(/\s+/).slice(-6).join(" ");
    const anyOverlap = chunks
      .slice(1)
      .some((c) => tailWords.split(" ").some((w) => c.text.includes(w)));
    expect(anyOverlap).toBe(true);
  });

  it("drops sub-MIN_CHARS fragments from a multi-section document", () => {
    const text = ["## A", "tiny", "## B", longText(3)].join("\n");
    for (const chunk of chunkDocument({ text })) {
      const body = chunk.heading
        ? chunk.text.slice(chunk.heading.length + 2)
        : chunk.text;
      expect(body.length).toBeGreaterThanOrEqual(MIN_CHARS);
    }
  });

  // The property the whole re-crawl cost model depends on.
  it("is deterministic across repeated runs", () => {
    const input = {
      text: longText(60),
      breadcrumb: ["Japan", "eVisa", "gov.uk"],
    };
    const a = chunkDocument(input);
    const b = chunkDocument(input);
    expect(a).toEqual(b);
    expect(a.map((c) => contentHash(c.text))).toEqual(
      b.map((c) => contentHash(c.text))
    );
  });

  it("respects TARGET_CHARS as a soft bound on most chunks", () => {
    const chunks = chunkDocument({ text: longText(80) });
    const oversized = chunks.filter((c) => c.text.length > TARGET_CHARS * 1.6);
    expect(oversized).toHaveLength(0);
  });
});

describe("contentHash", () => {
  it("is stable for identical input", () => {
    expect(contentHash("visa free 30 days")).toBe(contentHash("visa free 30 days"));
  });

  it("differs for different input", () => {
    expect(contentHash("30 days")).not.toBe(contentHash("60 days"));
  });

  it("is sensitive to small edits — the point of the re-embed skip", () => {
    // If a one-character fee change hashed the same, a re-crawl would keep the
    // stale vector and the corpus would quietly drift out of date.
    expect(contentHash("The fee is £127.")).not.toBe(
      contentHash("The fee is £128.")
    );
  });

  it("is sensitive to ordering", () => {
    expect(contentHash("ab")).not.toBe(contentHash("ba"));
  });

  it("produces a fixed-width hex string", () => {
    for (const s of ["", "a", "a much longer piece of text about visas"]) {
      expect(contentHash(s)).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});

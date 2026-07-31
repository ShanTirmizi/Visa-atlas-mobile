import type { CountryVisa } from "../../../data/visaData";
import type { LocalInfo } from "../../../data/localInfo";
import {
  CURATED_AS_OF,
  buildAllCuratedDocs,
  buildLocalInfoDocs,
  buildVisaBenefitsDoc,
  buildVisaDoc,
} from "../curatedDocs";

const THAILAND: CountryVisa = {
  name: "Thailand",
  code: "THA",
  category: "visa-free",
  days: 60,
  notes: "Visa exemption on arrival",
  cost: "Free",
  processingTime: "On arrival",
  passportValidity: "6m+",
  entries: "single",
  lastVerified: "2026-03",
};

const MEXICO: CountryVisa = {
  name: "Mexico",
  code: "MEX",
  category: "visa-required",
  notes: "Visa required for Indian passport",
  cost: "$45",
};

// Held-visa upgrades live in a separate visaBenefitsMap in data/visaData.ts,
// NOT on the CountryVisa entry — see buildVisaBenefitsDoc.
const MEX_BENEFITS = {
  us: { category: "visa-free" as const, days: 180, notes: "Valid US visa required" },
  uk: { category: "visa-free" as const, days: 180 },
};

const LOCAL: LocalInfo = {
  emergencyNumber: "112",
  policeNumber: "191",
  ambulanceNumber: "1669",
  fireNumber: "199",
  ukEmbassy: {
    city: "Bangkok",
    phone: "+66 2 305 8333",
    address: "14 Wireless Road, Bangkok",
    website: "https://www.gov.uk/world/organisations/british-embassy-bangkok",
  },
  essentialApps: [{ name: "Grab", purpose: "Ride-hailing" }],
  tippingCulture: "Not expected, round up taxis.",
  dressCode: "Cover shoulders at temples.",
  scamWarnings: ["Tuk-tuk gem scam"],
  localCustoms: ["Never touch someone's head"],
  tapWater: "unsafe",
  plugType: "Type A/B/C",
  simCard: "AIS or TrueMove at the airport.",
  currencyTip: "Thai Baht (THB).",
};

describe("buildVisaDoc", () => {
  const doc = buildVisaDoc(THAILAND);

  it("uses a stable idempotency key", () => {
    expect(doc.externalId).toBe("curated:visaData:THA");
  });

  it("renders the category as prose, not a raw enum", () => {
    // "visa-free" alone embeds poorly against "can I enter without a visa".
    expect(doc.text).toContain("visa-free entry");
    expect(doc.text).toContain("Thailand (THA)");
  });

  it("includes stay length and the requirement fields", () => {
    expect(doc.text).toContain("60 days");
    expect(doc.text).toContain("Fee: Free");
    expect(doc.text).toContain("Passport validity required at entry: 6m+");
  });

  it("carries the entry's own lastVerified as asOf", () => {
    expect(doc.asOf).toBe("2026-03");
    expect(doc.text).toContain("Last verified: 2026-03");
  });

  it("falls back to the dataset-level asOf when the entry has none", () => {
    const doc2 = buildVisaDoc({ ...THAILAND, lastVerified: undefined });
    expect(doc2.asOf).toBe(CURATED_AS_OF);
  });

  it("omits absent fields instead of emitting empty labels", () => {
    const sparse = buildVisaDoc({
      name: "Nowhere",
      code: "NOW",
      category: "visa-required",
    });
    expect(sparse.text).not.toContain("Fee:");
    expect(sparse.text).not.toContain("undefined");
    expect(sparse.text).not.toContain("Notes:");
  });

  it("drops literal 'N/A' values the dataset sometimes carries", () => {
    const doc2 = buildVisaDoc({ ...THAILAND, cost: "N/A" });
    expect(doc2.text).not.toContain("N/A");
  });
});

describe("buildVisaBenefitsDoc", () => {
  it("returns null when there are no held-visa benefits", () => {
    expect(buildVisaBenefitsDoc(THAILAND, undefined)).toBeNull();
    expect(buildVisaBenefitsDoc(MEXICO, {})).toBeNull();
  });

  it("is a separate document from the base entry", () => {
    // The highest-traffic question in the corpus gets its own embedding rather
    // than competing with fee/validity text inside the general chunk.
    const doc = buildVisaBenefitsDoc(MEXICO, MEX_BENEFITS)!;
    expect(doc.externalId).toBe("curated:visaBenefits:MEX");
    expect(doc.externalId).not.toBe(buildVisaDoc(MEXICO).externalId);
  });

  it("states the baseline and each upgrade in natural language", () => {
    const doc = buildVisaBenefitsDoc(MEXICO, MEX_BENEFITS)!;
    expect(doc.text).toContain("Without any other visa");
    expect(doc.text).toContain("With a US visa, Mexico becomes visa-free entry");
    expect(doc.text).toContain("up to 180 days");
    expect(doc.text).toContain("With a UK visa");
  });

  it("emits held visas in a fixed order regardless of key order", () => {
    const a = buildVisaBenefitsDoc(MEXICO, MEX_BENEFITS)!;
    const b = buildVisaBenefitsDoc(MEXICO, {
      uk: MEX_BENEFITS.uk,
      us: MEX_BENEFITS.us,
    })!;
    // Object key order must not leak into the hashed text.
    expect(a.text).toBe(b.text);
  });
});

describe("buildLocalInfoDocs", () => {
  const docs = buildLocalInfoDocs("THA", "Thailand", LOCAL);

  it("splits into themed documents rather than one blob", () => {
    expect(docs.map((d) => d.externalId)).toEqual([
      "curated:localInfo:safety:THA",
      "curated:localInfo:practical:THA",
      "curated:localInfo:culture:THA",
    ]);
  });

  it("puts emergency numbers and the embassy in the safety doc", () => {
    const safety = docs[0];
    expect(safety.text).toContain("Emergency: 112");
    expect(safety.text).toContain("British Embassy in Bangkok");
    expect(safety.url).toContain("gov.uk");
  });

  it("puts tap water, plugs and SIM in the practical doc", () => {
    expect(docs[1].text).toContain("Tap water: unsafe");
    expect(docs[1].text).toContain("Type A/B/C");
    expect(docs[1].text).toContain("Grab (Ride-hailing)");
  });

  it("puts customs and scams in the culture doc", () => {
    expect(docs[2].text).toContain("Tuk-tuk gem scam");
    expect(docs[2].text).toContain("Never touch someone's head");
  });

  it("omits the culture doc entirely when there is nothing to say", () => {
    const bare = buildLocalInfoDocs("XXX", "Nowhere", {
      ...LOCAL,
      dressCode: undefined,
      scamWarnings: undefined,
      localCustoms: undefined,
    });
    expect(bare.map((d) => d.externalId)).not.toContain(
      "curated:localInfo:culture:XXX"
    );
  });

  it("survives a missing embassy", () => {
    const noEmbassy = buildLocalInfoDocs("XXX", "Nowhere", {
      ...LOCAL,
      ukEmbassy: undefined,
    });
    expect(noEmbassy[0].text).not.toContain("British Embassy");
    expect(noEmbassy[0].url).toBeUndefined();
  });
});

describe("buildAllCuratedDocs", () => {
  const docs = buildAllCuratedDocs();

  it("produces a substantial corpus from the real datasets", () => {
    expect(docs.length).toBeGreaterThan(300);
  });

  it("has globally unique externalIds", () => {
    const ids = docs.map((d) => d.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every document non-empty text and a country code", () => {
    for (const doc of docs) {
      expect(doc.text.trim().length).toBeGreaterThan(0);
      expect(doc.countryCode).toMatch(/^[A-Z]{3}$/);
      expect(doc.breadcrumb.length).toBeGreaterThan(0);
    }
  });

  // The ingest cursor is an index into this list across scheduler hops, so an
  // unstable order would skip or duplicate entries on resume.
  it("is deterministic and stably ordered", () => {
    const again = buildAllCuratedDocs();
    expect(again.map((d) => d.externalId)).toEqual(docs.map((d) => d.externalId));
    expect(again.map((d) => d.text)).toEqual(docs.map((d) => d.text));

    const ids = docs.map((d) => d.externalId);
    expect([...ids].sort()).toEqual(ids);
  });

  it("covers both datasets", () => {
    const prefixes = new Set(
      docs.map((d) => d.externalId.split(":").slice(0, 2).join(":"))
    );
    expect(prefixes.has("curated:visaData")).toBe(true);
    expect(prefixes.has("curated:visaBenefits")).toBe(true);
    expect(prefixes.has("curated:localInfo")).toBe(true);
  });

  // Regression: benefits are stored in a separate visaBenefitsMap, so reading
  // CountryVisa.visaBenefits (declared but never populated) yielded ZERO
  // benefit docs — silently gutting the corpus for "does my US visa help?",
  // the single highest-traffic question the app answers.
  it("produces a meaningful number of held-visa benefit docs", () => {
    const benefitDocs = docs.filter((d) =>
      d.externalId.startsWith("curated:visaBenefits:")
    );
    expect(benefitDocs.length).toBeGreaterThan(40);
  });

  it("includes the merged multi-visa upgrades, not just the first literal", () => {
    // data/visaData.ts calls mergeBenefits("OMN", { schengen, uk }) after the
    // literal that only had `us`. All three must survive into the document.
    const oman = docs.find((d) => d.externalId === "curated:visaBenefits:OMN");
    expect(oman).toBeDefined();
    expect(oman!.text).toContain("With a US visa");
    expect(oman!.text).toContain("With a Schengen visa");
    expect(oman!.text).toContain("With a UK visa");
  });
});

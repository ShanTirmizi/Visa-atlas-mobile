// convex/lib/curatedDocs.ts
//
// Turns the curated in-repo datasets into RAG documents. Pure and synchronous
// so it's jest-testable without a Convex runtime — the action in
// convex/visaCorpus/curated.ts just walks the output of these builders.
//
// Everything here is TEMPLATED, never free-form. `docHash` is what lets a
// re-ingest skip embedding, so the same dataset entry must render to the exact
// same string every run. That rules out anything order-dependent (Object.keys
// iteration without a sort, Date.now(), locale-sensitive formatting).
//
// Source datasets:
//   data/visaData.ts   — 186 CountryVisa entries (Indian-passport baseline plus
//                        per-held-visa upgrades). Declares itself as sourced
//                        from Henley/IATA/embassy sites, last updated 2026-03.
//   data/localInfo.ts  — 88 countries of on-the-ground practicalities.

import {
  visaBenefitsMap,
  visaData,
  type CountryVisa,
  type HeldVisaType,
  type VisaBenefit,
} from "../../data/visaData";
import { localInfo, type LocalInfo } from "../../data/localInfo";

/** Held-visa upgrades keyed by alpha-3, as stored in data/visaData.ts. */
export type BenefitsForCountry = Partial<Record<HeldVisaType, VisaBenefit>>;

/** Dataset-level fallback when an entry carries no `lastVerified` of its own.
 *  Matches the header comment in data/visaData.ts. */
export const CURATED_AS_OF = "2026-03";

export const CURATED_LABEL = "Visa Atlas data";

export interface CuratedDoc {
  /** Idempotency key: "curated:visaData:THA" */
  externalId: string;
  countryCode: string;
  title: string;
  label: string;
  asOf: string;
  url?: string;
  /** Rendered as the embedded prefix by the chunker. */
  breadcrumb: string[];
  text: string;
}

const HELD_VISA_LABELS: Record<HeldVisaType, string> = {
  us: "a US visa",
  schengen: "a Schengen visa",
  uk: "a UK visa",
  canada: "a Canada visa",
  australia: "an Australia visa",
};

/** Fixed iteration order so output never depends on object key ordering. */
const HELD_VISA_ORDER: HeldVisaType[] = [
  "us",
  "schengen",
  "uk",
  "canada",
  "australia",
];

const CATEGORY_PROSE: Record<string, string> = {
  "visa-free": "visa-free entry",
  "visa-on-arrival": "visa on arrival",
  evisa: "eVisa (apply online before travel)",
  "visa-required": "visa required in advance",
  home: "home country (no visa needed)",
};

function line(labelText: string, value?: string | number | null): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s || s.toUpperCase() === "N/A") return null;
  return `${labelText}: ${s}`;
}

/** Facts common to a base entry and a held-visa upgrade. */
function requirementLines(e: {
  cost?: string;
  processingTime?: string;
  forms?: string;
  passportValidity?: string;
  entries?: string;
}): string[] {
  return [
    line("Fee", e.cost),
    line("Processing time", e.processingTime),
    line("Supporting documents", e.forms),
    line("Passport validity required at entry", e.passportValidity),
    line("Permitted entries", e.entries),
  ].filter((x): x is string => x !== null);
}

/**
 * The baseline entry-requirements document for one country.
 *
 * Phrased as a full sentence rather than a bare field dump because the whole
 * chunk gets embedded: "Thailand grants visa-free entry to Indian passport
 * holders" matches a natural question far better than "THA | visa-free | 60".
 */
export function buildVisaDoc(entry: CountryVisa): CuratedDoc {
  const category = CATEGORY_PROSE[entry.category] ?? entry.category;
  const parts: string[] = [
    `${entry.name} (${entry.code}) — entry requirements for an Indian passport holder.`,
    `Category: ${category}.`,
  ];

  if (entry.days !== undefined) {
    parts.push(`Permitted stay: ${entry.days} days.`);
  }
  const notes = line("Notes", entry.notes);
  if (notes) parts.push(`${notes}.`);
  const restrictions = line("Restrictions", entry.restrictions);
  if (restrictions) parts.push(`${restrictions}.`);

  const reqs = requirementLines(entry);
  if (reqs.length > 0) parts.push(reqs.join(". ") + ".");

  const applyAt = line("Apply at", entry.applyAt);
  if (applyAt) parts.push(`${applyAt}.`);

  parts.push(`Last verified: ${entry.lastVerified ?? CURATED_AS_OF}.`);

  return {
    externalId: `curated:visaData:${entry.code}`,
    countryCode: entry.code,
    title: `${entry.name} entry requirements`,
    label: CURATED_LABEL,
    asOf: entry.lastVerified ?? CURATED_AS_OF,
    url: entry.applyAt,
    breadcrumb: [entry.name, "Entry requirements"],
    text: parts.join(" "),
  };
}

/**
 * Held-visa upgrades as their own document.
 *
 * Split out deliberately: "does my US visa help me get into Mexico?" is the
 * single highest-traffic question this corpus answers, and burying the answer
 * inside the general entry-requirements chunk makes it compete with fee and
 * passport-validity text for the same embedding. Its own chunk retrieves far
 * more reliably.
 *
 * Benefits are passed in rather than read off `entry`, because in
 * data/visaData.ts they live in a SEPARATE `visaBenefitsMap` keyed by alpha-3 —
 * the `CountryVisa.visaBenefits` field is declared but never populated (zero
 * occurrences in the dataset). Reading the field would silently produce an
 * empty corpus for the most-asked question in the app.
 *
 * Returns null when the country has no declared benefits.
 */
export function buildVisaBenefitsDoc(
  entry: CountryVisa,
  benefits?: BenefitsForCountry
): CuratedDoc | null {
  const resolved = benefits ?? entry.visaBenefits;
  if (!resolved) return null;

  const present = HELD_VISA_ORDER.filter((k) => resolved[k]);
  if (present.length === 0) return null;

  const parts: string[] = [
    `${entry.name} (${entry.code}) — how holding another country's visa changes entry for an Indian passport holder.`,
    `Without any other visa, ${entry.name} is ${
      CATEGORY_PROSE[entry.category] ?? entry.category
    }.`,
  ];

  for (const key of present) {
    const b = resolved[key]!;
    const upgraded = CATEGORY_PROSE[b.category] ?? b.category;
    const bits: string[] = [
      `With ${HELD_VISA_LABELS[key]}, ${entry.name} becomes ${upgraded}`,
    ];
    if (b.days !== undefined) bits.push(`for up to ${b.days} days`);
    let sentence = bits.join(" ") + ".";

    const extra = requirementLines(b);
    if (extra.length > 0) sentence += ` ${extra.join(". ")}.`;
    const bNotes = line("Notes", b.notes);
    if (bNotes) sentence += ` ${bNotes}.`;
    parts.push(sentence);
  }

  parts.push(`Last verified: ${entry.lastVerified ?? CURATED_AS_OF}.`);

  return {
    externalId: `curated:visaBenefits:${entry.code}`,
    countryCode: entry.code,
    title: `${entry.name} held-visa benefits`,
    label: CURATED_LABEL,
    asOf: entry.lastVerified ?? CURATED_AS_OF,
    breadcrumb: [entry.name, "Held-visa benefits"],
    text: parts.join(" "),
  };
}

/**
 * On-the-ground practicalities, split into three documents by theme.
 *
 * Split rather than one blob because these answer genuinely different
 * questions — "what's the emergency number" and "can I drink the tap water"
 * share no vocabulary, and a single mixed chunk retrieves poorly for both.
 */
export function buildLocalInfoDocs(
  countryCode: string,
  countryName: string,
  info: LocalInfo
): CuratedDoc[] {
  const base = {
    countryCode,
    label: CURATED_LABEL,
    asOf: CURATED_AS_OF,
  };
  const docs: CuratedDoc[] = [];

  // ── Safety & official contacts ──
  const safety: string[] = [
    `${countryName} — emergency numbers and consular contacts for travellers.`,
    `Emergency: ${info.emergencyNumber}. Police: ${info.policeNumber}. Ambulance: ${info.ambulanceNumber}. Fire: ${info.fireNumber}.`,
  ];
  if (info.ukEmbassy) {
    safety.push(
      `British Embassy in ${info.ukEmbassy.city}: ${info.ukEmbassy.address}. Phone ${info.ukEmbassy.phone}. Website: ${info.ukEmbassy.website}.`
    );
  }
  docs.push({
    ...base,
    externalId: `curated:localInfo:safety:${countryCode}`,
    title: `${countryName} emergency contacts`,
    url: info.ukEmbassy?.website,
    breadcrumb: [countryName, "Emergency contacts"],
    text: safety.join(" "),
  });

  // ── Money, connectivity, power ──
  const practical: string[] = [
    `${countryName} — money, connectivity and power for travellers.`,
    `Tap water: ${info.tapWater}.`,
    `Plug type: ${info.plugType}.`,
    `SIM and data: ${info.simCard}.`,
    `Tipping: ${info.tippingCulture}`,
  ];
  const currency = line("Currency", info.currencyTip);
  if (currency) practical.push(`${currency}.`);
  if (info.essentialApps.length > 0) {
    practical.push(
      `Useful apps: ${info.essentialApps
        .map((a) => `${a.name} (${a.purpose})`)
        .join(", ")}.`
    );
  }
  docs.push({
    ...base,
    externalId: `curated:localInfo:practical:${countryCode}`,
    title: `${countryName} money and connectivity`,
    breadcrumb: [countryName, "Money and connectivity"],
    text: practical.join(" "),
  });

  // ── Culture & scams ──
  const culture: string[] = [
    `${countryName} — local customs, dress code and common scams.`,
  ];
  const dress = line("Dress code", info.dressCode);
  if (dress) culture.push(`${dress}.`);
  if (info.localCustoms?.length) {
    culture.push(`Local customs: ${info.localCustoms.join(". ")}.`);
  }
  if (info.scamWarnings?.length) {
    culture.push(`Common scams to avoid: ${info.scamWarnings.join(". ")}.`);
  }
  // Only emit when there's something beyond the title line.
  if (culture.length > 1) {
    docs.push({
      ...base,
      externalId: `curated:localInfo:culture:${countryCode}`,
      title: `${countryName} customs and scams`,
      breadcrumb: [countryName, "Customs and scams"],
      text: culture.join(" "),
    });
  }

  return docs;
}

/**
 * Every curated document, in a stable order.
 *
 * Sorted by externalId so the ingest cursor is a simple index into a
 * deterministic list — resuming a batched run after a scheduler hop then can't
 * skip or duplicate entries.
 */
export function buildAllCuratedDocs(): CuratedDoc[] {
  const docs: CuratedDoc[] = [];
  const nameByCode = new Map<string, string>();

  for (const entry of visaData) {
    nameByCode.set(entry.code, entry.name);
    docs.push(buildVisaDoc(entry));
    // visaBenefitsMap is mutated at module load by the mergeBenefits() calls in
    // data/visaData.ts, so reading it here yields the fully merged upgrades
    // (e.g. Oman's US + UK + Schengen entries), not just the first literal.
    const benefits = buildVisaBenefitsDoc(entry, visaBenefitsMap[entry.code]);
    if (benefits) docs.push(benefits);
  }

  for (const code of Object.keys(localInfo).sort()) {
    const info = localInfo[code];
    if (!info) continue;
    docs.push(...buildLocalInfoDocs(code, nameByCode.get(code) ?? code, info));
  }

  return docs.sort((a, b) => (a.externalId < b.externalId ? -1 : 1));
}

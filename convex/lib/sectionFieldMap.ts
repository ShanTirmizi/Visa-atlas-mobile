// convex/lib/sectionFieldMap.ts
import type { Doc } from "../_generated/dataModel";

/**
 * Maps a section name (used in SSE events + retry calls) to the trip
 * doc field that holds its content. Drives `patchTripSection`.
 *
 * Sections that are NOT in this map are handled specially:
 *   - "itinerary-day:N"  → appended/replaced at index N in the parsed
 *                          itinerary array
 *   - "staticFacts"      → patches multiple fields atomically
 *                          (currency, language, etc.); see patchTripSection
 *   - "heroImage"        → set on completion; see patchTripSection
 */
export const SECTION_FIELD_MAP = {
  highlights: "highlights",
  visaChecklist: "visaChecklist",
  visaNotes: "visaNotes",
  budgetBreakdown: "budgetBreakdown",
  packingSuggestions: "packingSuggestions",
  accommodationTips: "accommodationTips",
  localEssentials: "localEssentials",
  localGuide: "localGuide",
  carRental: "carRental",
  seasonalGuide: "seasonalGuide",
} as const satisfies Record<string, keyof Doc<"trips">>;

export type SectionName =
  | keyof typeof SECTION_FIELD_MAP
  | `itinerary-day:${number}`
  | "staticFacts"
  | "heroImage";

/**
 * The full ordered list of sections that the generation flow expects
 * to populate. Used by completeGeneration to determine "all done".
 * Itinerary days are tracked separately via the parsed array length.
 */
export const STREAMING_SECTIONS = [
  "highlights",
  "visaChecklist",
  "visaNotes",
  "budgetBreakdown",
  "packingSuggestions",
  "accommodationTips",
] as const satisfies readonly (keyof typeof SECTION_FIELD_MAP)[];

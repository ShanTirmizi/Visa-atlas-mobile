import type { Doc } from '@/convex/_generated/dataModel';

// Read-only shape of a trip doc — these helpers are pure reads and never
// mutate, so we accept readonly arrays. Using a structural type (rather than
// `Pick<Doc<'trips'>, …>`) makes the helpers easy to call with literal
// fixtures (`as const`) and Convex `Doc<'trips'>` values alike.
type TripLike = {
  readonly status: Doc<'trips'>['status'];
  readonly itinerary: string;
  readonly highlights: string;
  readonly visaChecklist: string;
  readonly visaNotes?: string;
  readonly budgetBreakdown: string;
  readonly failedSections?: readonly string[];
  readonly duration: number;
  readonly heroImage?: string;
};

export type SectionName =
  | 'highlights'
  | 'visaChecklist'
  | 'visaNotes'
  | 'budgetBreakdown';

// Sections that get streamed during trip generation. Country tips are NOT
// in this list — they're served by `data/localInfo.ts` (handwritten) or
// the `countryTipsCache` Convex table (LLM-generated, cached forever),
// not by per-trip streaming.
const STREAMED_SECTIONS: SectionName[] = [
  'highlights',
  'visaChecklist',
  'visaNotes',
  'budgetBreakdown',
];

const TOTAL_SECTIONS = STREAMED_SECTIONS.length + 2; // + itinerary + heroImage

export function isGenerating(trip: TripLike): boolean {
  return trip.status === 'generating';
}

export function hasFailed(trip: TripLike, section: string): boolean {
  return (trip.failedSections ?? []).includes(section);
}

export function isSectionPending(trip: TripLike, section: SectionName): boolean {
  if (!isGenerating(trip)) return false;
  if (hasFailed(trip, section)) return false;
  return !trip[section];
}

export function getStreamingDayIndex(trip: TripLike): number | null {
  if (!isGenerating(trip)) return null;
  if (!trip.itinerary) return 0;
  try {
    const parsed = JSON.parse(trip.itinerary);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function getCompletedSectionCount(trip: TripLike): number {
  let count = 0;
  for (const s of STREAMED_SECTIONS) {
    if (trip[s]) count++;
  }
  if (trip.itinerary) {
    try {
      const days = JSON.parse(trip.itinerary);
      if (Array.isArray(days) && days.length >= (trip.duration ?? 0)) count++;
    } catch {
      /* */
    }
  }
  if (trip.heroImage) count++;
  return count;
}

export function getTotalSectionCount(): number {
  return TOTAL_SECTIONS;
}

export function getTabDotIndicators(trip: TripLike): Record<string, boolean> {
  if (!isGenerating(trip)) {
    return {
      Visa: hasFailed(trip, 'visaChecklist') || hasFailed(trip, 'visaNotes'),
      // Tips never gets a dot — country tips come from the static table
      // or the cache, not from per-trip streaming, so there's no
      // per-trip pending or failed state to surface here.
      Tips: false,
      Itinerary: false,
    };
  }
  return {
    Visa: isSectionPending(trip, 'visaChecklist') || isSectionPending(trip, 'visaNotes'),
    Tips: false,
    Itinerary: (() => {
      const idx = getStreamingDayIndex(trip);
      return idx !== null && idx < (trip.duration ?? 0);
    })(),
  };
}

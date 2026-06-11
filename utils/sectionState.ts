import type { Doc } from '@/convex/_generated/dataModel';

// Read-only shape of a trip doc — these helpers are pure reads and never
// mutate, so we accept readonly arrays. Using a structural type (rather than
// `Pick<Doc<'trips'>, …>`) makes the helpers easy to call with literal
// fixtures (`as const`) and Convex `Doc<'trips'>` values alike.
export type TripLike = {
  readonly status: Doc<'trips'>['status'];
  readonly itinerary: string;
  readonly highlights: string;
  readonly visaChecklist: string;
  readonly visaNotes?: string;
  readonly budgetBreakdown: string;
  readonly diningGuide?: string;
  readonly failedSections?: readonly string[];
  readonly retryingSections?: readonly string[];
  readonly duration: number;
  readonly heroImage?: string;
};

export type SectionName =
  | 'highlights'
  | 'visaChecklist'
  | 'visaNotes'
  | 'budgetBreakdown'
  | 'diningGuide';

// Sections that get streamed during trip generation. Country tips are NOT
// in this list — they're served by `data/localInfo.ts` (handwritten) or
// the `countryTipsCache` Convex table (LLM-generated, cached forever),
// not by per-trip streaming.
const STREAMED_SECTIONS: SectionName[] = [
  'highlights',
  'visaChecklist',
  'visaNotes',
  'budgetBreakdown',
  'diningGuide',
];

const TOTAL_SECTIONS = STREAMED_SECTIONS.length + 2; // + itinerary + heroImage

export function isGenerating(trip: TripLike): boolean {
  return trip.status === 'generating';
}

export function hasFailed(trip: TripLike, section: string): boolean {
  return (trip.failedSections ?? []).includes(section);
}

/** True while a server-side `retrySection` run is in flight for `section`. */
export function isRetrying(trip: TripLike, section: string): boolean {
  return (trip.retryingSections ?? []).includes(section);
}

export function isSectionPending(trip: TripLike, section: SectionName): boolean {
  if (!isGenerating(trip)) return false;
  if (hasFailed(trip, section)) return false;
  return !trip[section];
}

export function getStreamingDayIndex(trip: TripLike): number | null {
  if (!isGenerating(trip)) return null;
  // Once the itinerary stream has failed, days are no longer arriving —
  // returning null here unmounts the "writing…" pill/dots so the
  // SectionRetryCard owns the state instead of contradicting it.
  if (hasFailed(trip, 'itinerary')) return null;
  if (!trip.itinerary) return 0;
  try {
    const parsed = JSON.parse(trip.itinerary);
    // Out-of-order per-day patches can leave transient null holes in the
    // array (the server pads `days[idx] = …` past the end). Count only
    // real days so the streaming index matches what's actually rendered.
    return Array.isArray(parsed) ? parsed.filter(Boolean).length : 0;
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
      // filter(Boolean): null holes from out-of-order day patches aren't
      // completed days — see getStreamingDayIndex.
      if (Array.isArray(days) && days.filter(Boolean).length >= (trip.duration ?? 0)) count++;
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
      // A failed itinerary keeps its dot after generation settles so the
      // retry affordance on the Itinerary tab stays discoverable —
      // mirrors the Visa failure dot above.
      Itinerary: hasFailed(trip, 'itinerary'),
      // Failed dining guide keeps its dot after settle — mirrors Visa.
      Food: hasFailed(trip, 'diningGuide'),
    };
  }
  return {
    Visa: isSectionPending(trip, 'visaChecklist') || isSectionPending(trip, 'visaNotes'),
    Tips: false,
    Itinerary:
      hasFailed(trip, 'itinerary') ||
      (() => {
        const idx = getStreamingDayIndex(trip);
        return idx !== null && idx < (trip.duration ?? 0);
      })(),
    // Dining is generated AFTER the itinerary finishes, so this stays
    // pending (dot on) for most of the run — that's correct: the Food tab
    // really is still being written.
    Food: isSectionPending(trip, 'diningGuide'),
  };
}

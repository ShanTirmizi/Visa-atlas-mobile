import { describe, expect, it } from '@jest/globals';
import {
  isGenerating,
  isSectionPending,
  hasFailed,
  getStreamingDayIndex,
  getCompletedSectionCount,
  getTotalSectionCount,
} from '../sectionState';

const baseTrip = {
  status: 'planned',
  itinerary: '',
  highlights: '',
  visaChecklist: '',
  visaNotes: '',
  budgetBreakdown: '',
  failedSections: [],
  duration: 10,
  heroImage: undefined,
} as const;

describe('sectionState helpers', () => {
  it('isGenerating returns true only when status is generating', () => {
    expect(isGenerating({ ...baseTrip, status: 'generating' })).toBe(true);
    expect(isGenerating({ ...baseTrip, status: 'planned' })).toBe(false);
    expect(isGenerating({ ...baseTrip, status: 'failed' })).toBe(false);
  });

  it('isSectionPending true when field empty and not in failedSections', () => {
    expect(isSectionPending({ ...baseTrip, status: 'generating' }, 'highlights')).toBe(true);
    expect(isSectionPending({ ...baseTrip, status: 'generating', highlights: '[]' }, 'highlights')).toBe(false);
    expect(isSectionPending({ ...baseTrip, status: 'generating', failedSections: ['highlights'] }, 'highlights')).toBe(false);
  });

  it('isSectionPending false when not generating', () => {
    expect(isSectionPending({ ...baseTrip, status: 'planned' }, 'highlights')).toBe(false);
  });

  it('hasFailed checks failedSections', () => {
    expect(hasFailed({ ...baseTrip, failedSections: ['highlights'] }, 'highlights')).toBe(true);
    expect(hasFailed(baseTrip, 'highlights')).toBe(false);
  });

  it('getStreamingDayIndex returns array length when generating, else null', () => {
    expect(
      getStreamingDayIndex({
        ...baseTrip,
        status: 'generating',
        itinerary: JSON.stringify([{ title: 'D1' }, { title: 'D2' }]),
      }),
    ).toBe(2);
    expect(
      getStreamingDayIndex({ ...baseTrip, status: 'planned', itinerary: '[]' }),
    ).toBeNull();
  });

  it('getCompletedSectionCount counts non-empty content fields', () => {
    expect(
      getCompletedSectionCount({ ...baseTrip, highlights: '[]', budgetBreakdown: '[]' }),
    ).toBe(2);
    expect(getCompletedSectionCount(baseTrip)).toBe(0);
  });

  it('getTotalSectionCount is the same constant', () => {
    // 4 streamed sections (highlights, visaChecklist, visaNotes,
    // budgetBreakdown) + itinerary + heroImage = 6
    expect(getTotalSectionCount()).toBe(6);
  });
});

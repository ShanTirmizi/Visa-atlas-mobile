import { describe, expect, it } from '@jest/globals';
import { lookupStaticFacts, hasStaticFacts } from '@/constants/staticTripFacts';

describe('staticTripFacts', () => {
  it('returns full facts for a known country', () => {
    const f = lookupStaticFacts('JP');
    expect(f).toEqual({
      currency: 'JPY (¥)',
      language: 'Japanese',
      timezone: 'JST (UTC+9)',
      iataCode: 'NRT',
      region: 'East Asia',
      costLevel: 4,
      flightHoursFromUS: 14,
    });
  });

  it('returns null for an unknown country', () => {
    expect(lookupStaticFacts('XX')).toBeNull();
  });

  it('hasStaticFacts is a fast boolean check', () => {
    expect(hasStaticFacts('JP')).toBe(true);
    expect(hasStaticFacts('XX')).toBe(false);
  });

  it('handles lowercase ISO codes', () => {
    expect(lookupStaticFacts('jp')?.currency).toBe('JPY (¥)');
  });
});

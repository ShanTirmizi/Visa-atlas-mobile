import { findMatchingTrip, type MatchableTrip } from '../tripMatcher';

const trip = (overrides: Partial<MatchableTrip> & { _id: string }): MatchableTrip => ({
  countryCode: 'JPN',
  startDate: '2026-07-10',
  endDate: '2026-07-20',
  duration: 10,
  ...overrides,
});

describe('findMatchingTrip — country code present (existing behaviour)', () => {
  it('returns high confidence for country match + date overlap', () => {
    const trips = [trip({ _id: 't1', countryCode: 'JPN' })];
    const match = findMatchingTrip('JPN', '2026-07-12', '2026-07-14', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'high' });
  });

  it('returns medium confidence for date overlap on a single-country trip without country match', () => {
    const trips = [trip({ _id: 't1', countryCode: 'JPN' })];
    const match = findMatchingTrip('FRA', '2026-07-12', '2026-07-14', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'medium' });
  });

  it('matches legs of a multi-country trip at high confidence', () => {
    const trips = [
      trip({
        _id: 't1',
        countryCode: 'JPN',
        isMultiCountry: true,
        legs: JSON.stringify([{ countryCode: 'KOR' }]),
      }),
    ];
    const match = findMatchingTrip('KOR', '2026-07-12', '2026-07-14', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'high' });
  });

  it('returns null when dates do not overlap', () => {
    const trips = [trip({ _id: 't1' })];
    expect(findMatchingTrip('JPN', '2026-09-01', '2026-09-05', trips)).toBeNull();
  });

  it('returns null for an empty trip list', () => {
    expect(findMatchingTrip('JPN', '2026-07-12', '2026-07-14', [])).toBeNull();
  });
});

describe('findMatchingTrip — no country code (calendar import call shape)', () => {
  // utils/calendarSync.ts always calls findMatchingTrip(undefined, start, end, trips)
  // for imported events — they carry no country information.

  it('matches a single overlapping trip at high confidence', () => {
    const trips = [trip({ _id: 't1' })];
    const match = findMatchingTrip(undefined, '2026-07-12', '2026-07-14', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'high' });
  });

  it('matches a single-day event (start === end) inside the trip window', () => {
    const trips = [trip({ _id: 't1' })];
    const match = findMatchingTrip(undefined, '2026-07-15', '2026-07-15', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'high' });
  });

  it('matches an event landing within the 1-day buffer before the trip', () => {
    const trips = [trip({ _id: 't1', startDate: '2026-07-10', endDate: '2026-07-20' })];
    // Flight departing the evening before the trip starts.
    const match = findMatchingTrip(undefined, '2026-07-09', '2026-07-09', trips);
    expect(match).toEqual({ tripId: 't1', confidence: 'high' });
  });

  it('picks the largest overlap at medium confidence when several trips overlap', () => {
    const trips = [
      trip({ _id: 'short', startDate: '2026-07-13', endDate: '2026-07-14' }),
      trip({ _id: 'long', startDate: '2026-07-10', endDate: '2026-07-20' }),
    ];
    const match = findMatchingTrip(undefined, '2026-07-11', '2026-07-19', trips);
    expect(match).toEqual({ tripId: 'long', confidence: 'medium' });
  });

  it('returns null when nothing overlaps', () => {
    const trips = [trip({ _id: 't1' })];
    expect(findMatchingTrip(undefined, '2026-09-01', '2026-09-03', trips)).toBeNull();
  });

  it('returns null when the booking has no dates at all', () => {
    const trips = [trip({ _id: 't1' })];
    expect(findMatchingTrip(undefined, undefined, undefined, trips)).toBeNull();
  });

  it('derives the trip end from duration when endDate is missing', () => {
    const trips = [trip({ _id: 't1', endDate: undefined, duration: 5 })];
    // startDate 2026-07-10 + 5 days ⇒ window through 2026-07-15 (+1d buffer).
    const inside = findMatchingTrip(undefined, '2026-07-14', '2026-07-14', trips);
    expect(inside).toEqual({ tripId: 't1', confidence: 'high' });

    const outside = findMatchingTrip(undefined, '2026-07-20', '2026-07-20', trips);
    expect(outside).toBeNull();
  });

  it('skips trips without a startDate', () => {
    const trips = [trip({ _id: 't1', startDate: undefined })];
    expect(findMatchingTrip(undefined, '2026-07-12', '2026-07-14', trips)).toBeNull();
  });
});

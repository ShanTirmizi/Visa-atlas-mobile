// Tests for the pure itinerary/dining helpers in types/itinerary.ts —
// the data contract behind the day-detail timeline (DayTimeline), the
// Maps strip (utils/dayPlaces) and the server-side dining normalization.

import {
  chunkProse,
  stopsForSlot,
  hasStructuredStops,
  spotsForDayMeal,
  normalizeDiningGuide,
  mergeStopsIntoProposal,
  mergeDayUpdates,
  type ItineraryDay,
  type ItineraryStop,
  type DiningGuide,
  type DiningSpot,
} from '@/types/itinerary';

const baseDay = (overrides: Partial<ItineraryDay> = {}): ItineraryDay => ({
  day: 1,
  title: 'Test day',
  morning: '',
  afternoon: '',
  evening: '',
  ...overrides,
});

const spot = (overrides: Partial<DiningSpot> = {}): DiningSpot => ({
  name: 'Trattoria Vecchia',
  cuisine: 'Roman',
  price: '$$',
  area: 'Trastevere',
  knownFor: 'Carbonara',
  why: 'Fits the budget and the route.',
  meals: ['lunch'],
  ...overrides,
});

// ── chunkProse ───────────────────────────────────────────────────

describe('chunkProse', () => {
  it('splits multi-sentence prose into chunks of maxSentences', () => {
    const prose =
      'First sentence here. Second one follows. Third closes the loop. Fourth is extra.';
    expect(chunkProse(prose, 2)).toEqual([
      'First sentence here. Second one follows.',
      'Third closes the loop. Fourth is extra.',
    ]);
  });

  it('does not split on abbreviations like "St. Peter\'s"', () => {
    const prose =
      "Start at St. Peter's Basilica before the crowds arrive. Then climb the dome for the view.";
    expect(chunkProse(prose, 1)).toEqual([
      "Start at St. Peter's Basilica before the crowds arrive.",
      'Then climb the dome for the view.',
    ]);
  });

  it('keeps lowercase-follower periods (e.g. "9 a.m. start") intact', () => {
    const prose = 'Aim for a 9 a.m. start to beat the queues. Lunch comes later.';
    expect(chunkProse(prose, 1)).toEqual([
      'Aim for a 9 a.m. start to beat the queues.',
      'Lunch comes later.',
    ]);
  });

  it('returns a single chunk for a single sentence', () => {
    expect(chunkProse('Just one sentence.', 2)).toEqual(['Just one sentence.']);
  });

  it('returns the whole text when there is no terminator', () => {
    expect(chunkProse('No terminator at all', 2)).toEqual([
      'No terminator at all',
    ]);
  });

  it('returns [] for empty and whitespace-only input', () => {
    expect(chunkProse('', 2)).toEqual([]);
    expect(chunkProse('   ', 2)).toEqual([]);
  });
});

// ── stopsForSlot / hasStructuredStops ────────────────────────────

describe('stopsForSlot / hasStructuredStops', () => {
  const validMorning: ItineraryStop = {
    slot: 'morning',
    name: 'Tsukiji Outer Market',
    note: 'Graze the stalls before the crowds.',
    time: '08:30',
    duration: '1½ hrs',
    kind: 'market',
  };
  const validEvening: ItineraryStop = {
    slot: 'evening',
    name: 'Golden Gai',
    note: 'Bar-hop the tiny six-seaters.',
  };

  it('returns only valid stops for the requested slot, in order', () => {
    const day = baseDay({
      stops: [
        validMorning,
        { slot: 'morning', name: 'Second stop', note: 'Also morning.' },
        validEvening,
      ],
    });
    expect(stopsForSlot(day, 'morning').map((s) => s.name)).toEqual([
      'Tsukiji Outer Market',
      'Second stop',
    ]);
    expect(stopsForSlot(day, 'evening')).toEqual([validEvening]);
    expect(stopsForSlot(day, 'afternoon')).toEqual([]);
  });

  it('drops invalid entries (bad slot, empty name, missing note, junk)', () => {
    const day = baseDay({
      stops: [
        { slot: 'noon', name: 'Bad slot', note: 'x' },
        { slot: 'morning', name: '   ', note: 'empty name' },
        { slot: 'morning', name: 'No note' },
        'garbage',
        null,
        validMorning,
      ] as unknown as ItineraryStop[],
    });
    expect(stopsForSlot(day, 'morning')).toEqual([validMorning]);
  });

  it('hasStructuredStops is true only with ≥1 valid stop', () => {
    expect(hasStructuredStops(baseDay({ stops: [validMorning] }))).toBe(true);
    expect(hasStructuredStops(baseDay())).toBe(false);
    expect(hasStructuredStops(baseDay({ stops: [] }))).toBe(false);
    expect(
      hasStructuredStops(
        baseDay({
          stops: [{ slot: 'noon', name: 'x', note: 'y' }] as unknown as ItineraryStop[],
        }),
      ),
    ).toBe(false);
  });
});

// ── spotsForDayMeal ──────────────────────────────────────────────

describe('spotsForDayMeal', () => {
  const guide: DiningGuide = {
    intro: 'A food city.',
    mustTry: [],
    spots: [
      spot({ name: 'Lunch Day 1+2', days: [1, 2], meals: ['lunch'] }),
      spot({ name: 'Dinner Day 2', days: [2], meals: ['dinner'] }),
      spot({ name: 'No days', meals: ['lunch'] }),
      spot({ name: 'Both meals Day 3', days: [3], meals: ['lunch', 'dinner'] }),
    ],
  };

  it('matches on both day number and meal', () => {
    expect(spotsForDayMeal(guide, 2, 'lunch').map((s) => s.name)).toEqual([
      'Lunch Day 1+2',
    ]);
    expect(spotsForDayMeal(guide, 2, 'dinner').map((s) => s.name)).toEqual([
      'Dinner Day 2',
    ]);
    expect(spotsForDayMeal(guide, 3, 'dinner').map((s) => s.name)).toEqual([
      'Both meals Day 3',
    ]);
  });

  it('returns [] for a null guide, unmatched days, and spots without days', () => {
    expect(spotsForDayMeal(null, 1, 'lunch')).toEqual([]);
    expect(spotsForDayMeal(guide, 9, 'lunch')).toEqual([]);
    // 'No days' has no days[] — it must never match a specific day.
    expect(
      spotsForDayMeal(guide, 1, 'lunch').map((s) => s.name),
    ).toEqual(['Lunch Day 1+2']);
  });
});

// ── mergeStopsIntoProposal ───────────────────────────────────────

describe('mergeStopsIntoProposal', () => {
  const morningStop: ItineraryStop = {
    slot: 'morning',
    name: 'Tsukiji Outer Market',
    note: 'Graze the stalls before the crowds.',
  };
  const afternoonStop: ItineraryStop = {
    slot: 'afternoon',
    name: 'teamLab Planets',
    note: 'Book the first afternoon slot.',
  };
  const eveningStop: ItineraryStop = {
    slot: 'evening',
    name: 'Golden Gai',
    note: 'Bar-hop the tiny six-seaters.',
  };

  const currentDay = (overrides: Partial<ItineraryDay> = {}): ItineraryDay =>
    baseDay({
      morning: 'Morning prose.',
      afternoon: 'Afternoon prose.',
      evening: 'Evening prose.',
      stops: [morningStop, afternoonStop, eveningStop],
      ...overrides,
    });

  it('carries current stops onto a legacy proposal day with unchanged prose', () => {
    const current = [currentDay()];
    // Legacy rewrite: same prose, no `stops` key at all.
    const proposal = [
      baseDay({
        morning: 'Morning prose.',
        afternoon: 'Afternoon prose.',
        evening: 'Evening prose.',
      }),
    ];
    const merged = mergeStopsIntoProposal(current, proposal);
    expect(merged[0].stops).toEqual([morningStop, afternoonStop, eveningStop]);
  });

  it('drops only the slots whose prose changed', () => {
    const current = [currentDay()];
    const proposal = [
      baseDay({
        morning: 'Morning prose.',
        afternoon: 'A completely rewritten afternoon.',
        evening: 'Evening prose.',
      }),
    ];
    const merged = mergeStopsIntoProposal(current, proposal);
    // Afternoon prose changed → its stop is stale and dropped; the other
    // two slots keep theirs.
    expect(merged[0].stops).toEqual([morningStop, eveningStop]);
  });

  it('trusts a proposal day that carries its own usable stops as-is', () => {
    const ownStop: ItineraryStop = {
      slot: 'morning',
      name: 'Shibuya Sky',
      note: 'Sunset deck, book ahead.',
    };
    const current = [currentDay()];
    const proposal = [
      baseDay({
        morning: 'New morning prose.',
        stops: [ownStop],
      }),
    ];
    const merged = mergeStopsIntoProposal(current, proposal);
    expect(merged[0].stops).toEqual([ownStop]);
  });

  it('matches the current day by day NUMBER, not array position', () => {
    // Current has days 1 and 3 (day 2 was a filtered-out null hole);
    // the proposal only contains day 3 — at array index 0.
    const current = [
      currentDay({ day: 1, stops: [morningStop] }),
      currentDay({ day: 3, stops: [eveningStop] }),
    ];
    const proposal = [
      baseDay({
        day: 3,
        morning: 'Morning prose.',
        afternoon: 'Afternoon prose.',
        evening: 'Evening prose.',
      }),
    ];
    const merged = mergeStopsIntoProposal(current, proposal);
    // Positional matching would have carried day 1's morning stop.
    expect(merged[0].stops).toEqual([eveningStop]);
  });

  it('passes garbage proposal entries through untouched', () => {
    const current = [currentDay()];
    const proposal = [null, 'junk', 42, baseDay({ morning: 'Morning prose.' })] as unknown as ItineraryDay[];
    const merged = mergeStopsIntoProposal(current, proposal);
    expect(merged[0]).toBeNull();
    expect(merged[1]).toBe('junk');
    expect(merged[2]).toBe(42);
    expect(merged).toHaveLength(4);
    // The one real day still merges normally despite the garbage around
    // it: day-number match (both day 1) carries the morning stop, whose
    // prose is unchanged; the empty afternoon/evening prose reads as
    // changed, so those stops drop.
    expect((merged[3] as ItineraryDay).stops).toEqual([morningStop]);
  });

  it('leaves a proposal day stop-less when no current day matches', () => {
    const current = [currentDay({ day: 1 })];
    const proposal = [
      baseDay({ day: 1, morning: 'Morning prose.' }),
      baseDay({ day: 5, title: 'Brand new day', morning: 'Fresh.' }),
    ];
    const merged = mergeStopsIntoProposal(current, proposal);
    expect(merged[1].stops).toBeUndefined();
  });
});

// ── normalizeDiningGuide ─────────────────────────────────────────

describe('normalizeDiningGuide', () => {
  it('returns null on garbage input', () => {
    expect(normalizeDiningGuide(null, 5)).toBeNull();
    expect(normalizeDiningGuide(42, 5)).toBeNull();
    expect(normalizeDiningGuide('nope', 5)).toBeNull();
    expect(normalizeDiningGuide({}, 5)).toBeNull();
    expect(normalizeDiningGuide({ intro: 'x', spots: [] }, 5)).toBeNull();
  });

  it('drops invalid spots and keeps valid ones', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'Great food scene.',
        spots: [
          spot(),
          { ...spot(), price: 'cheap' }, // bad enum
          { ...spot(), name: '' }, // missing required
          'garbage',
          null,
        ],
      },
      5,
    );
    expect(result).not.toBeNull();
    expect(result!.spots).toHaveLength(1);
    expect(result!.spots[0].name).toBe('Trattoria Vecchia');
  });

  it('returns null when no spot survives', () => {
    expect(
      normalizeDiningGuide(
        { intro: 'x', spots: [{ ...spot(), price: 'free' }] },
        5,
      ),
    ).toBeNull();
  });

  it('clamps days to [1, duration], coerces numerics, dedupes and sorts', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'x',
        spots: [spot({ days: [5, 0, 1, '2', 3.5, 99, 1] as unknown as number[] })],
      },
      5,
    );
    expect(result!.spots[0].days).toEqual([1, 2, 5]);
  });

  it('coerces enums: filters bad meals, drops bad crowd, keeps good crowd', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'x',
        spots: [
          spot({
            meals: ['lunch', 'brunch'] as unknown as DiningSpot['meals'],
            crowd: 'amazing' as unknown as DiningSpot['crowd'],
          }),
          spot({ name: 'Second', crowd: 'institution', meals: ['dinner'] }),
        ],
      },
      5,
    );
    expect(result!.spots[0].meals).toEqual(['lunch']);
    expect(result!.spots[0].crowd).toBeUndefined();
    expect('crowd' in result!.spots[0]).toBe(false);
    expect(result!.spots[1].crowd).toBe('institution');
  });

  it('dedupes repeated meal tags (duplicate tags would render colliding day chips)', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'x',
        spots: [
          spot({
            meals: ['lunch', 'lunch', 'dinner', 'lunch'] as DiningSpot['meals'],
          }),
        ],
      },
      5,
    );
    expect(result!.spots[0].meals).toEqual(['lunch', 'dinner']);
  });

  it('only sets reserveAhead when literally true', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'x',
        spots: [
          spot({ reserveAhead: true }),
          spot({ name: 'Second', reserveAhead: 'yes' as unknown as boolean }),
        ],
      },
      5,
    );
    expect(result!.spots[0].reserveAhead).toBe(true);
    expect(result!.spots[1].reserveAhead).toBeUndefined();
  });

  it('drops mustTry entries without a dish and clamps long strings', () => {
    const result = normalizeDiningGuide(
      {
        intro: 'x',
        mustTry: [
          { dish: 'Cacio e pepe', note: 'The benchmark.' },
          { note: 'No dish here.' },
          'junk',
        ],
        spots: [spot({ name: `A${'b'.repeat(200)}` })],
      },
      5,
    );
    expect(result!.mustTry).toEqual([
      { dish: 'Cacio e pepe', note: 'The benchmark.' },
    ]);
    expect(result!.spots[0].name.length).toBeLessThanOrEqual(80);
  });
});

// ── mergeDayUpdates (chat partial/full proposals) ────────────────
describe('mergeDayUpdates', () => {
  const days = (...nums: number[]): ItineraryDay[] =>
    nums.map((n) => baseDay({ day: n, title: `Day ${n}` }));

  it('replaceAll=true returns the proposal verbatim (structural changes)', () => {
    const current = days(1, 2, 3, 4);
    const proposal = days(1, 2, 3); // shortened to 3 days
    expect(mergeDayUpdates(current, proposal, true)).toEqual(proposal);
  });

  it('replaceAll=false replaces only the matching day, leaving others intact', () => {
    const current = days(1, 2, 3);
    const edited = baseDay({ day: 2, title: 'Relaxed Day 2', evening: 'New plan' });
    const merged = mergeDayUpdates(current, [edited], false);
    expect(merged).toHaveLength(3);
    expect(merged[0].title).toBe('Day 1');
    expect(merged[1]).toEqual(edited); // day 2 swapped
    expect(merged[2].title).toBe('Day 3');
  });

  it('preserves current order when the partial proposal is out of order', () => {
    const current = days(1, 2, 3);
    const merged = mergeDayUpdates(
      current,
      [baseDay({ day: 3, title: 'X' }), baseDay({ day: 1, title: 'Y' })],
      false,
    );
    expect(merged.map((d) => d.day)).toEqual([1, 2, 3]);
    expect(merged[0].title).toBe('Y');
    expect(merged[2].title).toBe('X');
  });

  it('empty partial proposal is a no-op', () => {
    const current = days(1, 2);
    expect(mergeDayUpdates(current, [], false)).toEqual(current);
  });

  it('appends a genuinely new day number from the partial channel', () => {
    const current = days(1, 2);
    const merged = mergeDayUpdates(current, [baseDay({ day: 3, title: 'Added' })], false);
    expect(merged.map((d) => d.day)).toEqual([1, 2, 3]);
  });

  it('carries structured stops through (so chat edits actually render)', () => {
    const stop: ItineraryStop = { slot: 'evening', name: 'Yarra River walk', note: 'Stroll' };
    const current = days(1, 2);
    const edited = baseDay({ day: 1, stops: [stop] });
    const merged = mergeDayUpdates(current, [edited], false);
    expect(hasStructuredStops(merged[0])).toBe(true);
    expect(merged[0].stops?.[0].name).toBe('Yarra River walk');
  });
});

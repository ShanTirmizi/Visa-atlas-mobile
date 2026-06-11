import {
  VISA_BUFFER_DAYS,
  parseProcessingDays,
  parseISODateLocal,
  diffInDays,
  deadlineStatusFor,
  deriveVisaDeadline,
  formatDeadlineDate,
  formatProcessingPhrase,
  formatBufferPhrase,
  buildDeadlineCopy,
} from '../visaDeadline';

describe('parseProcessingDays', () => {
  describe('plain day counts', () => {
    it('parses singular and plural days', () => {
      expect(parseProcessingDays('1 day')).toBe(1);
      expect(parseProcessingDays('5 days')).toBe(5);
      expect(parseProcessingDays('30 days')).toBe(30);
    });

    it('is case/whitespace tolerant', () => {
      expect(parseProcessingDays('  10 Days  ')).toBe(10);
      expect(parseProcessingDays('About 10 days')).toBe(10);
    });
  });

  describe('weeks', () => {
    it('converts weeks to days', () => {
      expect(parseProcessingDays('4 weeks')).toBe(28);
      expect(parseProcessingDays('1 week')).toBe(7);
    });
  });

  describe('ranges take the max (conservative bound)', () => {
    it('hyphen ranges', () => {
      expect(parseProcessingDays('2-3 weeks')).toBe(21);
      expect(parseProcessingDays('5-10 days')).toBe(10);
    });

    it('en-dash ranges from the static visa table', () => {
      expect(parseProcessingDays('1–4 weeks')).toBe(28);
      expect(parseProcessingDays('3–8 weeks')).toBe(56);
      expect(parseProcessingDays('4–8 weeks')).toBe(56);
    });

    it('"to"/"or" ranges', () => {
      expect(parseProcessingDays('3 to 8 weeks')).toBe(56);
      expect(parseProcessingDays('2 or 3 days')).toBe(3);
    });

    it('mixed-unit alternatives keep the overall max', () => {
      expect(parseProcessingDays('3 days, or 2 weeks for rush cases')).toBe(14);
    });
  });

  describe('sub-day turnarounds count as same-day (0)', () => {
    it('minutes (static table format, no space)', () => {
      expect(parseProcessingDays('15min')).toBe(0);
      expect(parseProcessingDays('20 min')).toBe(0);
    });

    it('hours under a day', () => {
      expect(parseProcessingDays('12 hours')).toBe(0);
    });

    it('hours of a day or more round up to whole days', () => {
      expect(parseProcessingDays('48 hours')).toBe(2);
      expect(parseProcessingDays('72 hrs')).toBe(3);
    });

    it('same-day phrasings', () => {
      expect(parseProcessingDays('Same day')).toBe(0);
      expect(parseProcessingDays('same-day issuance')).toBe(0);
    });
  });

  describe('business days and months', () => {
    it('converts business days to calendar days (×7/5, ceil)', () => {
      expect(parseProcessingDays('10 business days')).toBe(14);
      expect(parseProcessingDays('5 working days')).toBe(7);
    });

    it('months convert at 30 days', () => {
      expect(parseProcessingDays('2 months')).toBe(60);
    });
  });

  describe('open-ended counts', () => {
    it('"10+ days" parses as 10', () => {
      expect(parseProcessingDays('10+ days')).toBe(10);
    });
  });

  describe('honesty rule — unparseable returns null', () => {
    it('returns null for vague or missing values', () => {
      expect(parseProcessingDays(undefined)).toBeNull();
      expect(parseProcessingDays(null)).toBeNull();
      expect(parseProcessingDays('')).toBeNull();
      expect(parseProcessingDays('   ')).toBeNull();
      expect(parseProcessingDays('—')).toBeNull();
      expect(parseProcessingDays('varies')).toBeNull();
      expect(parseProcessingDays('depends on embassy')).toBeNull();
    });

    it('does not misread document counts as durations', () => {
      expect(parseProcessingDays('6 docs')).toBeNull();
    });
  });
});

describe('parseISODateLocal', () => {
  it('parses YYYY-MM-DD to local midnight', () => {
    const d = parseISODateLocal('2026-07-11');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
    expect(d!.getDate()).toBe(11);
    expect(d!.getHours()).toBe(0);
  });

  it('rejects garbage', () => {
    expect(parseISODateLocal('not a date')).toBeNull();
  });
});

describe('deadlineStatusFor', () => {
  it('buckets by days left', () => {
    expect(deadlineStatusFor(22)).toBe('calm');
    expect(deadlineStatusFor(21)).toBe('soon');
    expect(deadlineStatusFor(0)).toBe('soon'); // deadline is today — still doable
    expect(deadlineStatusFor(-1)).toBe('overdue');
  });
});

describe('deriveVisaDeadline', () => {
  // Trip departs Jul 11; "5 days" processing → deadline = Jul 11 − (5 + 14) = Jun 22.
  const START = '2026-07-11';

  it('computes deadline = start − (processing + 14-day buffer)', () => {
    const info = deriveVisaDeadline({
      startDate: START,
      processingTime: '5 days',
      today: new Date(2026, 4, 1), // May 1
    });
    expect(info).not.toBeNull();
    expect(formatDeadlineDate(info!.deadline)).toBe('Jun 22');
    expect(info!.processingDays).toBe(5);
    expect(info!.bufferDays).toBe(VISA_BUFFER_DAYS);
    expect(info!.status).toBe('calm');
  });

  it('flips to soon at 21 days out and overdue past the deadline', () => {
    const soon = deriveVisaDeadline({
      startDate: START,
      processingTime: '5 days',
      today: new Date(2026, 5, 1), // Jun 1 → 21 days to Jun 22
    });
    expect(soon!.daysLeft).toBe(21);
    expect(soon!.status).toBe('soon');

    const overdue = deriveVisaDeadline({
      startDate: START,
      processingTime: '5 days',
      today: new Date(2026, 5, 30), // Jun 30 — past Jun 22
    });
    expect(overdue!.daysLeft).toBe(-8);
    expect(overdue!.status).toBe('overdue');
  });

  it('prefers the streamed value but falls back to static when unparseable', () => {
    const info = deriveVisaDeadline({
      startDate: START,
      processingTime: 'varies', // streamed, unparseable
      fallbackProcessingTime: '10 days',
      today: new Date(2026, 4, 1),
    });
    expect(info!.processingDays).toBe(10);
    expect(formatDeadlineDate(info!.deadline)).toBe('Jun 17');
  });

  it('returns null when nothing parses — no fake deadlines', () => {
    expect(
      deriveVisaDeadline({
        startDate: START,
        processingTime: 'varies',
        fallbackProcessingTime: undefined,
        today: new Date(2026, 4, 1),
      }),
    ).toBeNull();
  });

  it('returns null for dreaming trips (no start date)', () => {
    expect(
      deriveVisaDeadline({ startDate: undefined, processingTime: '5 days' }),
    ).toBeNull();
    expect(deriveVisaDeadline({ startDate: '', processingTime: '5 days' })).toBeNull();
  });

  it('returns null once the trip has departed', () => {
    expect(
      deriveVisaDeadline({
        startDate: START,
        processingTime: '5 days',
        today: new Date(2026, 6, 12), // Jul 12 — trip started Jul 11
      }),
    ).toBeNull();
  });

  it('still renders on departure day itself', () => {
    const info = deriveVisaDeadline({
      startDate: START,
      processingTime: '5 days',
      today: new Date(2026, 6, 11), // Jul 11
    });
    expect(info).not.toBeNull();
    expect(info!.status).toBe('overdue');
  });
});

describe('copy builders', () => {
  it('formats phrases', () => {
    expect(formatProcessingPhrase(5)).toBe('5-day processing');
    expect(formatProcessingPhrase(21)).toBe('3-week processing');
    expect(formatProcessingPhrase(0)).toBe('Same-day processing');
    expect(formatBufferPhrase(14)).toBe('2-week buffer');
  });

  it('builds the calm/soon card copy', () => {
    const info = deriveVisaDeadline({
      startDate: '2026-07-11',
      processingTime: '5 days',
      today: new Date(2026, 4, 1),
    })!;
    expect(buildDeadlineCopy(info)).toEqual({
      kicker: 'APPLY BY',
      headline: 'Jun 22',
      sub: '5-day processing + 2-week buffer before Jul 11',
    });
  });

  it('switches to Apply now copy when overdue', () => {
    const info = deriveVisaDeadline({
      startDate: '2026-07-11',
      processingTime: '5 days',
      today: new Date(2026, 5, 30),
    })!;
    expect(buildDeadlineCopy(info)).toEqual({
      kicker: 'DEADLINE PASSED',
      headline: 'Apply now',
      sub: '5 days of processing needed before Jul 11',
    });
  });

  it('handles same-day processing in the overdue copy', () => {
    const info = deriveVisaDeadline({
      startDate: '2026-07-11',
      processingTime: '15min',
      today: new Date(2026, 6, 1), // Jul 1 — deadline was Jun 27
    })!;
    expect(info.status).toBe('overdue');
    expect(buildDeadlineCopy(info).sub).toBe('Same-day processing — apply before Jul 11');
  });
});

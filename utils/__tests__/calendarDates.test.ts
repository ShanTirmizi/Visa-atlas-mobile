/**
 * Regression tests for the calendar-import UTC date shift.
 *
 * The old implementation converted event dates with toISOString(), which
 * re-expresses the instant in UTC — on any device east of Greenwich
 * (IST, CET, JST...) an event in the early local hours (e.g. a 1AM
 * flight) imported with the previous calendar date, and all-day events
 * (anchored at local midnight by expo-calendar) shifted back a full day.
 *
 * The spec is "local date parts": an event lands on the calendar day the
 * device's clock says it occurs on — exactly how Apple/Google Calendar
 * render it. These tests construct Dates via local-clock parts so they
 * assert that spec on whatever timezone runs them; under the old
 * toISOString() code every pre-UTC-rollover case below fails on any
 * UTC+ machine (jest can't fake the process TZ — process.env is a copy
 * inside the test sandbox, so we don't pretend to set it).
 */
import { toLocalISODateString } from '../calendarDates';

/** The spec, written independently of the implementation. */
function localParts(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('toLocalISODateString — keeps the local calendar date', () => {
  it('keeps the local calendar date for a 1AM datetime (the IST flight case)', () => {
    // 1AM local — for any UTC+ zone (IST +5:30, CET +1...) this instant is
    // still "yesterday" in UTC, which is exactly what the old code shipped.
    const oneAmLocal = new Date(2026, 2, 15, 1, 0, 0); // 2026-03-15 01:00 local
    expect(toLocalISODateString(oneAmLocal)).toBe('2026-03-15');
  });

  it('does not shift an all-day event (local-midnight anchor)', () => {
    // expo-calendar anchors all-day events at local midnight on the device.
    const allDay = new Date(2026, 5, 15); // 2026-06-15 00:00 local
    expect(toLocalISODateString(allDay)).toBe('2026-06-15');
  });

  it('renders a fixed IST instant on the day the local clock shows', () => {
    // A 1AM IST departure. Whatever timezone runs this suite, the import
    // must agree with how the device calendar displays the event — its
    // LOCAL date parts — never the UTC re-expression.
    const istInstant = new Date('2026-03-15T01:00:00+05:30');
    expect(toLocalISODateString(istInstant)).toBe(localParts(istInstant));
  });

  it('accepts ISO datetime strings and matches the equivalent Date', () => {
    const iso = '2026-03-15T01:00:00+05:30';
    expect(toLocalISODateString(iso)).toBe(toLocalISODateString(new Date(iso)));
  });

  it('agrees with local date parts for every hour across a UTC rollover', () => {
    // Property: for a 48h sweep around a UTC midnight, the conversion must
    // equal the local-parts rendering at every step. The old toISOString()
    // implementation breaks this for several hours of every day on any
    // machine whose offset isn't zero.
    const base = Date.UTC(2026, 2, 14, 0, 0, 0);
    for (let h = 0; h < 48; h++) {
      const d = new Date(base + h * 60 * 60 * 1000);
      expect(toLocalISODateString(d)).toBe(localParts(d));
    }
  });

  it('passes midday datetimes through unchanged (sanity)', () => {
    expect(toLocalISODateString(new Date(2026, 7, 2, 12, 0))).toBe('2026-08-02');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toLocalISODateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

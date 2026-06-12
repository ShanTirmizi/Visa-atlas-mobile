// Local calendar-date helpers.
//
// `date.toISOString().slice(0, 10)` formats the UTC calendar day, which is
// the WRONG day for any user east/west of UTC near midnight (and for any
// Date constructed from local Y/M/D parts in a non-UTC zone — e.g. a picker
// date of "Mar 12 00:00 GMT+5" serialises as "Mar 11"). Always derive the
// Y-M-D string from the LOCAL date parts instead.

/** Format a Date as `YYYY-MM-DD` using its LOCAL calendar parts. */
export function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date.
 *  Returns null for empty/malformed input. */
export function fromLocalYMD(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, m - 1, d);
}

/** Add `days` to a `YYYY-MM-DD` string, returning a `YYYY-MM-DD` string.
 *  Falls back to the input when it can't be parsed. */
export function addDaysYMD(value: string, days: number): string {
  const date = fromLocalYMD(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return toLocalYMD(date);
}

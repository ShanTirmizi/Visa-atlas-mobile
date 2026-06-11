/**
 * passportData — pure helpers shared by the Passport stamp wall
 * (app/more/passport.tsx) and the settings row that links to it.
 *
 * Everything here is deterministic: stamp rotation, ink tone, and shape all
 * derive from the trip id via a string hash — NO Math.random at render, so
 * the wall never reshuffles between visits (a real passport doesn't either).
 */
import type { ThemeColors } from '@/constants/theme';

/** Minimal structural slice of a trip doc the passport wall cares about. */
export interface StampableTrip {
  status: string;
  startDate?: string;
  endDate?: string;
}

/**
 * A trip earns a passport stamp once it's behind you: either explicitly
 * marked completed, or its end date has passed. (listTrips already filters
 * soft-deleted trips server-side.)
 */
export function isPassportStampTrip(
  trip: StampableTrip,
  now: number = Date.now(),
): boolean {
  if (trip.status === 'completed') return true;
  if (!trip.endDate) return false;
  const end = new Date(trip.endDate).getTime();
  return Number.isFinite(end) && end < now;
}

/**
 * djb2 string hash — tiny, stable, good spread for short ids.
 * Used to derive per-stamp rotation / ink / shape from the trip id.
 */
export function hashTripId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic rotation in the ±6° range — slight, hand-pressed feel. */
export function stampRotation(id: string): number {
  // 121 steps of 0.1° across −6…+6 — fine enough that no two stamps look
  // machine-aligned, coarse enough to stay deterministic.
  return (hashTripId(id) % 121) / 10 - 6;
}

/** Ink tones rotate through teal / coral-deep / ink — the house stamp inks. */
export function stampInk(id: string, colors: ThemeColors): string {
  const inks = [colors.teal, colors.coralDeep, colors.ink];
  // Different bits than the rotation hash so ink and tilt don't correlate.
  return inks[Math.floor(hashTripId(id) / 7) % inks.length];
}

const STAMP_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

/**
 * Entry-stamp date format: `14 JUN 2026` — the all-caps DD MMM YYYY layout
 * real border stamps use. Falls back to the trip's creation time so a
 * completed-but-undated trip still reads as a dated entry.
 */
export function formatStampDate(
  iso: string | undefined,
  fallbackMs: number,
): string {
  const d = iso ? new Date(iso) : new Date(fallbackMs);
  const t = d.getTime();
  const safe = Number.isFinite(t) ? d : new Date(fallbackMs);
  return `${String(safe.getDate()).padStart(2, '0')} ${STAMP_MONTHS[safe.getMonth()]} ${safe.getFullYear()}`;
}

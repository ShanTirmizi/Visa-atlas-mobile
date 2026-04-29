/**
 * Best-time status — compares the current month to a country's `bestMonths`
 * list and classifies how good *right now* is to visit.
 *
 *  - good    (green)  : current month is in bestMonths
 *  - shoulder (amber) : current month is adjacent to bestMonths (±1)
 *  - avoid   (red)    : neither
 *
 * The returned color comes from the Mono theme's visa-category palette so
 * it stays consistent with the rest of the app's color language.
 */

import type { ThemeColors } from '@/constants/theme';

export type BestTimeStatus = 'good' | 'shoulder' | 'avoid';

/**
 * @param bestMonths list of 1-12 good months (as stored in travelData)
 * @param currentMonth optional — defaults to "now" in the user's locale
 */
export function bestTimeStatus(
  bestMonths: number[] | undefined,
  currentMonth: number = new Date().getMonth() + 1,
): BestTimeStatus {
  if (!bestMonths || bestMonths.length === 0) return 'shoulder';
  if (bestMonths.includes(currentMonth)) return 'good';

  // Adjacent month (wrap around: Dec ↔ Jan)
  const prev = currentMonth === 1 ? 12 : currentMonth - 1;
  const next = currentMonth === 12 ? 1 : currentMonth + 1;
  if (bestMonths.includes(prev) || bestMonths.includes(next)) return 'shoulder';

  return 'avoid';
}

export function bestTimeColor(status: BestTimeStatus, colors: ThemeColors): string {
  switch (status) {
    case 'good':
      return colors.visaFree; // Mono green
    case 'shoulder':
      return colors.visaOnArrival; // Mono gold/amber
    case 'avoid':
      return colors.visaRequired; // Mono plum/red
  }
}

export function bestTimeLabel(status: BestTimeStatus): string {
  switch (status) {
    case 'good':
      return 'Go now';
    case 'shoulder':
      return 'Shoulder';
    case 'avoid':
      return 'Off season';
  }
}

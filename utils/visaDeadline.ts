// "Apply by" deadline math for the trip Visa tab.
//
// Pure date/string logic with zero React Native imports so the jest `logic`
// project (ts-jest, node env) can exercise it directly.
//
// Honesty rule: if neither the streamed nor the static processing time can be
// parsed, `deriveVisaDeadline` returns null and the UI renders nothing.
// No fake deadlines.

/** Safety margin added on top of the visa processing time. */
export const VISA_BUFFER_DAYS = 14;

/**
 * Urgency buckets for the deadline card.
 *  calm    — more than 21 days of runway (teal/ink tints)
 *  soon    — 21 days or fewer remaining, deadline not yet past (coral)
 *  overdue — the apply-by date has passed (danger)
 */
export type DeadlineStatus = 'calm' | 'soon' | 'overdue';

export interface VisaDeadlineInfo {
  /** Local-midnight date the traveller should apply by. */
  deadline: Date;
  /** Local-midnight trip start date. */
  start: Date;
  /** Parsed processing time in calendar days (0 = same-day issuance). */
  processingDays: number;
  bufferDays: number;
  /** Whole days from `today` to the deadline. Negative when the deadline passed. */
  daysLeft: number;
  status: DeadlineStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Matches "5 days", "2-3 weeks", "1–4 weeks" (en/em dash), "3 to 8 weeks",
// "15min", "48 hours", "10 business days", "10+ days", "2 months".
// Ranges keep the max.
const DURATION_RE =
  /(\d+(?:\.\d+)?)\s*\+?\s*(?:[-–—~]|to|or)?\s*(\d+(?:\.\d+)?)?\s*(business|working)?\s*(minutes?|mins?|min|hours?|hrs?|days?|weeks?|wks?|months?|mos)\b/gi;

function canonicalUnit(raw: string): 'minute' | 'hour' | 'day' | 'week' | 'month' | null {
  const u = raw.toLowerCase();
  if (u.startsWith('min')) return 'minute';
  if (u.startsWith('h')) return 'hour';
  if (u.startsWith('d')) return 'day';
  if (u.startsWith('w')) return 'week';
  if (u.startsWith('mo')) return 'month';
  return null;
}

/** Calendar days represented by one unit. Business days ≈ 7/5 calendar days. */
function unitToDays(unit: 'minute' | 'hour' | 'day' | 'week' | 'month', business: boolean): number {
  switch (unit) {
    case 'minute':
      return 1 / (24 * 60);
    case 'hour':
      return 1 / 24;
    case 'day':
      return business ? 7 / 5 : 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
  }
}

/**
 * Tolerant processing-time parser. Accepts the streamed LLM vocabulary
 * ("5 days", "2-3 weeks") and the static table's ("15min", "1–4 weeks",
 * "10 business days", "Same day"). Ranges resolve to the max — the honest,
 * conservative bound. Returns calendar days, 0 for sub-day turnarounds,
 * or null when nothing parseable is found ("varies", "—", undefined).
 */
export function parseProcessingDays(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // Instant-issue phrasings → zero processing days (the buffer still applies).
  if (/same[\s-]?day|instant|immediate|on the spot|while you wait/.test(text)) {
    return 0;
  }

  let maxDays: number | null = null;
  for (const m of text.matchAll(DURATION_RE)) {
    const unit = canonicalUnit(m[4]);
    if (!unit) continue;
    const business = !!m[3] && unit === 'day';
    const hi = Math.max(parseFloat(m[1]), m[2] !== undefined ? parseFloat(m[2]) : -Infinity);
    const days = hi * unitToDays(unit, business);
    if (!Number.isFinite(days)) continue;
    maxDays = maxDays === null ? days : Math.max(maxDays, days);
  }
  if (maxDays === null) return null;
  // Sub-day turnarounds (minutes/hours) count as same-day processing.
  return maxDays < 1 ? 0 : Math.ceil(maxDays);
}

/** Parse 'YYYY-MM-DD' to a local-midnight Date (UTC parsing would shift the day). */
export function parseISODateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Whole-day difference between two dates (rounding absorbs DST hour shifts). */
export function diffInDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function deadlineStatusFor(daysLeft: number): DeadlineStatus {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 21) return 'soon';
  return 'calm';
}

/**
 * deadline = startDate − (processingDays + VISA_BUFFER_DAYS).
 *
 * Returns null when: there's no/invalid start date (dreaming trips), neither
 * processing-time string parses, or the trip already departed (nothing left
 * to apply for).
 */
export function deriveVisaDeadline(opts: {
  /** Trip start date, 'YYYY-MM-DD'. */
  startDate: string | null | undefined;
  /** Streamed trip.visaProcessingTime — preferred (passport-aware). */
  processingTime?: string | null;
  /** Static country.processingTime — used when the streamed value is missing or unparseable. */
  fallbackProcessingTime?: string | null;
  /** Injectable clock for tests; defaults to now. */
  today?: Date;
}): VisaDeadlineInfo | null {
  if (!opts.startDate) return null;
  const start = parseISODateLocal(opts.startDate);
  if (!start) return null;

  const processingDays =
    parseProcessingDays(opts.processingTime) ?? parseProcessingDays(opts.fallbackProcessingTime);
  if (processingDays === null) return null;

  const today = startOfDay(opts.today ?? new Date());
  if (start.getTime() < today.getTime()) return null;

  const deadline = addDays(start, -(processingDays + VISA_BUFFER_DAYS));
  const daysLeft = diffInDays(today, deadline);
  return {
    deadline,
    start,
    processingDays,
    bufferDays: VISA_BUFFER_DAYS,
    daysLeft,
    status: deadlineStatusFor(daysLeft),
  };
}

// ── Copy builders ──────────────────────────────────────────
// Kept here (not in the component) so the exact strings are unit-testable.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "May 30" — editorial short date, no year (deadlines are always near-term). */
export function formatDeadlineDate(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "5-day processing", "3-week processing", "Same-day processing". */
export function formatProcessingPhrase(days: number): string {
  if (days === 0) return 'Same-day processing';
  if (days % 7 === 0) return `${days / 7}-week processing`;
  return `${days}-day processing`;
}

/** "2-week buffer" (falls back to days for non-week buffers). */
export function formatBufferPhrase(days: number): string {
  if (days % 7 === 0) return `${days / 7}-week buffer`;
  return `${days}-day buffer`;
}

export interface DeadlineCopy {
  kicker: string;
  headline: string;
  sub: string;
}

/**
 * calm/soon — kicker "APPLY BY", headline "May 30",
 *             sub "5-day processing + 2-week buffer before Jul 11".
 * overdue   — kicker "DEADLINE PASSED", headline "Apply now",
 *             sub "5 days of processing needed before Jul 11".
 */
export function buildDeadlineCopy(info: VisaDeadlineInfo): DeadlineCopy {
  const startLabel = formatDeadlineDate(info.start);
  if (info.status === 'overdue') {
    const sub =
      info.processingDays === 0
        ? `Same-day processing — apply before ${startLabel}`
        : `${info.processingDays} ${info.processingDays === 1 ? 'day' : 'days'} of processing needed before ${startLabel}`;
    return { kicker: 'DEADLINE PASSED', headline: 'Apply now', sub };
  }
  return {
    kicker: 'APPLY BY',
    headline: formatDeadlineDate(info.deadline),
    sub: `${formatProcessingPhrase(info.processingDays)} + ${formatBufferPhrase(info.bufferDays)} before ${startLabel}`,
  };
}

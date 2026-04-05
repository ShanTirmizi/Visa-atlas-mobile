// Visa Atlas — Calendar Event Classification Pipeline
// Scores calendar events as potential travel bookings

import {
  KNOWN_ORGANIZERS,
  TYPE_KEYWORDS,
  GENERIC_TRAVEL_KEYWORDS,
  CONFIDENCE,
  SCORE_WEIGHTS,
} from '@/constants/calendarProviders';
import type { BookingType } from '@/constants/bookings';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  notes?: string;
  location?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  organizer?: string; // email or name
  allDay?: boolean; // all-day events are almost never bookings
}

export interface ClassifiedEvent {
  event: CalendarEvent;
  confidence: number; // 0-1
  bookingType: BookingType;
  provider: string; // detected provider name or 'Calendar'
  signals: string[]; // human-readable reasons for classification
}

// ──────────────────────────────────────────────
// Single-event classifier
// ──────────────────────────────────────────────

export function classifyEvent(event: CalendarEvent): ClassifiedEvent | null {
  // All-day events are almost never travel bookings (holidays, birthdays, etc.)
  if (event.allDay) return null;

  const combined = [
    event.title ?? '',
    event.notes ?? '',
    event.organizer ?? '',
  ]
    .join(' ')
    .toLowerCase();

  let confidence = 0;
  let detectedType: BookingType | null = null;
  let provider = 'Calendar';
  const signals: string[] = [];

  // ── Step 1: Check known organizers ──
  let organizerMatched = false;

  for (const [domain, info] of Object.entries(KNOWN_ORGANIZERS)) {
    if (combined.includes(domain)) {
      confidence += SCORE_WEIGHTS.KNOWN_ORGANIZER;
      detectedType = info.type;
      provider = info.provider;
      signals.push(`Known provider: ${info.provider}`);
      organizerMatched = true;
      break;
    }
  }

  // ── Step 2: Check type keywords (only if no organizer match) ──
  if (!organizerMatched) {
    let bestKeywordScore = 0;
    let bestKeywordType: BookingType | null = null;

    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [BookingType, string[]][]) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (combined.includes(keyword.toLowerCase())) {
          matchCount++;
          signals.push(`Keyword match: "${keyword}"`);
        }
      }

      const keywordScore = matchCount * SCORE_WEIGHTS.TYPE_KEYWORD;
      if (keywordScore > bestKeywordScore) {
        bestKeywordScore = keywordScore;
        bestKeywordType = type;
      }
    }

    // Cap keyword contribution at 0.6
    const cappedKeywordScore = Math.min(bestKeywordScore, 0.6);
    confidence += cappedKeywordScore;
    detectedType = bestKeywordType;

    if (bestKeywordType) {
      provider = 'Calendar';
    }
  }

  // ── Step 3: Check generic travel keywords ──
  const hasGenericMatch = GENERIC_TRAVEL_KEYWORDS.some((keyword) =>
    combined.includes(keyword)
  );

  if (hasGenericMatch) {
    confidence += SCORE_WEIGHTS.GENERIC_KEYWORD;
    signals.push('Contains travel-related keywords');
  }

  // ── Step 4: Location bonus ──
  if (event.location && event.location.trim().length > 0) {
    confidence += SCORE_WEIGHTS.HAS_LOCATION;
    signals.push('Has location');
  }

  // ── Step 5: Multi-day bonus ──
  const startMs = new Date(event.startDate).getTime();
  const endMs = new Date(event.endDate).getTime();
  const daysDiff = (endMs - startMs) / (1000 * 60 * 60 * 24);

  if (event.endDate !== event.startDate && daysDiff >= 1) {
    confidence += SCORE_WEIGHTS.MULTI_DAY;
    signals.push('Multi-day event');
  }

  // ── Step 6: Cap confidence ──
  confidence = Math.min(confidence, 1.0);

  // ── Step 7: Threshold check ──
  if (confidence < CONFIDENCE.REVIEW || !detectedType) {
    return null;
  }

  return {
    event,
    confidence,
    bookingType: detectedType,
    provider,
    signals,
  };
}

// ──────────────────────────────────────────────
// Batch classifier with auto-import / review split
// ──────────────────────────────────────────────

export function classifyEvents(events: CalendarEvent[]): {
  autoImport: ClassifiedEvent[];
  review: ClassifiedEvent[];
} {
  const autoImport: ClassifiedEvent[] = [];
  const review: ClassifiedEvent[] = [];

  for (const event of events) {
    const result = classifyEvent(event);
    if (!result) continue;

    if (result.confidence >= CONFIDENCE.AUTO_IMPORT) {
      autoImport.push(result);
    } else {
      review.push(result);
    }
  }

  // Sort both arrays by confidence descending
  autoImport.sort((a, b) => b.confidence - a.confidence);
  review.sort((a, b) => b.confidence - a.confidence);

  return { autoImport, review };
}

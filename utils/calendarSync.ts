import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { BookingType } from '@/constants/bookings';
import { classifyEvents, type CalendarEvent, type ClassifiedEvent } from './calendarClassifier';
import { toLocalISODateString } from './calendarDates';
import { findMatchingTrip, type MatchableTrip } from './tripMatcher';

export interface SyncResult {
  imported: number;
  forReview: ClassifiedEvent[];
  skipped: number;
  error?: string;
}

/** Shape of the booking document created for an auto-imported event. */
export interface CalendarBookingDraft {
  type: BookingType;
  source: 'calendar';
  provider: string;
  status: 'upcoming';
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  calendarEventId: string;
  calendarSource: 'apple' | 'google';
}

/**
 * Requests calendar permission from the user.
 * Returns true if the permission was granted.
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Checks whether calendar permission has already been granted.
 * Returns true if the permission is currently granted.
 */
export async function hasCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Fetches calendar events from the device.
 * Retrieves events from 30 days ago to 12 months ahead across all calendars.
 * Maps raw calendar events to the CalendarEvent type.
 */
async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Skip subscription/holiday calendars — they contain public holidays, not bookings
  const filteredCalendars = calendars.filter((cal) => {
    const name = (cal.title || '').toLowerCase();
    const sourceName = ((cal.source as Record<string, unknown>)?.name as string || '').toLowerCase();
    // expo-calendar's CalendarType values are lowercase ('subscribed') —
    // the previous uppercase comparison never matched, so subscription
    // calendars slipped through the filter.
    const calType = String(cal.type ?? '').toLowerCase();
    const sourceType = String(
      ((cal.source as Record<string, unknown>)?.type as string) ?? '',
    ).toLowerCase();
    const isHolidayCalendar =
      name.includes('holiday') ||
      name.includes('holidays') ||
      sourceName.includes('holiday') ||
      sourceName.includes('holidays') ||
      calType === Calendar.CalendarType.SUBSCRIBED ||
      sourceType === Calendar.CalendarType.SUBSCRIBED;
    return !isHolidayCalendar;
  });

  const calendarIds = filteredCalendars.map((cal) => cal.id);

  if (calendarIds.length === 0) {
    return [];
  }

  const now = new Date();

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);

  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 12);

  const rawEvents = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

  return rawEvents.map((event) => ({
    id: event.id,
    title: event.title || '',
    notes: event.notes || undefined,
    location: event.location || undefined,
    // LOCAL date parts — converting via toISOString() shifted every event
    // east of Greenwich (e.g. a 1AM IST flight) back one calendar day.
    startDate: toLocalISODateString(event.startDate),
    endDate: toLocalISODateString(event.endDate),
    organizer: event.organizerEmail || undefined,
    allDay: event.allDay ?? false,
  }));
}

/**
 * Runs the full calendar sync workflow:
 * 1. Fetches events from device calendars
 * 2. Deduplicates against already-imported events
 * 3. Classifies events using the classifier
 * 4. Auto-imports high-confidence events via createBookingFn
 * 5. Attempts trip matching and linking for imported events
 * 6. Returns remaining events for user review
 *
 * @param existingCalendarEventIds - Set of calendar event IDs already imported
 * @param createBookingFn - Function to create a new booking from classified event data
 * @param linkBookingFn - Function to link a booking to a trip
 * @param trips - Array of trips to match against
 */
export async function runCalendarSync<TId extends string = string>(
  existingCalendarEventIds: Set<string>,
  createBookingFn: (booking: CalendarBookingDraft) => Promise<string>,
  linkBookingFn: (bookingId: string, tripId: TId) => Promise<unknown>,
  trips: MatchableTrip<TId>[]
): Promise<SyncResult> {
  try {
    // Fetch all calendar events
    const events = await fetchCalendarEvents();

    // Deduplicate: filter out events already imported
    const newEvents = events.filter((event) => !existingCalendarEventIds.has(event.id));
    const skipped = events.length - newEvents.length;

    if (newEvents.length === 0) {
      return { imported: 0, forReview: [], skipped };
    }

    // Classify the new events
    const { autoImport, review } = classifyEvents(newEvents);

    let imported = 0;
    const calendarSource = Platform.OS === 'ios' ? 'apple' : 'google';

    // Auto-import high confidence events
    for (const classified of autoImport) {
      const { event, bookingType, provider: providerName } = classified;

      const bookingId = await createBookingFn({
        type: bookingType,
        source: 'calendar',
        provider: providerName,
        status: 'upcoming',
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate !== event.startDate ? event.endDate : undefined,
        location: event.location || undefined,
        calendarEventId: event.id,
        calendarSource,
      });

      // Try trip matching (countryCode undefined for calendar events, match on dates)
      if (trips.length > 0) {
        const match = findMatchingTrip(
          undefined,
          event.startDate,
          event.endDate,
          trips
        );

        if (match && match.confidence === 'high') {
          try {
            await linkBookingFn(bookingId, match.tripId);
          } catch {
            // Linking failure is non-fatal
          }
        }
      }

      imported++;
    }

    return { imported, forReview: review, skipped };
  } catch (error: unknown) {
    return {
      imported: 0,
      forReview: [],
      skipped: 0,
      error: error instanceof Error ? error.message : 'Calendar sync failed',
    };
  }
}

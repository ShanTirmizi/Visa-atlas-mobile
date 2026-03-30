import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { classifyEvents, type CalendarEvent, type ClassifiedEvent } from './calendarClassifier';
import { findMatchingTrip } from './tripMatcher';

export interface SyncResult {
  imported: number;
  forReview: ClassifiedEvent[];
  skipped: number;
  error?: string;
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
  const calendarIds = calendars.map((cal) => cal.id);

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
    startDate: toISODateString(event.startDate),
    endDate: toISODateString(event.endDate),
    organizer: (event as any).organizerEmail || undefined,
  }));
}

/**
 * Converts a date string or Date to an ISO date string (YYYY-MM-DD).
 */
function toISODateString(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
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
export async function runCalendarSync(
  existingCalendarEventIds: Set<string>,
  createBookingFn: (booking: Record<string, any>) => Promise<any>,
  linkBookingFn: (bookingId: string, tripId: string) => Promise<any>,
  trips: any[]
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
    const classified = classifyEvents(newEvents);

    const forReview: ClassifiedEvent[] = [];
    let imported = 0;

    const calendarSource = Platform.OS === 'ios' ? 'apple' : 'google';

    for (const classifiedEvent of classified) {
      if (classifiedEvent.confidence === 'high') {
        // Auto-import high confidence events
        const bookingData: Record<string, any> = {
          type: classifiedEvent.type,
          source: 'calendar',
          provider: classifiedEvent.provider,
          status: 'upcoming',
          title: classifiedEvent.event.title,
          startDate: classifiedEvent.event.startDate,
          calendarEventId: classifiedEvent.event.id,
          calendarSource,
        };

        if (classifiedEvent.event.endDate !== classifiedEvent.event.startDate) {
          bookingData.endDate = classifiedEvent.event.endDate;
        }

        if (classifiedEvent.event.location) {
          bookingData.location = classifiedEvent.event.location;
        }

        const booking = await createBookingFn(bookingData);

        // Try trip matching (countryCode undefined for calendar events, match on dates)
        const match = findMatchingTrip(
          undefined,
          classifiedEvent.event.startDate,
          classifiedEvent.event.endDate,
          trips
        );

        if (match && match.confidence === 'high' && booking?._id) {
          try {
            await linkBookingFn(booking._id, match.tripId);
          } catch {
            // Linking failure is non-fatal; the booking was still created
          }
        }

        imported++;
      } else {
        // Events that aren't high confidence go to review
        forReview.push(classifiedEvent);
      }
    }

    return { imported, forReview, skipped };
  } catch (error: any) {
    return {
      imported: 0,
      forReview: [],
      skipped: 0,
      error: error?.message || 'Calendar sync failed',
    };
  }
}

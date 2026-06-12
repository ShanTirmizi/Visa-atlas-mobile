// Pure date helpers for calendar import — no expo/react-native imports so
// the logic jest project can test them directly.

import { toLocalYMD } from './localDate';

/**
 * Converts a calendar event date (string or Date) to a YYYY-MM-DD string
 * using LOCAL date parts.
 *
 * Why local, not UTC: expo-calendar hands back instants anchored to the
 * device's timezone. `toISOString()` re-expresses that instant in UTC, so a
 * 1AM flight in IST (UTC+5:30) becomes the *previous* calendar day, and an
 * all-day event created east of Greenwich shifts back a day. Apple Calendar
 * and Google Calendar both render an event on the day it occurs in the
 * event's own timezone — for device-sourced events that's the local clock,
 * so local date parts are the faithful conversion.
 *
 * Formatting delegates to utils/localDate.ts (the app-wide local-YMD
 * helper); this wrapper just absorbs expo-calendar's string | Date union.
 */
export function toLocalISODateString(date: string | Date): string {
  return toLocalYMD(typeof date === 'string' ? new Date(date) : date);
}

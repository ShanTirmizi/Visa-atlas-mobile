/**
 * Feature flags for staged rollout.
 *
 * Features set to `false` are hidden from the UI and their iOS permission
 * strings are suppressed in app.json (via the expo-image-picker / expo-calendar
 * plugin config) so the v1 App Store build requests no camera/photos/calendar
 * permissions. To re-enable a feature later: flip its flag to `true` AND remove
 * the matching `*Permission: false` entries from the plugin config in app.json
 * so the usage-description strings are emitted again.
 */
export const FEATURES = {
  /** Booking-confirmation scan via camera + photo library (expo-image-picker). */
  bookingScan: false,
  /** Calendar import / sync (expo-calendar). */
  calendarSync: false,
  /** Gmail account linking + inbox scanning for bookings. */
  gmailSync: false,
} as const;

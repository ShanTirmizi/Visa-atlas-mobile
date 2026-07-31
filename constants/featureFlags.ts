/**
 * BUILD-TIME feature flags for staged rollout.
 *
 * These are compile-time constants because each one is tied to an iOS
 * permission string: features set to `false` are hidden from the UI and their
 * usage descriptions are suppressed in app.json (via the expo-image-picker /
 * expo-calendar plugin config), so the App Store build requests no
 * camera/photos/calendar permissions. A remote flag can't undo that — the
 * binary either declares the permission or it doesn't. To re-enable one:
 * flip its flag to `true` AND remove the matching `*Permission: false`
 * entries from the plugin config in app.json so the usage-description
 * strings are emitted again.
 *
 * For features with no permission tie-in, prefer a REMOTE flag (below) so it
 * can be switched from the backend without shipping a build.
 */
export const FEATURES = {
  /** Booking-confirmation scan via camera + photo library (expo-image-picker). */
  bookingScan: false,
  /** Calendar import / sync (expo-calendar). */
  calendarSync: false,
  /** Gmail account linking + inbox scanning for bookings. */
  gmailSync: false,
} as const;

/**
 * REMOTE feature flags — the local fallback values.
 *
 * The live values come from Convex (`featureFlags:getFlags`, backed by the
 * `featureFlags` table) and are consumed through `useFeatureFlag` in
 * contexts/feature-flags-context.tsx, which re-renders the moment a value is
 * toggled in the dashboard. These defaults apply only before the first
 * response arrives on a device that has never resolved the flag: signed out,
 * offline cold start, or query in flight.
 *
 * Keep this record in sync with FLAG_DEFAULTS in convex/featureFlags.ts —
 * same keys, same default values.
 */
export const REMOTE_FLAG_DEFAULTS = {
  /** "Plan my day" — day-trip planner entry card, routes, and generator. */
  dayTrips: false,
} as const;

export type RemoteFlagKey = keyof typeof REMOTE_FLAG_DEFAULTS;

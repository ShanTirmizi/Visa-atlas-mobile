// Trip-ready notification registration.
//
// IMPORTANT: every expo-notifications touchpoint is lazily required and
// fully guarded. Dev clients built before the module was added (and any
// environment where native notifications are unavailable, e.g. some
// simulators) must no-op gracefully instead of crashing at import time.
import Constants from 'expo-constants';

type SetPushToken = (args: { token: string }) => Promise<unknown>;

let registrationAttempted = false;

/**
 * Contextual registration — called fire-and-forget when the user generates
 * a trip (the moment a notification has obvious value, per Apple's
 * permission-prompt guidance). Asks permission if undetermined, fetches the
 * Expo push token, and stores it on the user's profile via the supplied
 * mutation. Safe to call repeatedly; only the first call per session does
 * the work.
 */
export async function registerForTripNotifications(
  setPushToken: SetPushToken,
): Promise<void> {
  if (registrationAttempted) return;
  registrationAttempted = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Notifications: any;
  try {
    // Lazy require — throws on binaries without the native module.
    Notifications = require('expo-notifications');
  } catch {
    return;
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Constants as any).easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (token) {
      await setPushToken({ token });
    }
  } catch {
    // Simulators can't mint APNs tokens; uninstalled-module edge cases land
    // here too. Notifications are an enhancement — never surface an error.
  }
}

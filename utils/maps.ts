import { Linking, Platform } from 'react-native';

/** Builds the best-available native maps URL for the platform.
 *  - iOS:     `maps://?q=...`        — Apple Maps (system default).
 *  - Android: `geo:0,0?q=...`        — whichever maps app the user has set
 *                                      as default (typically Google Maps).
 *  Returns null if no useful query parts. */
export function buildMapsSearchUrl(parts: {
  name?: string;
  location?: string;
  countryCode?: string;
}): string | null {
  const tokens = [parts.name, parts.location, parts.countryCode]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const query = encodeURIComponent(tokens.join(' '));
  if (Platform.OS === 'ios') return `maps://?q=${query}`;
  return `geo:0,0?q=${query}`;
}

/** Opens the native maps app for the given parts. Falls back to the
 *  Google Maps web URL if the native scheme can't be opened (e.g. the
 *  user has no maps app installed). */
export async function openInMaps(parts: {
  name?: string;
  location?: string;
  countryCode?: string;
}): Promise<void> {
  const native = buildMapsSearchUrl(parts);
  if (!native) return;
  try {
    const supported = await Linking.canOpenURL(native);
    if (supported) {
      await Linking.openURL(native);
      return;
    }
  } catch {
    // fall through to web fallback
  }
  const tokens = [parts.name, parts.location, parts.countryCode]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const query = encodeURIComponent(tokens.join(' '));
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
}

/** Builds a tel: URI from a phone string. Strips spaces and dashes; keeps `+`. */
export function buildTelUrl(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

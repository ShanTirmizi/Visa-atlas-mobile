/** Builds a Google Maps search URL. Returns null if no useful query parts. */
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
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Builds a tel: URI from a phone string. Strips spaces and dashes; keeps `+`. */
export function buildTelUrl(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

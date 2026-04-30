export interface StaticTripFacts {
  currency: string;
  language: string;
  timezone: string;
  iataCode: string;
  region: string;
  /** 1 = budget, 5 = ultra-luxury */
  costLevel: number;
  /** From JFK, rough average. Used by the planner to estimate flight hours. */
  flightHoursFromUS: number;
}

/**
 * Static lookup of facts that don't change per-user-trip.
 *
 * Why local lookup, not LLM: these are factual mappings (ISO → currency, etc.).
 * Putting them through an LLM costs tokens and adds latency for no quality
 * benefit. Updated annually from the REST Countries API + IATA primary-airport
 * lookup.
 */
export const STATIC_TRIP_FACTS: Record<string, StaticTripFacts> = {
  // ── Asia-Pacific ───────────────────────────────────────────────
  JP: { currency: 'JPY (¥)',  language: 'Japanese',     timezone: 'JST (UTC+9)',   iataCode: 'NRT', region: 'East Asia',     costLevel: 4, flightHoursFromUS: 14 },
  KR: { currency: 'KRW (₩)',  language: 'Korean',       timezone: 'KST (UTC+9)',   iataCode: 'ICN', region: 'East Asia',     costLevel: 3, flightHoursFromUS: 14 },
  CN: { currency: 'CNY (¥)',  language: 'Mandarin',     timezone: 'CST (UTC+8)',   iataCode: 'PEK', region: 'East Asia',     costLevel: 2, flightHoursFromUS: 14 },
  TW: { currency: 'TWD (NT$)',language: 'Mandarin',     timezone: 'CST (UTC+8)',   iataCode: 'TPE', region: 'East Asia',     costLevel: 3, flightHoursFromUS: 16 },
  TH: { currency: 'THB (฿)',  language: 'Thai',         timezone: 'ICT (UTC+7)',   iataCode: 'BKK', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 17 },
  VN: { currency: 'VND (₫)',  language: 'Vietnamese',   timezone: 'ICT (UTC+7)',   iataCode: 'SGN', region: 'Southeast Asia',costLevel: 1, flightHoursFromUS: 19 },
  ID: { currency: 'IDR (Rp)', language: 'Indonesian',   timezone: 'WIB (UTC+7)',   iataCode: 'CGK', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 20 },
  SG: { currency: 'SGD (S$)', language: 'English',      timezone: 'SGT (UTC+8)',   iataCode: 'SIN', region: 'Southeast Asia',costLevel: 4, flightHoursFromUS: 18 },
  MY: { currency: 'MYR (RM)', language: 'Malay',        timezone: 'MYT (UTC+8)',   iataCode: 'KUL', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 18 },
  PH: { currency: 'PHP (₱)',  language: 'Filipino',     timezone: 'PHT (UTC+8)',   iataCode: 'MNL', region: 'Southeast Asia',costLevel: 2, flightHoursFromUS: 16 },
  IN: { currency: 'INR (₹)',  language: 'Hindi',        timezone: 'IST (UTC+5:30)',iataCode: 'DEL', region: 'South Asia',    costLevel: 1, flightHoursFromUS: 14 },
  AU: { currency: 'AUD (A$)', language: 'English',      timezone: 'AEDT (UTC+11)', iataCode: 'SYD', region: 'Oceania',       costLevel: 4, flightHoursFromUS: 22 },
  NZ: { currency: 'NZD (NZ$)',language: 'English',      timezone: 'NZDT (UTC+13)', iataCode: 'AKL', region: 'Oceania',       costLevel: 4, flightHoursFromUS: 18 },

  // ── Europe ─────────────────────────────────────────────────────
  GB: { currency: 'GBP (£)',  language: 'English',      timezone: 'GMT (UTC+0)',   iataCode: 'LHR', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 7 },
  FR: { currency: 'EUR (€)',  language: 'French',       timezone: 'CET (UTC+1)',   iataCode: 'CDG', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  DE: { currency: 'EUR (€)',  language: 'German',       timezone: 'CET (UTC+1)',   iataCode: 'FRA', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  IT: { currency: 'EUR (€)',  language: 'Italian',      timezone: 'CET (UTC+1)',   iataCode: 'FCO', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 9 },
  ES: { currency: 'EUR (€)',  language: 'Spanish',      timezone: 'CET (UTC+1)',   iataCode: 'MAD', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  PT: { currency: 'EUR (€)',  language: 'Portuguese',   timezone: 'WET (UTC+0)',   iataCode: 'LIS', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 8 },
  NL: { currency: 'EUR (€)',  language: 'Dutch',        timezone: 'CET (UTC+1)',   iataCode: 'AMS', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  BE: { currency: 'EUR (€)',  language: 'Dutch/French', timezone: 'CET (UTC+1)',   iataCode: 'BRU', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 8 },
  CH: { currency: 'CHF',      language: 'German/French',timezone: 'CET (UTC+1)',   iataCode: 'ZRH', region: 'Western Europe',costLevel: 5, flightHoursFromUS: 9 },
  AT: { currency: 'EUR (€)',  language: 'German',       timezone: 'CET (UTC+1)',   iataCode: 'VIE', region: 'Western Europe',costLevel: 3, flightHoursFromUS: 9 },
  IE: { currency: 'EUR (€)',  language: 'English',      timezone: 'GMT (UTC+0)',   iataCode: 'DUB', region: 'Western Europe',costLevel: 4, flightHoursFromUS: 7 },
  GR: { currency: 'EUR (€)',  language: 'Greek',        timezone: 'EET (UTC+2)',   iataCode: 'ATH', region: 'Southern Europe',costLevel: 3, flightHoursFromUS: 11 },
  HR: { currency: 'EUR (€)',  language: 'Croatian',     timezone: 'CET (UTC+1)',   iataCode: 'ZAG', region: 'Southern Europe',costLevel: 3, flightHoursFromUS: 10 },
  CZ: { currency: 'CZK (Kč)', language: 'Czech',        timezone: 'CET (UTC+1)',   iataCode: 'PRG', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  PL: { currency: 'PLN (zł)', language: 'Polish',       timezone: 'CET (UTC+1)',   iataCode: 'WAW', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  HU: { currency: 'HUF (Ft)', language: 'Hungarian',    timezone: 'CET (UTC+1)',   iataCode: 'BUD', region: 'Central Europe',costLevel: 2, flightHoursFromUS: 9 },
  SE: { currency: 'SEK (kr)', language: 'Swedish',      timezone: 'CET (UTC+1)',   iataCode: 'ARN', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 9 },
  NO: { currency: 'NOK (kr)', language: 'Norwegian',    timezone: 'CET (UTC+1)',   iataCode: 'OSL', region: 'Northern Europe',costLevel: 5, flightHoursFromUS: 8 },
  DK: { currency: 'DKK (kr)', language: 'Danish',       timezone: 'CET (UTC+1)',   iataCode: 'CPH', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 8 },
  FI: { currency: 'EUR (€)',  language: 'Finnish',      timezone: 'EET (UTC+2)',   iataCode: 'HEL', region: 'Northern Europe',costLevel: 4, flightHoursFromUS: 9 },
  IS: { currency: 'ISK (kr)', language: 'Icelandic',    timezone: 'GMT (UTC+0)',   iataCode: 'KEF', region: 'Northern Europe',costLevel: 5, flightHoursFromUS: 6 },

  // ── Americas ───────────────────────────────────────────────────
  US: { currency: 'USD ($)',  language: 'English',      timezone: 'ET (UTC-5)',    iataCode: 'JFK', region: 'North America', costLevel: 4, flightHoursFromUS: 0 },
  CA: { currency: 'CAD (C$)', language: 'English/French',timezone: 'ET (UTC-5)',   iataCode: 'YYZ', region: 'North America', costLevel: 3, flightHoursFromUS: 2 },
  MX: { currency: 'MXN ($)',  language: 'Spanish',      timezone: 'CST (UTC-6)',   iataCode: 'MEX', region: 'North America', costLevel: 2, flightHoursFromUS: 5 },
  BR: { currency: 'BRL (R$)', language: 'Portuguese',   timezone: 'BRT (UTC-3)',   iataCode: 'GRU', region: 'South America', costLevel: 2, flightHoursFromUS: 10 },
  AR: { currency: 'ARS ($)',  language: 'Spanish',      timezone: 'ART (UTC-3)',   iataCode: 'EZE', region: 'South America', costLevel: 2, flightHoursFromUS: 11 },
  CL: { currency: 'CLP ($)',  language: 'Spanish',      timezone: 'CLT (UTC-4)',   iataCode: 'SCL', region: 'South America', costLevel: 3, flightHoursFromUS: 11 },
  PE: { currency: 'PEN (S/)', language: 'Spanish',      timezone: 'PET (UTC-5)',   iataCode: 'LIM', region: 'South America', costLevel: 2, flightHoursFromUS: 8 },
  CO: { currency: 'COP ($)',  language: 'Spanish',      timezone: 'COT (UTC-5)',   iataCode: 'BOG', region: 'South America', costLevel: 2, flightHoursFromUS: 6 },
  CR: { currency: 'CRC (₡)',  language: 'Spanish',      timezone: 'CST (UTC-6)',   iataCode: 'SJO', region: 'Central America',costLevel: 2,flightHoursFromUS: 6 },

  // ── Middle East / Africa ───────────────────────────────────────
  AE: { currency: 'AED (د.إ)',language: 'Arabic',       timezone: 'GST (UTC+4)',   iataCode: 'DXB', region: 'Middle East',   costLevel: 4, flightHoursFromUS: 13 },
  TR: { currency: 'TRY (₺)',  language: 'Turkish',      timezone: 'TRT (UTC+3)',   iataCode: 'IST', region: 'Middle East',   costLevel: 2, flightHoursFromUS: 11 },
  IL: { currency: 'ILS (₪)',  language: 'Hebrew',       timezone: 'IST (UTC+2)',   iataCode: 'TLV', region: 'Middle East',   costLevel: 4, flightHoursFromUS: 11 },
  EG: { currency: 'EGP (£)',  language: 'Arabic',       timezone: 'EET (UTC+2)',   iataCode: 'CAI', region: 'North Africa',  costLevel: 2, flightHoursFromUS: 12 },
  MA: { currency: 'MAD (د.م.)',language: 'Arabic',      timezone: 'WET (UTC+0)',   iataCode: 'CMN', region: 'North Africa',  costLevel: 2, flightHoursFromUS: 8 },
  ZA: { currency: 'ZAR (R)',  language: 'English',      timezone: 'SAST (UTC+2)',  iataCode: 'JNB', region: 'Southern Africa',costLevel: 2,flightHoursFromUS: 16 },
  KE: { currency: 'KES (KSh)',language: 'English',      timezone: 'EAT (UTC+3)',   iataCode: 'NBO', region: 'East Africa',   costLevel: 2, flightHoursFromUS: 15 },
  TZ: { currency: 'TZS (TSh)',language: 'Swahili',      timezone: 'EAT (UTC+3)',   iataCode: 'DAR', region: 'East Africa',   costLevel: 2, flightHoursFromUS: 16 },
};

export function lookupStaticFacts(code: string): StaticTripFacts | null {
  const upper = code.toUpperCase();
  return STATIC_TRIP_FACTS[upper] ?? null;
}

export function hasStaticFacts(code: string): boolean {
  return code.toUpperCase() in STATIC_TRIP_FACTS;
}

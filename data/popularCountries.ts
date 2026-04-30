// Curated list of the most-planned trip destinations, surfaced first in
// the planner's country picker (when no search query is active). Order
// reflects a blend of UNWTO international-arrivals data and what an
// English-speaking traveler is most likely to plan a holiday around —
// Mediterranean Europe, popular Asia, Latin America headliners, the
// big-three "wishlist" destinations (Iceland, NZ, etc.).
//
// Codes are ISO 3166-1 alpha-3 to match the `code` field on visaData.
// India (IND) is intentionally excluded — it's the home country in
// this app's data, never a destination.
export const POPULAR_COUNTRY_CODES: readonly string[] = [
  'ITA', // Italy
  'ESP', // Spain
  'FRA', // France
  'JPN', // Japan
  'THA', // Thailand
  'GRC', // Greece
  'PRT', // Portugal
  'USA', // United States
  'GBR', // United Kingdom
  'MEX', // Mexico
  'IDN', // Indonesia
  'VNM', // Vietnam
  'TUR', // Turkey
  'HRV', // Croatia
  'MAR', // Morocco
  'ISL', // Iceland
  'AUS', // Australia
  'NZL', // New Zealand
  'CHE', // Switzerland
  'CRI', // Costa Rica
  'ZAF', // South Africa
  'ARE', // United Arab Emirates
  'LKA', // Sri Lanka
  'PER', // Peru
  'EGY', // Egypt
  'ARG', // Argentina
  'DEU', // Germany
  'NLD', // Netherlands
  'SGP', // Singapore
  'PHL', // Philippines
  'MDV', // Maldives
  'IRL', // Ireland
] as const;

export const POPULAR_COUNTRY_CODE_SET = new Set<string>(POPULAR_COUNTRY_CODES);
export const POPULAR_COUNTRY_RANK: ReadonlyMap<string, number> = new Map(
  POPULAR_COUNTRY_CODES.map((code, index) => [code, index]),
);

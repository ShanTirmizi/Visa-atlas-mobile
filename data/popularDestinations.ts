// Top tourism destinations by international arrivals (UNWTO + curated).
// ISO-3 codes ordered by approximate global popularity — used to power the
// Atlas "Where to next?" carousel so users see Bali / Tokyo / Paris up
// front instead of Afghanistan / Albania / Algeria.
//
// Order is intentional — first ~30 covers ~80% of where people actually
// travel. Anything not in this list falls back to the alphabetical list
// in the "More destinations" section below.

export const POPULAR_DESTINATIONS_ISO3: string[] = [
  'FRA', // France
  'ESP', // Spain
  'USA', // United States
  'ITA', // Italy
  'TUR', // Turkey
  'MEX', // Mexico
  'DEU', // Germany
  'GBR', // United Kingdom
  'GRC', // Greece
  'AUT', // Austria
  'PRT', // Portugal
  'JPN', // Japan
  'THA', // Thailand
  'IDN', // Indonesia (Bali)
  'NLD', // Netherlands
  'CAN', // Canada
  'AUS', // Australia
  'KOR', // South Korea
  'CHE', // Switzerland
  'CZE', // Czech Republic
  'IRL', // Ireland
  'HRV', // Croatia
  'ARE', // United Arab Emirates
  'SGP', // Singapore
  'VNM', // Vietnam
  'MAR', // Morocco
  'EGY', // Egypt
  'ZAF', // South Africa
  'BRA', // Brazil
  'ARG', // Argentina
  'NZL', // New Zealand
  'ISL', // Iceland
  'NOR', // Norway
  'SWE', // Sweden
  'DNK', // Denmark
  'POL', // Poland
  'HUN', // Hungary
  'BEL', // Belgium
  'IND', // India
  'MYS', // Malaysia
  'PHL', // Philippines
  'LKA', // Sri Lanka
  'NPL', // Nepal
  'PER', // Peru
  'CRI', // Costa Rica
];

const RANK = new Map(POPULAR_DESTINATIONS_ISO3.map((code, i) => [code, i]));

/** Sort comparator: popular destinations first (in popularity order),
 *  everything else falls through unsorted. */
export function popularityRank(code: string): number {
  return RANK.get(code) ?? Number.POSITIVE_INFINITY;
}

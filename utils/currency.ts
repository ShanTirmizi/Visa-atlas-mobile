/**
 * Currency helpers.
 *
 * All budget strings in `data/travelData.ts` are stored in GBP (e.g. "£35-60/day").
 * This module converts that display to the user's home currency based on their
 * residence country, using a static rates table.
 *
 * The rates are intentionally rough — precision isn't important for a "this is
 * what it'll cost roughly" budget label. Live exchange rates via a cron job are
 * a future enhancement.
 */

// GBP → X exchange rates (1 GBP = N local currency units).
// Rounded to a sensible number of sig figs. Update periodically.
// Last reviewed: April 2026.
const GBP_TO: Record<string, number> = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.17,
  CAD: 1.73,
  AUD: 1.94,
  NZD: 2.12,
  JPY: 192,
  CNY: 9.2,
  INR: 106,
  PKR: 352,
  BDT: 138,
  LKR: 380,
  NPR: 168,
  SGD: 1.71,
  MYR: 5.9,
  THB: 45,
  VND: 31000,
  IDR: 20000,
  PHP: 72,
  HKD: 9.9,
  KRW: 1720,
  TWD: 40,
  MXN: 22,
  BRL: 6.3,
  ARS: 1100,
  CLP: 1230,
  COP: 5050,
  PEN: 4.8,
  ZAR: 24,
  EGP: 62,
  KES: 166,
  NGN: 2000,
  MAD: 12.5,
  TRY: 44,
  ILS: 4.7,
  AED: 4.66,
  SAR: 4.77,
  QAR: 4.62,
  KWD: 0.39,
  OMR: 0.49,
  RUB: 116,
  UAH: 52,
  PLN: 5.1,
  CZK: 29,
  HUF: 460,
  RON: 5.8,
  BGN: 2.3,
  HRK: 8.8,
  ISK: 175,
  NOK: 13.5,
  SEK: 13.4,
  DKK: 8.7,
  CHF: 1.12,
};

// Display symbol for a currency. Falls back to the ISO code.
const SYMBOL: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'A$',
  NZD: 'NZ$',
  HKD: 'HK$',
  SGD: 'S$',
  KRW: '₩',
  ILS: '₪',
  THB: '฿',
  VND: '₫',
  TRY: '₺',
  CHF: 'CHF ',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  RUB: '₽',
  BRL: 'R$',
  MXN: 'MX$',
  ZAR: 'R',
  EGP: 'E£',
  AED: 'د.إ ',
  SAR: 'ر.س ',
};

export function currencySymbol(code: string): string {
  return SYMBOL[code] ?? `${code} `;
}

/**
 * Round to a "nice" step based on magnitude:
 *  - under 100 → nearest 5
 *  - 100-999 → nearest 10
 *  - 1000-9999 → nearest 50
 *  - 10000+ → nearest 100
 */
function roundNice(n: number): number {
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
}

/**
 * Format a GBP range (e.g. "£35-60/day", "£120/day") into the target currency.
 * Returns the original string if the input can't be parsed or the target
 * currency doesn't have a conversion rate (we error on the side of showing
 * *something* rather than nothing).
 */
export function convertBudget(
  gbpDisplay: string,
  targetCurrency: string | undefined,
): string {
  if (!targetCurrency || targetCurrency === 'GBP') return gbpDisplay;
  const rate = GBP_TO[targetCurrency];
  if (!rate) return gbpDisplay;

  // Extract the numeric part — handles "£35-60/day", "£120/day", "£5-10/day".
  const match = gbpDisplay.match(/([0-9]+)(?:[-–]([0-9]+))?/);
  if (!match) return gbpDisplay;

  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : undefined;

  const sym = currencySymbol(targetCurrency);
  const convertedMin = roundNice(min * rate);

  // Suffix — "/day" if present in original.
  const suffix = /\/day/.test(gbpDisplay) ? '/day' : '';

  if (max === undefined) {
    return `${sym}${convertedMin.toLocaleString()}${suffix}`;
  }
  const convertedMax = roundNice(max * rate);
  return `${sym}${convertedMin.toLocaleString()}–${convertedMax.toLocaleString()}${suffix}`;
}

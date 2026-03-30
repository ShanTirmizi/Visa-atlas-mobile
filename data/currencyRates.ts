// Approximate GBP to local currency rates (as of March 2026)
// These are ballpark figures for travel budgeting, not forex trading
// Source currency: GBP (British Pound Sterling)
// Rate meaning: 1 GBP = X local currency

export const gbpRates: Record<string, number> = {
  // ─── South Asia ───────────────────────────────────────────────────────
  INR: 106.5,   // Indian Rupee
  PKR: 354,     // Pakistani Rupee
  BDT: 149,     // Bangladeshi Taka
  LKR: 380,     // Sri Lankan Rupee
  NPR: 170,     // Nepalese Rupee
  BTN: 106.5,   // Bhutanese Ngultrum (pegged to INR)
  MVR: 19.5,    // Maldivian Rufiyaa

  // ─── Africa (Island & East) ───────────────────────────────────────────
  SCR: 17.2,    // Seychellois Rupee
  MGA: 5800,    // Malagasy Ariary
  MUR: 58,      // Mauritian Rupee
  KES: 164,     // Kenyan Shilling
  TZS: 3350,    // Tanzanian Shilling
  UGX: 4750,    // Ugandan Shilling
  RWF: 1650,    // Rwandan Franc
  ETB: 73,      // Ethiopian Birr
  MZN: 81,      // Mozambican Metical
  SOS: 725,     // Somali Shilling
  DJF: 226,     // Djiboutian Franc
  ERN: 19.1,    // Eritrean Nakfa
  KMF: 575,     // Comorian Franc
  BIF: 3650,    // Burundian Franc
  SSP: 1180,    // South Sudanese Pound

  // ─── Africa (West) ────────────────────────────────────────────────────
  XOF: 767,     // West African CFA Franc
  XAF: 767,     // Central African CFA Franc
  NGN: 1980,    // Nigerian Naira
  GHS: 19.5,    // Ghanaian Cedi
  GMD: 87,      // Gambian Dalasi
  GNF: 10900,   // Guinean Franc
  SLE: 28.5,    // Sierra Leonean Leone
  LRD: 246,     // Liberian Dollar
  MRU: 50.5,    // Mauritanian Ouguiya

  // ─── Africa (Central & Southern) ──────────────────────────────────────
  CDF: 3600,    // Congolese Franc
  SDG: 760,     // Sudanese Pound
  AOA: 1150,    // Angolan Kwanza
  ZAR: 23.2,    // South African Rand
  NAD: 23.2,    // Namibian Dollar (pegged to ZAR)
  LSL: 23.2,    // Lesotho Loti (pegged to ZAR)
  BWP: 17.4,    // Botswana Pula
  SZL: 23.2,    // Swazi Lilangeni (pegged to ZAR)
  MWK: 2200,    // Malawian Kwacha
  ZMW: 34.5,    // Zambian Kwacha
  ZWL: 410,     // Zimbabwean Dollar

  // ─── Southeast Asia ───────────────────────────────────────────────────
  MYR: 5.65,    // Malaysian Ringgit
  SGD: 1.71,    // Singapore Dollar
  THB: 44.5,    // Thai Baht
  KHR: 5200,    // Cambodian Riel
  LAK: 28000,   // Lao Kip
  VND: 32000,   // Vietnamese Dong
  MMK: 2680,    // Myanmar Kyat
  PHP: 72.5,    // Philippine Peso
  IDR: 20200,   // Indonesian Rupiah

  // ─── East Asia ────────────────────────────────────────────────────────
  TWD: 41.2,    // New Taiwan Dollar
  KRW: 1740,    // South Korean Won
  HKD: 9.92,    // Hong Kong Dollar
  MOP: 10.2,    // Macanese Pataca
  JPY: 191,     // Japanese Yen
  CNY: 9.22,    // Chinese Yuan
  MNT: 4380,    // Mongolian Tugrik
  KPW: 1143,    // North Korean Won

  // ─── Central Asia ─────────────────────────────────────────────────────
  KZT: 640,     // Kazakhstani Tenge
  UZS: 16200,   // Uzbekistani Som
  KGS: 113,     // Kyrgyzstani Som
  TJS: 13.9,    // Tajikistani Somoni
  TMT: 4.45,    // Turkmenistani Manat

  // ─── Caucasus ─────────────────────────────────────────────────────────
  AZN: 2.16,    // Azerbaijani Manat
  AMD: 495,     // Armenian Dram
  GEL: 3.46,    // Georgian Lari

  // ─── Middle East ──────────────────────────────────────────────────────
  TRY: 46.5,    // Turkish Lira
  AED: 4.66,    // UAE Dirham
  QAR: 4.63,    // Qatari Riyal
  BHD: 0.478,   // Bahraini Dinar
  OMR: 0.489,   // Omani Rial
  SAR: 4.76,    // Saudi Riyal
  KWD: 0.391,   // Kuwaiti Dinar
  JOD: 0.9,     // Jordanian Dinar
  ILS: 4.68,    // Israeli New Shekel
  LBP: 113700,  // Lebanese Pound
  EGP: 63,      // Egyptian Pound
  IRR: 53500,   // Iranian Rial
  IQD: 1665,    // Iraqi Dinar
  SYP: 16500,   // Syrian Pound
  YER: 318,     // Yemeni Rial

  // ─── North Africa ─────────────────────────────────────────────────────
  MAD: 12.7,    // Moroccan Dirham
  TND: 3.97,    // Tunisian Dinar
  DZD: 171,     // Algerian Dinar
  LYD: 6.18,    // Libyan Dinar

  // ─── Europe ───────────────────────────────────────────────────────────
  EUR: 1.17,    // Euro
  GBP: 1,       // British Pound (base)
  CHF: 1.12,    // Swiss Franc
  SEK: 13.4,    // Swedish Krona
  NOK: 13.7,    // Norwegian Krone
  DKK: 8.72,    // Danish Krone
  ISK: 176,     // Icelandic Krona
  PLN: 5.08,    // Polish Zloty
  CZK: 29.8,    // Czech Koruna
  HUF: 476,     // Hungarian Forint
  HRK: 8.82,    // Croatian Kuna (now EUR, legacy)
  RON: 5.83,    // Romanian Leu
  BGN: 2.29,    // Bulgarian Lev
  RSD: 137,     // Serbian Dinar
  BAM: 2.29,    // Bosnia Mark
  MKD: 72.2,    // Macedonian Denar
  ALL: 118,     // Albanian Lek
  MDL: 22.6,    // Moldovan Leu
  UAH: 52.5,    // Ukrainian Hryvnia
  BYN: 4.16,    // Belarusian Ruble
  RUB: 117,     // Russian Ruble

  // ─── Americas ─────────────────────────────────────────────────────────
  USD: 1.27,    // US Dollar
  CAD: 1.74,    // Canadian Dollar
  BRL: 7.25,    // Brazilian Real
  ARS: 1350,    // Argentine Peso
  CLP: 1210,    // Chilean Peso
  COP: 5300,    // Colombian Peso
  PEN: 4.75,    // Peruvian Sol
  BOB: 8.78,    // Bolivian Boliviano
  PYG: 9550,    // Paraguayan Guarani
  UYU: 53.5,    // Uruguayan Peso
  VES: 46.8,    // Venezuelan Bolivar
  SRD: 45.2,    // Surinamese Dollar
  GYD: 266,     // Guyanese Dollar
  MXN: 21.8,    // Mexican Peso
  GTQ: 9.82,    // Guatemalan Quetzal
  HNL: 31.5,    // Honduran Lempira
  NIO: 46.7,    // Nicaraguan Cordoba
  CRC: 647,     // Costa Rican Colon
  PAB: 1.27,    // Panamanian Balboa (pegged to USD)
  BZD: 2.56,    // Belize Dollar
  DOP: 76.5,    // Dominican Peso
  CUP: 30.5,    // Cuban Peso
  JMD: 199,     // Jamaican Dollar
  TTD: 8.62,    // Trinidad and Tobago Dollar
  BBD: 2.54,    // Barbadian Dollar (pegged to USD)
  XCD: 3.43,    // East Caribbean Dollar
  HTG: 168,     // Haitian Gourde

  // ─── Oceania ──────────────────────────────────────────────────────────
  AUD: 1.97,    // Australian Dollar
  NZD: 2.15,    // New Zealand Dollar
  FJD: 2.87,    // Fijian Dollar
  PGK: 5.05,    // Papua New Guinean Kina
  VUV: 153,     // Vanuatu Vatu
  WST: 3.52,    // Samoan Tala
  TOP: 3.01,    // Tongan Pa'anga
};

// Currency symbols for display
const currencySymbols: Record<string, string> = {
  USD: "$", GBP: "\u00a3", EUR: "\u20ac", JPY: "\u00a5", CNY: "\u00a5",
  INR: "\u20b9", KRW: "\u20a9", THB: "\u0e3f", TRY: "\u20ba", PLN: "z\u0142",
  BRL: "R$", ZAR: "R", MYR: "RM", PHP: "\u20b1", IDR: "Rp",
  ILS: "\u20aa", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
  ISK: "kr", CZK: "K\u010d", HUF: "Ft", RON: "lei", BGN: "\u043b\u0432",
  RSD: "din", UAH: "\u20b4", RUB: "\u20bd", AED: "AED", SAR: "SAR",
  QAR: "QAR", KWD: "KD", BHD: "BD", OMR: "OMR", JOD: "JD",
  EGP: "E\u00a3", MAD: "MAD", AUD: "A$", NZD: "NZ$", CAD: "C$",
  SGD: "S$", HKD: "HK$", TWD: "NT$", MXN: "MX$", ARS: "AR$",
  CLP: "CL$", COP: "COL$", PEN: "S/.", VND: "\u20ab", MMK: "K",
  KHR: "\u17db", LAK: "\u20ad", MNT: "\u20ae", KZT: "\u20b8", GEL: "\u20be",
  PKR: "Rs", BDT: "\u09f3", LKR: "Rs", NPR: "Rs", NGN: "\u20a6",
  KES: "KSh", GHS: "GH\u20b5",
};

/**
 * Convert an amount in GBP to a target currency.
 * Returns 0 if the currency code is not found.
 */
export function convertGBP(amount: number, toCurrencyCode: string): number {
  const rate = gbpRates[toCurrencyCode];
  if (!rate) return 0;
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Convert an amount from one currency to another (via GBP).
 * Returns 0 if either currency code is not found.
 */
export function convertCurrency(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string
): number {
  const fromRate = gbpRates[fromCurrencyCode];
  const toRate = gbpRates[toCurrencyCode];
  if (!fromRate || !toRate) return 0;
  const gbpAmount = amount / fromRate;
  return Math.round(gbpAmount * toRate * 100) / 100;
}

/**
 * Format an amount with currency symbol and appropriate decimal places.
 * For currencies with very large values (e.g., VND, KRW), no decimals are shown.
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = currencySymbols[currencyCode] || currencyCode;
  const rate = gbpRates[currencyCode] || 1;

  // Currencies where fractional amounts don't make sense
  const noDecimalCurrencies = new Set([
    "JPY", "KRW", "VND", "IDR", "KHR", "LAK", "MMK", "MNT", "UZS",
    "PYG", "CLP", "COP", "UGX", "TZS", "RWF", "MGA", "BIF", "GNF",
    "KMF", "XOF", "XAF", "CDF", "KPW", "IRR", "IQD", "SYP", "LBP",
    "HUF", "ISK", "KZT", "SSP", "VUV", "ARS",
  ]);

  if (noDecimalCurrencies.has(currencyCode) || rate > 100) {
    return `${symbol} ${Math.round(amount).toLocaleString()}`;
  }

  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Get a rough daily budget range in local currency.
 * Categories: budget, mid-range, comfortable
 */
export function getDailyBudgetInLocal(
  currencyCode: string,
  tier: "budget" | "mid-range" | "comfortable" = "mid-range"
): { min: number; max: number; formatted: string } {
  // Daily budgets in GBP
  const budgets = {
    budget: { min: 20, max: 40 },
    "mid-range": { min: 50, max: 100 },
    comfortable: { min: 120, max: 250 },
  };

  const { min, max } = budgets[tier];
  const localMin = convertGBP(min, currencyCode);
  const localMax = convertGBP(max, currencyCode);

  return {
    min: localMin,
    max: localMax,
    formatted: `${formatCurrency(localMin, currencyCode)} - ${formatCurrency(localMax, currencyCode)}`,
  };
}

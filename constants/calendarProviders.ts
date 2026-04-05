// Visa Atlas — Calendar Provider Constants & Classification Config
// Curated lists of known travel booking organizer domains,
// type-specific keywords, and confidence scoring configuration.

import type { BookingType } from './bookings';

// ──────────────────────────────────────────────
// Known Organizers — domain -> booking type + provider name
// ──────────────────────────────────────────────

export const KNOWN_ORGANIZERS: Record<
  string,
  { type: BookingType; provider: string }
> = {
  // Hotels
  'booking.com': { type: 'hotel', provider: 'Booking.com' },
  'hotels.com': { type: 'hotel', provider: 'Hotels.com' },
  'marriott.com': { type: 'hotel', provider: 'Marriott' },
  'hilton.com': { type: 'hotel', provider: 'Hilton' },
  'ihg.com': { type: 'hotel', provider: 'IHG' },
  'accor.com': { type: 'hotel', provider: 'Accor' },
  'hyatt.com': { type: 'hotel', provider: 'Hyatt' },
  'airbnb.com': { type: 'hotel', provider: 'Airbnb' },
  'vrbo.com': { type: 'hotel', provider: 'Vrbo' },
  'hostelworld.com': { type: 'hotel', provider: 'Hostelworld' },

  // Flights
  'google.com/travel': { type: 'flight', provider: 'Google Travel' },
  'skyscanner.net': { type: 'flight', provider: 'Skyscanner' },
  'kayak.com': { type: 'flight', provider: 'Kayak' },
  'britishairways.com': { type: 'flight', provider: 'British Airways' },
  'emirates.com': { type: 'flight', provider: 'Emirates' },
  'ryanair.com': { type: 'flight', provider: 'Ryanair' },
  'easyjet.com': { type: 'flight', provider: 'easyJet' },
  'lufthansa.com': { type: 'flight', provider: 'Lufthansa' },
  'klm.com': { type: 'flight', provider: 'KLM' },
  'airfrance.com': { type: 'flight', provider: 'Air France' },
  'united.com': { type: 'flight', provider: 'United Airlines' },
  'delta.com': { type: 'flight', provider: 'Delta Air Lines' },
  'aa.com': { type: 'flight', provider: 'American Airlines' },
  'qatarairways.com': { type: 'flight', provider: 'Qatar Airways' },
  'singaporeair.com': { type: 'flight', provider: 'Singapore Airlines' },

  // Experiences
  'getyourguide.com': { type: 'experience', provider: 'GetYourGuide' },
  'viator.com': { type: 'experience', provider: 'Viator' },
  'klook.com': { type: 'experience', provider: 'Klook' },

  // Car Rental
  'hertz.com': { type: 'car_rental', provider: 'Hertz' },
  'avis.com': { type: 'car_rental', provider: 'Avis' },
  'europcar.com': { type: 'car_rental', provider: 'Europcar' },
  'enterprise.com': { type: 'car_rental', provider: 'Enterprise' },
  'sixt.com': { type: 'car_rental', provider: 'Sixt' },
  'turo.com': { type: 'car_rental', provider: 'Turo' },

  // Insurance
  'worldnomads.com': { type: 'insurance', provider: 'World Nomads' },
  'allianz-assistance.com': { type: 'insurance', provider: 'Allianz' },
  'axa.com': { type: 'insurance', provider: 'AXA' },

  // Restaurants
  'opentable.com': { type: 'restaurant', provider: 'OpenTable' },
  'thefork.com': { type: 'restaurant', provider: 'TheFork' },
  'resy.com': { type: 'restaurant', provider: 'Resy' },
};

// ──────────────────────────────────────────────
// Type Keywords — words/codes that indicate a specific booking type
// ──────────────────────────────────────────────

export const TYPE_KEYWORDS: Record<BookingType, string[]> = {
  flight: [
    'flight',
    'departing',
    'arriving',
    'departure',
    'arrival',
    'boarding',
    'gate',
    'terminal',
    'airline',
    'airways',
    // Common IATA airline codes
    'BA',
    'EK',
    'QR',
    'SQ',
    'LH',
    'AF',
    'UA',
    'DL',
    'AA',
    'FR',
    'U2',
  ],
  hotel: [
    'check-in',
    'check-out',
    'checkout',
    'checkin',
    'hotel',
    'resort',
    'hostel',
    'accommodation',
    'room',
    'stay at',
    'night at',
    'booking confirmation',
  ],
  experience: [
    'tour',
    'experience',
    'activity',
    'excursion',
    'tickets',
    'guided',
    'safari',
    'museum',
    'entrance',
    'admission',
  ],
  car_rental: [
    'car rental',
    'car hire',
    'pickup',
    'pick-up',
    'dropoff',
    'drop-off',
    'rental car',
    'vehicle',
  ],
  insurance: [
    'travel insurance',
    'policy',
    'coverage',
    'insured',
  ],
  restaurant: [
    'reservation',
    'table for',
    'dinner at',
    'lunch at',
    'brunch at',
    'restaurant',
    'dining',
  ],
};

// ──────────────────────────────────────────────
// Generic Travel Keywords — broad travel-related terms
// ──────────────────────────────────────────────

export const GENERIC_TRAVEL_KEYWORDS: string[] = [
  'booking',
  'reservation',
  'confirmation',
  'itinerary',
  'travel',
  'trip',
  'vacation',
];

// ──────────────────────────────────────────────
// Confidence Thresholds
// ──────────────────────────────────────────────

export const CONFIDENCE = {
  /** Minimum confidence to auto-import without user review */
  AUTO_IMPORT: 0.7,
  /** Minimum confidence to surface for user review */
  REVIEW: 0.3,
} as const;

// ──────────────────────────────────────────────
// Score Weights — used to compute classification confidence
// ──────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  KNOWN_ORGANIZER: 0.9,
  TYPE_KEYWORD: 0.3,
  GENERIC_KEYWORD: 0.15,
  HAS_LOCATION: 0.1,
  MULTI_DAY: 0.05,
} as const;

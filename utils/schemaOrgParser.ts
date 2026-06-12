// Visa Atlas — Schema.org JSON-LD Parser for Email Bookings
// Extracts structured booking data from schema.org markup embedded in email HTML
//
// JSON-LD from arbitrary senders is untrusted input — everything is parsed
// as `unknown` and narrowed through the helpers below instead of `any`
// property chains, so a malformed payload can never leak an object into a
// string field ("[object Object]") or throw mid-parse.

import type { BookingType } from '@/constants/bookings';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ParsedEmailBooking {
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  confirmationNumber?: string;
  provider: string;
  details: Record<string, string>;
}

// ──────────────────────────────────────────────
// Schema.org @type → BookingType mapping
// ──────────────────────────────────────────────

const SCHEMA_TYPE_MAP: Record<string, BookingType> = {
  FlightReservation: 'flight',
  LodgingReservation: 'hotel',
  FoodEstablishmentReservation: 'restaurant',
  RentalCarReservation: 'car_rental',
  EventReservation: 'experience',
  BusReservation: 'flight',
  TrainReservation: 'flight',
};

// ──────────────────────────────────────────────
// Narrowing helpers
// ──────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walks a key path through nested unknown values. Returns undefined as soon
 * as any hop isn't a plain object.
 */
function get(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Like get(), but only returns non-empty string leaves. */
function getString(value: unknown, ...path: string[]): string | undefined {
  const leaf = get(value, ...path);
  return typeof leaf === 'string' && leaf.length > 0 ? leaf : undefined;
}

/** Date-like JSON-LD leaves are ISO strings; tolerate epoch numbers too. */
function getDateLike(value: unknown, ...path: string[]): string | number | undefined {
  const leaf = get(value, ...path);
  return typeof leaf === 'string' || typeof leaf === 'number' ? leaf : undefined;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Converts an arbitrary date-like value to a YYYY-MM-DD string.
 * Falls back to today's date when the value is missing or unparseable.
 */
function toDateString(value: string | number | undefined): string {
  if (value == null || value === '') return todayString();

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return todayString();

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts a provider name from a schema.org reservation item.
 * Tries several common locations before falling back to the sender domain.
 */
function extractProvider(item: unknown, senderDomain: string): string {
  const fromItem =
    getString(item, 'provider', 'name') ??
    getString(item, 'reservationFor', 'provider', 'name') ??
    getString(item, 'airline', 'name');
  if (fromItem) return fromItem;

  // Prettify the sender domain as a fallback
  const domainName = senderDomain.replace(/\.\w+$/, '');
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}

function getConfirmationNumber(item: unknown): string | undefined {
  return getString(item, 'reservationNumber') ?? getString(item, 'confirmationNumber');
}

// ──────────────────────────────────────────────
// Type-specific parsers
// ──────────────────────────────────────────────

function parseFlight(item: unknown, provider: string): ParsedEmailBooking {
  const dep = getString(item, 'reservationFor', 'departureAirport', 'iataCode') ?? '???';
  const arr = getString(item, 'reservationFor', 'arrivalAirport', 'iataCode') ?? '???';
  const flightNumber =
    getString(item, 'reservationFor', 'flightNumber') ??
    getString(item, 'reservationFor', 'trainNumber') ??
    getString(item, 'reservationFor', 'busNumber') ??
    '';
  const airline =
    getString(item, 'reservationFor', 'airline', 'name') ??
    getString(item, 'airline', 'name') ??
    provider;

  return {
    type: 'flight',
    title: `${dep} → ${arr}${flightNumber ? ' ' + flightNumber : ''}`,
    startDate: toDateString(
      getDateLike(item, 'reservationFor', 'departureTime') ??
        getDateLike(item, 'reservationFor', 'departureDate')
    ),
    endDate: toDateString(
      getDateLike(item, 'reservationFor', 'arrivalTime') ??
        getDateLike(item, 'reservationFor', 'arrivalDate')
    ),
    location: `${dep} → ${arr}`,
    confirmationNumber: getConfirmationNumber(item),
    provider,
    details: {
      airline,
      flightNumber,
      departure: dep,
      arrival: arr,
      class: getString(item, 'reservationFor', 'boardingGroup') ?? '',
    },
  };
}

function parseHotel(item: unknown, provider: string): ParsedEmailBooking {
  const hotelName =
    getString(item, 'reservationFor', 'name') ??
    getString(item, 'reservationFor', 'hotelName') ??
    provider;
  // address can be a PostalAddress object or a plain string
  const address =
    getString(item, 'reservationFor', 'address', 'streetAddress') ??
    getString(item, 'reservationFor', 'address', 'name') ??
    getString(item, 'reservationFor', 'address') ??
    '';

  const checkIn = toDateString(
    getDateLike(item, 'checkinTime') ?? getDateLike(item, 'checkinDate')
  );
  const checkOut = toDateString(
    getDateLike(item, 'checkoutTime') ?? getDateLike(item, 'checkoutDate')
  );

  return {
    type: 'hotel',
    title: hotelName,
    startDate: checkIn,
    endDate: checkOut,
    location: address || undefined,
    confirmationNumber: getConfirmationNumber(item),
    provider,
    details: {
      hotelName,
      address,
      checkIn,
      checkOut,
      roomType: getString(item, 'reservationFor', 'roomType') ?? '',
    },
  };
}

function parseRestaurant(item: unknown, provider: string): ParsedEmailBooking {
  const name = getString(item, 'reservationFor', 'name') ?? provider;
  const partySizeRaw = get(item, 'partySize');
  const partySize =
    typeof partySizeRaw === 'number' || typeof partySizeRaw === 'string'
      ? String(partySizeRaw)
      : '';

  return {
    type: 'restaurant',
    title: name,
    startDate: toDateString(
      getDateLike(item, 'startTime') ?? getDateLike(item, 'reservationFor', 'startDate')
    ),
    location: name,
    confirmationNumber: getConfirmationNumber(item),
    provider,
    details: {
      name,
      cuisine: '',
      partySize,
      time: getString(item, 'startTime') ?? '',
    },
  };
}

function parseCarRental(item: unknown, provider: string): ParsedEmailBooking {
  const pickupLocation =
    getString(item, 'pickupLocation', 'name') ??
    getString(item, 'pickupLocation', 'address') ??
    '';
  const dropoffLocation =
    getString(item, 'dropoffLocation', 'name') ??
    getString(item, 'dropoffLocation', 'address') ??
    '';

  return {
    type: 'car_rental',
    title: `${provider} rental`,
    startDate: toDateString(
      getDateLike(item, 'pickupTime') ?? getDateLike(item, 'pickupDate')
    ),
    endDate: toDateString(
      getDateLike(item, 'dropoffTime') ?? getDateLike(item, 'dropoffDate')
    ),
    location: pickupLocation || undefined,
    confirmationNumber: getConfirmationNumber(item),
    provider,
    details: {
      company: provider,
      pickupLocation,
      dropoffLocation,
      carType: getString(item, 'reservationFor', 'name') ?? '',
    },
  };
}

function parseExperience(item: unknown, provider: string): ParsedEmailBooking {
  const name = getString(item, 'reservationFor', 'name') ?? provider;
  // location can be a Place object or a plain string
  const location =
    getString(item, 'reservationFor', 'location', 'name') ??
    getString(item, 'reservationFor', 'location', 'address') ??
    getString(item, 'reservationFor', 'location') ??
    '';

  const endDateRaw = getDateLike(item, 'reservationFor', 'endDate');

  return {
    type: 'experience',
    title: name,
    startDate: toDateString(
      getDateLike(item, 'reservationFor', 'startDate') ?? getDateLike(item, 'startTime')
    ),
    endDate: endDateRaw != null ? toDateString(endDateRaw) : undefined,
    location: location || undefined,
    confirmationNumber: getConfirmationNumber(item),
    provider,
    details: {
      activityName: name,
      duration: '',
      meetingPoint: location,
      groupSize: '',
    },
  };
}

// ──────────────────────────────────────────────
// Main parser
// ──────────────────────────────────────────────

/**
 * Parses schema.org JSON-LD blocks from an email's HTML body and returns
 * the first recognized travel booking, or null if none is found.
 */
export function parseSchemaOrg(
  htmlBody: string,
  senderDomain: string
): ParsedEmailBooking | null {
  // Extract all <script type="application/ld+json"> blocks
  const jsonLdRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(htmlBody)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON, skip
    }

    // Normalize to array (JSON-LD can be a single object or an array)
    const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!isRecord(item)) continue;

      const schemaType = item['@type'];
      if (typeof schemaType !== 'string') continue;

      const bookingType = SCHEMA_TYPE_MAP[schemaType];
      if (!bookingType) continue;

      const provider = extractProvider(item, senderDomain);

      switch (bookingType) {
        case 'flight':
          return parseFlight(item, provider);
        case 'hotel':
          return parseHotel(item, provider);
        case 'restaurant':
          return parseRestaurant(item, provider);
        case 'car_rental':
          return parseCarRental(item, provider);
        case 'experience':
          return parseExperience(item, provider);
        default:
          continue;
      }
    }
  }

  return null;
}

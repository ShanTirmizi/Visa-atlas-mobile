// Visa Atlas — Schema.org JSON-LD Parser for Email Bookings
// Extracts structured booking data from schema.org markup embedded in email HTML

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
// Helpers
// ──────────────────────────────────────────────

/**
 * Converts an arbitrary date-like value to a YYYY-MM-DD string.
 * Falls back to today's date when the value is missing or unparseable.
 */
function toDateString(value: any): string {
  if (!value) return todayString();

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
function extractProvider(item: any, senderDomain: string): string {
  if (item.provider?.name) return item.provider.name;
  if (item.reservationFor?.provider?.name) return item.reservationFor?.provider.name;
  if (item.airline?.name) return item.airline.name;

  // Prettify the sender domain as a fallback
  const domainName = senderDomain.replace(/\.\w+$/, '');
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}

// ──────────────────────────────────────────────
// Type-specific parsers
// ──────────────────────────────────────────────

function parseFlight(item: any, provider: string): ParsedEmailBooking {
  const dep = item.reservationFor?.departureAirport?.iataCode ?? '???';
  const arr = item.reservationFor?.arrivalAirport?.iataCode ?? '???';
  const flightNumber =
    item.reservationFor?.flightNumber ??
    item.reservationFor?.trainNumber ??
    item.reservationFor?.busNumber ??
    '';
  const airline =
    item.reservationFor?.airline?.name ?? item.airline?.name ?? provider;

  return {
    type: 'flight',
    title: `${dep} → ${arr}${flightNumber ? ' ' + flightNumber : ''}`,
    startDate: toDateString(
      item.reservationFor?.departureTime ?? item.reservationFor?.departureDate
    ),
    endDate: toDateString(
      item.reservationFor?.arrivalTime ?? item.reservationFor?.arrivalDate
    ),
    location: `${dep} → ${arr}`,
    confirmationNumber:
      item.reservationNumber ?? item.confirmationNumber ?? undefined,
    provider,
    details: {
      airline,
      flightNumber,
      departure: dep,
      arrival: arr,
      class: item.reservationFor?.boardingGroup ?? '',
    },
  };
}

function parseHotel(item: any, provider: string): ParsedEmailBooking {
  const hotelName =
    item.reservationFor?.name ?? item.reservationFor?.hotelName ?? provider;
  const address =
    item.reservationFor?.address?.streetAddress ??
    item.reservationFor?.address?.name ??
    (typeof item.reservationFor?.address === 'string'
      ? item.reservationFor.address
      : '');

  return {
    type: 'hotel',
    title: hotelName,
    startDate: toDateString(item.checkinTime ?? item.checkinDate),
    endDate: toDateString(item.checkoutTime ?? item.checkoutDate),
    location: address || undefined,
    confirmationNumber:
      item.reservationNumber ?? item.confirmationNumber ?? undefined,
    provider,
    details: {
      hotelName,
      address,
      checkIn: toDateString(item.checkinTime ?? item.checkinDate),
      checkOut: toDateString(item.checkoutTime ?? item.checkoutDate),
      roomType: item.reservationFor?.roomType ?? '',
    },
  };
}

function parseRestaurant(item: any, provider: string): ParsedEmailBooking {
  const name = item.reservationFor?.name ?? provider;
  const partySize = item.partySize ? String(item.partySize) : '';

  return {
    type: 'restaurant',
    title: name,
    startDate: toDateString(item.startTime ?? item.reservationFor?.startDate),
    location: name,
    confirmationNumber:
      item.reservationNumber ?? item.confirmationNumber ?? undefined,
    provider,
    details: {
      name,
      cuisine: '',
      partySize,
      time: item.startTime ?? '',
    },
  };
}

function parseCarRental(item: any, provider: string): ParsedEmailBooking {
  const pickupLocation =
    item.pickupLocation?.name ?? item.pickupLocation?.address ?? '';
  const dropoffLocation =
    item.dropoffLocation?.name ?? item.dropoffLocation?.address ?? '';

  return {
    type: 'car_rental',
    title: `${provider} rental`,
    startDate: toDateString(item.pickupTime ?? item.pickupDate),
    endDate: toDateString(item.dropoffTime ?? item.dropoffDate),
    location: pickupLocation || undefined,
    confirmationNumber:
      item.reservationNumber ?? item.confirmationNumber ?? undefined,
    provider,
    details: {
      company: provider,
      pickupLocation,
      dropoffLocation,
      carType: item.reservationFor?.name ?? '',
    },
  };
}

function parseExperience(item: any, provider: string): ParsedEmailBooking {
  const name = item.reservationFor?.name ?? provider;
  const location =
    item.reservationFor?.location?.name ??
    item.reservationFor?.location?.address ??
    (typeof item.reservationFor?.location === 'string'
      ? item.reservationFor.location
      : '');

  return {
    type: 'experience',
    title: name,
    startDate: toDateString(
      item.reservationFor?.startDate ?? item.startTime
    ),
    endDate: item.reservationFor?.endDate
      ? toDateString(item.reservationFor.endDate)
      : undefined,
    location: location || undefined,
    confirmationNumber:
      item.reservationNumber ?? item.confirmationNumber ?? undefined,
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

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON, skip
    }

    // Normalize to array (JSON-LD can be a single object or an array)
    const items: any[] = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      const schemaType = item['@type'];
      if (!schemaType) continue;

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

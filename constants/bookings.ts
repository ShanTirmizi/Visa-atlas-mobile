// Visa Atlas — Booking Type Definitions & Helpers
// Shared types and configuration for trip bookings

import {
  Plane,
  Hotel,
  Compass,
  Car,
  Shield,
  UtensilsCrossed,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type BookingType =
  | 'flight'
  | 'hotel'
  | 'experience'
  | 'car_rental'
  | 'insurance'
  | 'restaurant';

export type BookingSource = 'manual' | 'calendar' | 'api';

export type BookingStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

// ──────────────────────────────────────────────
// Detail Interfaces
// ──────────────────────────────────────────────

export interface FlightDetails {
  airline: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  class: string;
}

export interface HotelDetails {
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
}

export interface ExperienceDetails {
  activityName: string;
  duration: string;
  meetingPoint: string;
  groupSize: string;
}

export interface CarDetails {
  company: string;
  pickupLocation: string;
  dropoffLocation: string;
  carType: string;
}

export interface InsuranceDetails {
  provider: string;
  policyNumber: string;
  coverage: string;
  travelers: string;
}

export interface RestaurantDetails {
  name: string;
  cuisine: string;
  partySize: string;
  time: string;
}

// ──────────────────────────────────────────────
// Booking Field Config
// ──────────────────────────────────────────────

export interface BookingField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}

// ──────────────────────────────────────────────
// Booking Type Config
// ──────────────────────────────────────────────

export interface BookingTypeConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  darkColor: string;
  fields: BookingField[];
}

// ──────────────────────────────────────────────
// BOOKING_TYPES — master config record
// ──────────────────────────────────────────────

export const BOOKING_TYPES: Record<BookingType, BookingTypeConfig> = {
  flight: {
    label: 'Flight',
    icon: Plane,
    color: '#3B82F6',
    darkColor: '#60A5FA',
    fields: [
      { key: 'airline', label: 'Airline', placeholder: 'e.g. Emirates', required: true },
      { key: 'flightNumber', label: 'Flight Number', placeholder: 'e.g. EK202', required: true },
      { key: 'departure', label: 'Departure', placeholder: 'e.g. Dubai (DXB)', required: true },
      { key: 'arrival', label: 'Arrival', placeholder: 'e.g. London (LHR)', required: true },
      { key: 'class', label: 'Class', placeholder: 'e.g. Economy' },
    ],
  },
  hotel: {
    label: 'Hotel',
    icon: Hotel,
    color: '#8B5CF6',
    darkColor: '#A78BFA',
    fields: [
      { key: 'hotelName', label: 'Hotel Name', placeholder: 'e.g. The Ritz', required: true },
      { key: 'address', label: 'Address', placeholder: 'e.g. 150 Piccadilly, London' },
      { key: 'checkIn', label: 'Check-in', placeholder: 'e.g. 15 May 2026', required: true },
      { key: 'checkOut', label: 'Check-out', placeholder: 'e.g. 22 May 2026', required: true },
      { key: 'roomType', label: 'Room Type', placeholder: 'e.g. Deluxe King' },
    ],
  },
  experience: {
    label: 'Experience',
    icon: Compass,
    color: '#F59E0B',
    darkColor: '#FBBF24',
    fields: [
      { key: 'activityName', label: 'Activity Name', placeholder: 'e.g. Scuba Diving', required: true },
      { key: 'duration', label: 'Duration', placeholder: 'e.g. 3 hours' },
      { key: 'meetingPoint', label: 'Meeting Point', placeholder: 'e.g. Marina Bay' },
      { key: 'groupSize', label: 'Group Size', placeholder: 'e.g. 4', keyboardType: 'numeric' },
    ],
  },
  car_rental: {
    label: 'Car Rental',
    icon: Car,
    color: '#10B981',
    darkColor: '#34D399',
    fields: [
      { key: 'company', label: 'Company', placeholder: 'e.g. Hertz', required: true },
      { key: 'pickupLocation', label: 'Pickup Location', placeholder: 'e.g. Airport Terminal 3', required: true },
      { key: 'dropoffLocation', label: 'Drop-off Location', placeholder: 'e.g. City Centre' },
      { key: 'carType', label: 'Car Type', placeholder: 'e.g. SUV' },
    ],
  },
  insurance: {
    label: 'Insurance',
    icon: Shield,
    color: '#6366F1',
    darkColor: '#818CF8',
    fields: [
      { key: 'provider', label: 'Provider', placeholder: 'e.g. Allianz', required: true },
      { key: 'policyNumber', label: 'Policy Number', placeholder: 'e.g. POL-123456', required: true },
      { key: 'coverage', label: 'Coverage', placeholder: 'e.g. Medical + Cancellation' },
      { key: 'travelers', label: 'Travelers', placeholder: 'e.g. 2', keyboardType: 'numeric' },
    ],
  },
  restaurant: {
    label: 'Restaurant',
    icon: UtensilsCrossed,
    color: '#EF4444',
    darkColor: '#F87171',
    fields: [
      { key: 'name', label: 'Name', placeholder: 'e.g. Nobu', required: true },
      { key: 'cuisine', label: 'Cuisine', placeholder: 'e.g. Japanese' },
      { key: 'partySize', label: 'Party Size', placeholder: 'e.g. 4', keyboardType: 'numeric' },
      { key: 'time', label: 'Time', placeholder: 'e.g. 7:30 PM', required: true },
    ],
  },
} as const;

// ──────────────────────────────────────────────
// Display-ordered list of all booking types
// ──────────────────────────────────────────────

export const BOOKING_TYPE_LIST: BookingType[] = [
  'flight',
  'hotel',
  'experience',
  'car_rental',
  'insurance',
  'restaurant',
];

// ──────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────

/** Returns the full config for a booking type */
export function getBookingTypeConfig(type: BookingType): BookingTypeConfig {
  return BOOKING_TYPES[type];
}

/** Returns the icon component for a booking type */
export function getBookingIcon(type: BookingType): LucideIcon {
  return BOOKING_TYPES[type].icon;
}

/** Returns the appropriate color for a booking type based on theme */
export function getBookingColor(type: BookingType, isDark: boolean): string {
  return isDark ? BOOKING_TYPES[type].darkColor : BOOKING_TYPES[type].color;
}

/**
 * Formats a date range nicely.
 *   Same month:      "15-22 May 2026"
 *   Different month:  "15 May - 2 Jun 2026"
 *   Single date:      "15 May 2026"
 */
export function formatBookingDates(startDate: Date, endDate?: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const startDay = startDate.getDate();
  const startMonth = months[startDate.getMonth()];
  const startYear = startDate.getFullYear();

  if (!endDate) {
    return `${startDay} ${startMonth} ${startYear}`;
  }

  const endDay = endDate.getDate();
  const endMonth = months[endDate.getMonth()];
  const endYear = endDate.getFullYear();

  // Same month and year
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startYear === endYear
  ) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`;
  }

  // Different months but same year
  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }

  // Different years
  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

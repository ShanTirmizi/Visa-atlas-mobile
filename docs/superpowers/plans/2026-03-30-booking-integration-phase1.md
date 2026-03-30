# Booking Integration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual booking entry, bookings UI (integrated into Trips tab), trip-linked booking timeline, and smart trip matching — so users can track flights, hotels, experiences, car rentals, insurance, and restaurant reservations alongside their trip plans.

**Architecture:** New `bookings` table in Convex with type-discriminated records. Bookings toggle added to existing Trips screen via segmented control. Booking detail via bottom sheet (matching existing `@gorhom/bottom-sheet` pattern). Trip matching uses country code + date overlap scoring.

**Tech Stack:** Convex (schema + queries/mutations), React Native, Expo Router, @gorhom/bottom-sheet, lucide-react-native, existing theme system.

---

### Task 1: Add `bookings` table to Convex schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the bookings table definition**

Add the `bookings` table after the existing `visaGuides` table in `convex/schema.ts`:

```typescript
// In convex/schema.ts, after the visaGuides table definition, add:

  bookings: defineTable({
    // Classification
    type: v.union(
      v.literal("flight"),
      v.literal("hotel"),
      v.literal("experience"),
      v.literal("car_rental"),
      v.literal("insurance"),
      v.literal("restaurant")
    ),
    source: v.union(
      v.literal("manual"),
      v.literal("calendar"),
      v.literal("api")
    ),
    provider: v.string(), // e.g. "Booking.com", "Airbnb", "Manual"
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),

    // Core fields
    title: v.string(),
    startDate: v.string(), // ISO date
    endDate: v.optional(v.string()), // ISO date
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()), // ISO 3166-1 alpha-3
    confirmationNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Type-specific details (JSON strings)
    flightDetails: v.optional(v.string()),
    hotelDetails: v.optional(v.string()),
    experienceDetails: v.optional(v.string()),
    carDetails: v.optional(v.string()),
    insuranceDetails: v.optional(v.string()),
    restaurantDetails: v.optional(v.string()),

    // Trip linking
    tripId: v.optional(v.id("trips")),
    autoMatched: v.optional(v.boolean()),

    // Calendar sync (future-proofing)
    calendarEventId: v.optional(v.string()),
    calendarSource: v.optional(v.union(v.literal("google"), v.literal("apple"))),
  })
    .index("by_trip", ["tripId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_date", ["startDate"]),
```

- [ ] **Step 2: Verify the schema compiles**

Run: `npx convex dev --once` (or check that the Convex dev server picks up the change without errors).

Expected: Schema accepted, `bookings` table created.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add bookings table to Convex schema"
```

---

### Task 2: Create bookings queries and mutations

**Files:**
- Create: `convex/bookings.ts`

- [ ] **Step 1: Create the bookings Convex file with all queries and mutations**

Create `convex/bookings.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ===== Queries =====

export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bookings").order("desc").collect();
  },
});

export const listBookingsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const listUnassignedBookings = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("bookings").order("desc").collect();
    return all.filter((b) => !b.tripId);
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ===== Mutations =====

const bookingTypeValidator = v.union(
  v.literal("flight"),
  v.literal("hotel"),
  v.literal("experience"),
  v.literal("car_rental"),
  v.literal("insurance"),
  v.literal("restaurant")
);

const bookingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("calendar"),
  v.literal("api")
);

const bookingStatusValidator = v.union(
  v.literal("upcoming"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled")
);

export const createBooking = mutation({
  args: {
    type: bookingTypeValidator,
    source: bookingSourceValidator,
    provider: v.string(),
    status: bookingStatusValidator,
    title: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    confirmationNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    flightDetails: v.optional(v.string()),
    hotelDetails: v.optional(v.string()),
    experienceDetails: v.optional(v.string()),
    carDetails: v.optional(v.string()),
    insuranceDetails: v.optional(v.string()),
    restaurantDetails: v.optional(v.string()),
    tripId: v.optional(v.id("trips")),
    autoMatched: v.optional(v.boolean()),
    calendarEventId: v.optional(v.string()),
    calendarSource: v.optional(v.union(v.literal("google"), v.literal("apple"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookings", args);
  },
});

export const updateBooking = mutation({
  args: {
    id: v.id("bookings"),
    title: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    confirmationNumber: v.optional(v.string()),
    cost: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(bookingStatusValidator),
    flightDetails: v.optional(v.string()),
    hotelDetails: v.optional(v.string()),
    experienceDetails: v.optional(v.string()),
    carDetails: v.optional(v.string()),
    insuranceDetails: v.optional(v.string()),
    restaurantDetails: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const linkBookingToTrip = mutation({
  args: {
    id: v.id("bookings"),
    tripId: v.optional(v.id("trips")),
    autoMatched: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      tripId: args.tripId,
      autoMatched: args.autoMatched ?? false,
    });
  },
});

export const unlinkBookingFromTrip = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { tripId: undefined, autoMatched: false });
  },
});

export const deleteBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Verify queries and mutations compile**

Run: `npx convex dev --once`

Expected: No errors, `api.bookings.*` functions available.

- [ ] **Step 3: Commit**

```bash
git add convex/bookings.ts
git commit -m "feat: add bookings queries and mutations"
```

---

### Task 3: Create booking type definitions and helpers

**Files:**
- Create: `constants/bookings.ts`

- [ ] **Step 1: Create the booking constants and type helpers file**

Create `constants/bookings.ts`:

```typescript
import {
  Plane,
  Hotel,
  Compass,
  Car,
  Shield,
  UtensilsCrossed,
} from 'lucide-react-native';

// ─── Types ──────────────────────────────────────────

export type BookingType =
  | 'flight'
  | 'hotel'
  | 'experience'
  | 'car_rental'
  | 'insurance'
  | 'restaurant';

export type BookingSource = 'manual' | 'calendar' | 'api';
export type BookingStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface FlightDetails {
  airline: string;
  flightNumber: string;
  departure: string; // airport code
  arrival: string;   // airport code
  class?: string;
  stops?: number;
}

export interface HotelDetails {
  hotelName: string;
  address?: string;
  checkIn: string;  // time e.g. "15:00"
  checkOut: string;  // time e.g. "11:00"
  roomType?: string;
  guests?: number;
}

export interface ExperienceDetails {
  activityName: string;
  duration?: string;
  meetingPoint?: string;
  groupSize?: number;
}

export interface CarDetails {
  company: string;
  pickupLocation: string;
  dropoffLocation: string;
  carType?: string;
}

export interface InsuranceDetails {
  provider: string;
  policyNumber?: string;
  coverage?: string;
  travelers?: number;
}

export interface RestaurantDetails {
  name: string;
  cuisine?: string;
  partySize?: number;
  time: string; // e.g. "19:30"
}

// ─── Config per booking type ────────────────────────

export interface BookingTypeConfig {
  label: string;
  icon: typeof Plane;
  color: string;      // accent color for the type
  darkColor: string;  // dark mode accent
  fields: {
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    keyboardType?: 'default' | 'numeric' | 'email-address';
  }[];
}

export const BOOKING_TYPES: Record<BookingType, BookingTypeConfig> = {
  flight: {
    label: 'Flight',
    icon: Plane,
    color: '#3B82F6',     // blue
    darkColor: '#60A5FA',
    fields: [
      { key: 'airline', label: 'Airline', placeholder: 'e.g. British Airways', required: true },
      { key: 'flightNumber', label: 'Flight Number', placeholder: 'e.g. BA005' },
      { key: 'departure', label: 'From (Airport)', placeholder: 'e.g. LHR', required: true },
      { key: 'arrival', label: 'To (Airport)', placeholder: 'e.g. NRT', required: true },
      { key: 'class', label: 'Class', placeholder: 'e.g. Economy' },
    ],
  },
  hotel: {
    label: 'Hotel',
    icon: Hotel,
    color: '#8B5CF6',     // purple
    darkColor: '#A78BFA',
    fields: [
      { key: 'hotelName', label: 'Hotel Name', placeholder: 'e.g. Hilton Tokyo', required: true },
      { key: 'address', label: 'Address', placeholder: 'Full address' },
      { key: 'checkIn', label: 'Check-in Time', placeholder: 'e.g. 15:00' },
      { key: 'checkOut', label: 'Check-out Time', placeholder: 'e.g. 11:00' },
      { key: 'roomType', label: 'Room Type', placeholder: 'e.g. Double' },
    ],
  },
  experience: {
    label: 'Experience',
    icon: Compass,
    color: '#F59E0B',     // amber
    darkColor: '#FBBF24',
    fields: [
      { key: 'activityName', label: 'Activity', placeholder: 'e.g. Temple tour', required: true },
      { key: 'duration', label: 'Duration', placeholder: 'e.g. 3 hours' },
      { key: 'meetingPoint', label: 'Meeting Point', placeholder: 'Where to meet' },
      { key: 'groupSize', label: 'Group Size', placeholder: 'e.g. 4', keyboardType: 'numeric' },
    ],
  },
  car_rental: {
    label: 'Car Rental',
    icon: Car,
    color: '#10B981',     // emerald
    darkColor: '#34D399',
    fields: [
      { key: 'company', label: 'Company', placeholder: 'e.g. Hertz', required: true },
      { key: 'pickupLocation', label: 'Pickup Location', placeholder: 'e.g. Tokyo Airport' },
      { key: 'dropoffLocation', label: 'Dropoff Location', placeholder: 'e.g. Osaka Airport' },
      { key: 'carType', label: 'Car Type', placeholder: 'e.g. Compact SUV' },
    ],
  },
  insurance: {
    label: 'Insurance',
    icon: Shield,
    color: '#6366F1',     // indigo
    darkColor: '#818CF8',
    fields: [
      { key: 'provider', label: 'Provider', placeholder: 'e.g. World Nomads', required: true },
      { key: 'policyNumber', label: 'Policy Number', placeholder: 'e.g. WN-123456' },
      { key: 'coverage', label: 'Coverage', placeholder: 'e.g. Medical + Trip cancellation' },
      { key: 'travelers', label: 'Travelers', placeholder: 'e.g. 2', keyboardType: 'numeric' },
    ],
  },
  restaurant: {
    label: 'Restaurant',
    icon: UtensilsCrossed,
    color: '#EF4444',     // red
    darkColor: '#F87171',
    fields: [
      { key: 'name', label: 'Restaurant Name', placeholder: 'e.g. Sukiyabashi Jiro', required: true },
      { key: 'cuisine', label: 'Cuisine', placeholder: 'e.g. Japanese' },
      { key: 'partySize', label: 'Party Size', placeholder: 'e.g. 2', keyboardType: 'numeric' },
      { key: 'time', label: 'Reservation Time', placeholder: 'e.g. 19:30' },
    ],
  },
};

// ─── Helpers ────────────────────────────────────────

export function getBookingTypeConfig(type: BookingType): BookingTypeConfig {
  return BOOKING_TYPES[type];
}

export function getBookingIcon(type: BookingType) {
  return BOOKING_TYPES[type].icon;
}

export function getBookingColor(type: BookingType, isDark: boolean): string {
  return isDark ? BOOKING_TYPES[type].darkColor : BOOKING_TYPES[type].color;
}

export function formatBookingDates(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!endDate || startDate === endDate) {
    return start.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  }
  const end = new Date(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}-${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('en-GB', opts)} - ${end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

export const BOOKING_TYPE_LIST: BookingType[] = [
  'flight',
  'hotel',
  'experience',
  'car_rental',
  'insurance',
  'restaurant',
];
```

- [ ] **Step 2: Commit**

```bash
git add constants/bookings.ts
git commit -m "feat: add booking type definitions and helpers"
```

---

### Task 4: Create trip matching utility

**Files:**
- Create: `utils/tripMatcher.ts`

- [ ] **Step 1: Create the trip matching utility**

Create `utils/tripMatcher.ts`:

```typescript
type Trip = {
  _id: string;
  countryCode: string;
  startDate?: string;
  endDate?: string;
  duration: number;
  isMultiCountry?: boolean;
  legs?: string; // JSON array of leg objects
};

type MatchResult = {
  tripId: string;
  confidence: 'high' | 'medium' | 'low';
};

/**
 * Find the best matching trip for a booking based on country + date overlap.
 * Returns null if no match found.
 */
export function findMatchingTrip(
  countryCode: string | undefined,
  startDate: string,
  endDate: string | undefined,
  trips: Trip[]
): MatchResult | null {
  if (!countryCode || trips.length === 0) return null;

  const bookingStart = new Date(startDate).getTime();
  const bookingEnd = endDate ? new Date(endDate).getTime() : bookingStart;
  const BUFFER_MS = 24 * 60 * 60 * 1000; // 1-day buffer

  let bestMatch: MatchResult | null = null;
  let bestScore = 0;

  for (const trip of trips) {
    if (!trip.startDate) continue;

    const tripStart = new Date(trip.startDate).getTime();
    const tripEnd = trip.endDate
      ? new Date(trip.endDate).getTime()
      : tripStart + trip.duration * 24 * 60 * 60 * 1000;

    // Check date overlap (with 1-day buffer on each side)
    const hasDateOverlap =
      bookingStart <= tripEnd + BUFFER_MS && bookingEnd >= tripStart - BUFFER_MS;

    if (!hasDateOverlap) continue;

    // Check country match
    const tripCountries = getTripCountries(trip);
    const exactCountryMatch = tripCountries.includes(countryCode);

    // Score the match
    let score = 0;
    if (exactCountryMatch && hasDateOverlap) {
      score = 3; // high confidence
    } else if (hasDateOverlap && trip.isMultiCountry) {
      score = 1; // low — date overlap on multi-country trip, different country
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        tripId: trip._id,
        confidence: score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low',
      };
    }
  }

  return bestMatch;
}

/**
 * Extract all country codes from a trip (including multi-country legs).
 */
function getTripCountries(trip: Trip): string[] {
  const countries = [trip.countryCode];

  if (trip.isMultiCountry && trip.legs) {
    try {
      const legs = JSON.parse(trip.legs) as { countryCode?: string }[];
      for (const leg of legs) {
        if (leg.countryCode && !countries.includes(leg.countryCode)) {
          countries.push(leg.countryCode);
        }
      }
    } catch {
      // malformed JSON — just use the main country
    }
  }

  return countries;
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/tripMatcher.ts
git commit -m "feat: add trip matching utility for bookings"
```

---

### Task 5: Create the booking type picker component

**Files:**
- Create: `components/booking/BookingTypePicker.tsx`

- [ ] **Step 1: Create the type picker grid component**

Create `components/booking/BookingTypePicker.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { BOOKING_TYPE_LIST, BOOKING_TYPES, type BookingType } from '@/constants/bookings';

interface BookingTypePickerProps {
  onSelect: (type: BookingType) => void;
}

export default function BookingTypePicker({ onSelect }: BookingTypePickerProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        What are you booking?
      </Text>
      <View style={styles.grid}>
        {BOOKING_TYPE_LIST.map((type) => {
          const config = BOOKING_TYPES[type];
          const Icon = config.icon;
          const typeColor = isDark ? config.darkColor : config.color;

          return (
            <TouchableOpacity
              key={type}
              activeOpacity={0.7}
              onPress={() => onSelect(type)}
              style={[
                styles.tile,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                Shadows.subtle,
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: typeColor + '18' }]}>
                <Icon color={typeColor} size={24} />
              </View>
              <Text style={[styles.tileLabel, { color: colors.foreground }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tileLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingTypePicker.tsx
git commit -m "feat: add booking type picker component"
```

---

### Task 6: Create the booking form component

**Files:**
- Create: `components/booking/BookingForm.tsx`

- [ ] **Step 1: Create the dynamic booking form**

Create `components/booking/BookingForm.tsx`:

```tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  BOOKING_TYPES,
  type BookingType,
  getBookingColor,
} from '@/constants/bookings';

interface BookingFormProps {
  type: BookingType;
  onBack: () => void;
  onSubmit: (data: BookingFormData) => void;
  defaultCountryCode?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

export interface BookingFormData {
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  countryCode: string;
  confirmationNumber: string;
  cost: string;
  currency: string;
  notes: string;
  typeDetails: Record<string, string>;
}

export default function BookingForm({
  type,
  onBack,
  onSubmit,
  defaultCountryCode = '',
  defaultStartDate = '',
  defaultEndDate = '',
}: BookingFormProps) {
  const { colors, isDark } = useTheme();
  const config = BOOKING_TYPES[type];
  const typeColor = getBookingColor(type, isDark);
  const Icon = config.icon;

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [location, setLocation] = useState('');
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [notes, setNotes] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [typeDetails, setTypeDetails] = useState<Record<string, string>>({});

  const updateDetail = (key: string, value: string) => {
    setTypeDetails((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && startDate.trim().length > 0;
  }, [title, startDate]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      title: title.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      location: location.trim(),
      countryCode: countryCode.trim(),
      confirmationNumber: confirmationNumber.trim(),
      cost: cost.trim(),
      currency: currency.trim(),
      notes: notes.trim(),
      typeDetails,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ArrowLeft color={colors.foreground} size={22} />
          </TouchableOpacity>
          <View style={[styles.headerIcon, { backgroundColor: typeColor + '18' }]}>
            <Icon color={typeColor} size={20} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Add {config.label}
          </Text>
        </View>

        {/* Title field */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Title *
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={`e.g. ${type === 'flight' ? 'LHR to NRT BA005' : type === 'hotel' ? 'Hilton Tokyo' : config.label + ' booking'}`}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Start date */}
        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {type === 'hotel' ? 'Check-in *' : type === 'restaurant' ? 'Date *' : 'Start Date *'}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          {type !== 'restaurant' && (
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {type === 'hotel' ? 'Check-out' : 'End Date'}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          )}
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="e.g. Tokyo, Japan"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Type-specific fields */}
        {config.fields.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {field.label}{field.required ? ' *' : ''}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              value={typeDetails[field.key] || ''}
              onChangeText={(v) => updateDetail(field.key, v)}
              keyboardType={field.keyboardType || 'default'}
            />
          </View>
        ))}

        {/* Extras toggle */}
        <TouchableOpacity
          onPress={() => setShowExtras(!showExtras)}
          style={styles.extrasToggle}
        >
          <Text style={[styles.extrasToggleText, { color: typeColor }]}>
            {showExtras ? 'Hide extras' : 'More details'}
          </Text>
          {showExtras ? (
            <ChevronUp color={typeColor} size={16} />
          ) : (
            <ChevronDown color={typeColor} size={16} />
          )}
        </TouchableOpacity>

        {showExtras && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Confirmation Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="e.g. ABC123"
                placeholderTextColor={colors.textMuted}
                value={confirmationNumber}
                onChangeText={setConfirmationNumber}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Cost</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="e.g. 150"
                  placeholderTextColor={colors.textMuted}
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Currency</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="GBP"
                  placeholderTextColor={colors.textMuted}
                  value={currency}
                  onChangeText={setCurrency}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
                placeholder="Any extra notes..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? typeColor : colors.textMuted },
            canSubmit && Shadows.glow(typeColor, 0.3),
          ]}
        >
          <Text style={styles.submitText}>Save Booking</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  extrasToggleText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: Radius.sm,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingForm.tsx
git commit -m "feat: add booking form component"
```

---

### Task 7: Create the Add Booking bottom sheet

**Files:**
- Create: `components/booking/AddBookingSheet.tsx`

- [ ] **Step 1: Create the bottom sheet that combines type picker and form**

Create `components/booking/AddBookingSheet.tsx`:

```tsx
import React, { useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { type BookingType } from '@/constants/bookings';
import { findMatchingTrip } from '@/utils/tripMatcher';
import BookingTypePicker from './BookingTypePicker';
import BookingForm, { type BookingFormData } from './BookingForm';

export interface AddBookingSheetRef {
  open: (prelinkedTripId?: string) => void;
  close: () => void;
}

interface AddBookingSheetProps {
  onBookingCreated?: () => void;
}

const AddBookingSheet = forwardRef<AddBookingSheetRef, AddBookingSheetProps>(
  ({ onBookingCreated }, ref) => {
    const { colors } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [step, setStep] = useState<'type' | 'form'>('type');
    const [selectedType, setSelectedType] = useState<BookingType | null>(null);
    const [prelinkedTripId, setPrelinkedTripId] = useState<string | undefined>();

    const createBooking = useMutation(api.bookings.createBooking);
    const linkBooking = useMutation(api.bookings.linkBookingToTrip);
    const trips = useQuery(api.trips.listTrips);

    useImperativeHandle(ref, () => ({
      open: (tripId?: string) => {
        setStep('type');
        setSelectedType(null);
        setPrelinkedTripId(tripId);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    const handleTypeSelect = useCallback((type: BookingType) => {
      setSelectedType(type);
      setStep('form');
    }, []);

    const handleBack = useCallback(() => {
      setStep('type');
      setSelectedType(null);
    }, []);

    const handleSubmit = useCallback(
      async (data: BookingFormData) => {
        if (!selectedType) return;

        // Build type-specific details JSON
        const detailsKey = `${selectedType === 'car_rental' ? 'car' : selectedType}Details` as const;
        const typeDetailsJson =
          Object.keys(data.typeDetails).length > 0
            ? JSON.stringify(data.typeDetails)
            : undefined;

        const bookingId = await createBooking({
          type: selectedType,
          source: 'manual' as const,
          provider: 'Manual',
          status: 'upcoming' as const,
          title: data.title,
          startDate: data.startDate,
          endDate: data.endDate || undefined,
          location: data.location || undefined,
          countryCode: data.countryCode || undefined,
          confirmationNumber: data.confirmationNumber || undefined,
          cost: data.cost ? parseFloat(data.cost) : undefined,
          currency: data.currency || undefined,
          notes: data.notes || undefined,
          [detailsKey]: typeDetailsJson,
          tripId: prelinkedTripId ? (prelinkedTripId as any) : undefined,
          autoMatched: !!prelinkedTripId,
        });

        // Auto-match to trip if not pre-linked
        if (!prelinkedTripId && trips && trips.length > 0) {
          const match = findMatchingTrip(
            data.countryCode || undefined,
            data.startDate,
            data.endDate || undefined,
            trips as any
          );
          if (match && match.confidence === 'high') {
            await linkBooking({
              id: bookingId,
              tripId: match.tripId as any,
              autoMatched: true,
            });
          }
        }

        bottomSheetRef.current?.dismiss();
        onBookingCreated?.();
      },
      [selectedType, createBooking, linkBooking, trips, prelinkedTripId, onBookingCreated]
    );

    // Find default trip data for form pre-fill
    const linkedTrip = prelinkedTripId
      ? trips?.find((t) => t._id === prelinkedTripId)
      : undefined;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={step === 'type' ? ['55%'] : ['92%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onDismiss={() => {
          setStep('type');
          setSelectedType(null);
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'type' && (
            <BookingTypePicker onSelect={handleTypeSelect} />
          )}
          {step === 'form' && selectedType && (
            <BookingForm
              type={selectedType}
              onBack={handleBack}
              onSubmit={handleSubmit}
              defaultCountryCode={linkedTrip?.countryCode}
              defaultStartDate={linkedTrip?.startDate}
              defaultEndDate={linkedTrip?.endDate}
            />
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

AddBookingSheet.displayName = 'AddBookingSheet';
export default AddBookingSheet;

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing['3xl'],
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/AddBookingSheet.tsx
git commit -m "feat: add AddBookingSheet bottom sheet component"
```

---

### Task 8: Create the booking card component

**Files:**
- Create: `components/booking/BookingCard.tsx`

- [ ] **Step 1: Create the booking card for list display**

Create `components/booking/BookingCard.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  type BookingType,
  type BookingStatus,
  BOOKING_TYPES,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';

interface BookingCardProps {
  id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider: string;
  status: BookingStatus;
  tripName?: string;
  autoMatched?: boolean;
  onPress: () => void;
  onLinkTrip?: () => void;
  onDismissMatch?: () => void;
}

export default function BookingCard({
  type,
  title,
  startDate,
  endDate,
  location,
  provider,
  status,
  tripName,
  autoMatched,
  onPress,
  onLinkTrip,
  onDismissMatch,
}: BookingCardProps) {
  const { colors, isDark } = useTheme();
  const config = BOOKING_TYPES[type];
  const typeColor = getBookingColor(type, isDark);
  const Icon = config.icon;

  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: isCancelled ? 0.5 : 1,
        },
        Shadows.subtle,
      ]}
    >
      <View style={styles.row}>
        {/* Type icon */}
        <View style={[styles.iconCircle, { backgroundColor: typeColor + '18' }]}>
          <Icon color={typeColor} size={18} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground },
              isCompleted && styles.titleCompleted,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatBookingDates(startDate, endDate)}
            {location ? ` \u00B7 ${location}` : ''}
          </Text>
        </View>

        {/* Provider badge */}
        <View style={[styles.providerBadge, { backgroundColor: typeColor + '18' }]}>
          <Text style={[styles.providerText, { color: typeColor }]}>
            {provider}
          </Text>
        </View>
      </View>

      {/* Trip link or match suggestion */}
      {tripName && (
        <View style={[styles.tripChip, { backgroundColor: colors.primary + '15' }]}>
          <Link2 color={colors.primary} size={12} />
          <Text style={[styles.tripChipText, { color: colors.primary }]}>
            {tripName}
          </Text>
          {autoMatched && (
            <Text style={[styles.autoLabel, { color: colors.textMuted }]}>
              auto
            </Text>
          )}
        </View>
      )}

      {!tripName && onLinkTrip && (
        <TouchableOpacity
          onPress={onLinkTrip}
          style={[styles.linkPrompt, { borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Link2 color={colors.textMuted} size={12} />
          <Text style={[styles.linkPromptText, { color: colors.textMuted }]}>
            Link to a trip
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  providerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  providerText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
    marginLeft: 46, // align with content after icon
  },
  tripChipText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
  },
  autoLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  linkPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    marginLeft: 46,
    paddingVertical: 2,
  },
  linkPromptText: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingCard.tsx
git commit -m "feat: add BookingCard component"
```

---

### Task 9: Create the booking detail bottom sheet

**Files:**
- Create: `components/booking/BookingDetailSheet.tsx`

- [ ] **Step 1: Create the booking detail sheet**

Create `components/booking/BookingDetailSheet.tsx`:

```tsx
import React, { useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Copy, Trash2, Unlink, Edit3 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  BOOKING_TYPES,
  type BookingType,
  type BookingStatus,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';

export interface BookingDetailSheetRef {
  open: (booking: BookingDetailData) => void;
  close: () => void;
}

export interface BookingDetailData {
  id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider: string;
  status: BookingStatus;
  confirmationNumber?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  tripId?: string;
  tripName?: string;
  typeDetails?: Record<string, string>;
}

interface BookingDetailSheetProps {
  onDelete?: () => void;
  onUnlink?: () => void;
}

const BookingDetailSheet = forwardRef<BookingDetailSheetRef, BookingDetailSheetProps>(
  ({ onDelete, onUnlink }, ref) => {
    const { colors, isDark } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [booking, setBooking] = useState<BookingDetailData | null>(null);

    const deleteBooking = useMutation(api.bookings.deleteBooking);
    const unlinkBooking = useMutation(api.bookings.unlinkBookingFromTrip);

    useImperativeHandle(ref, () => ({
      open: (data: BookingDetailData) => {
        setBooking(data);
        bottomSheetRef.current?.present();
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    const handleCopyConfirmation = useCallback(async () => {
      if (booking?.confirmationNumber) {
        await Clipboard.setStringAsync(booking.confirmationNumber);
      }
    }, [booking]);

    const handleDelete = useCallback(() => {
      if (!booking) return;
      Alert.alert(
        'Delete Booking',
        `Delete "${booking.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteBooking({ id: booking.id as any });
              bottomSheetRef.current?.dismiss();
              onDelete?.();
            },
          },
        ]
      );
    }, [booking, deleteBooking, onDelete]);

    const handleUnlink = useCallback(async () => {
      if (!booking) return;
      await unlinkBooking({ id: booking.id as any });
      bottomSheetRef.current?.dismiss();
      onUnlink?.();
    }, [booking, unlinkBooking, onUnlink]);

    if (!booking) return null;

    const config = BOOKING_TYPES[booking.type];
    const typeColor = getBookingColor(booking.type, isDark);
    const Icon = config.icon;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['65%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: typeColor + '18' }]}>
              <Icon color={typeColor} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {booking.title}
              </Text>
              <Text style={[styles.dates, { color: colors.textSecondary }]}>
                {formatBookingDates(booking.startDate, booking.endDate)}
                {booking.location ? ` \u00B7 ${booking.location}` : ''}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: typeColor + '18' }]}>
              <Text style={[styles.statusText, { color: typeColor }]}>
                {booking.status}
              </Text>
            </View>
          </View>

          {/* Key info */}
          <View style={[styles.infoSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {booking.provider !== 'Manual' && (
              <InfoRow label="Provider" value={booking.provider} colors={colors} />
            )}
            {booking.cost !== undefined && (
              <InfoRow
                label="Cost"
                value={`${booking.currency || 'GBP'} ${booking.cost.toFixed(2)}`}
                colors={colors}
              />
            )}
            {booking.confirmationNumber && (
              <View style={styles.confirmRow}>
                <InfoRow label="Confirmation" value={booking.confirmationNumber} colors={colors} />
                <TouchableOpacity
                  onPress={handleCopyConfirmation}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Copy color={colors.textMuted} size={14} />
                </TouchableOpacity>
              </View>
            )}
            {/* Type-specific details */}
            {booking.typeDetails &&
              Object.entries(booking.typeDetails).map(([key, value]) => {
                if (!value) return null;
                const field = config.fields.find((f) => f.key === key);
                return (
                  <InfoRow
                    key={key}
                    label={field?.label || key}
                    value={value}
                    colors={colors}
                  />
                );
              })}
          </View>

          {/* Notes */}
          {booking.notes && (
            <View style={[styles.notesBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.notesLabel, { color: colors.textMuted }]}>Notes</Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {booking.notes}
              </Text>
            </View>
          )}

          {/* Trip link */}
          {booking.tripName && (
            <View style={[styles.tripLink, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.tripLinkLabel, { color: colors.textSecondary }]}>
                Linked to
              </Text>
              <Text style={[styles.tripLinkName, { color: colors.primary }]}>
                {booking.tripName}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {booking.tripId && (
              <TouchableOpacity
                onPress={handleUnlink}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Unlink color={colors.textMuted} size={16} />
                <Text style={[styles.actionText, { color: colors.textMuted }]}>
                  Unlink
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleDelete}
              style={[styles.actionBtn, { borderColor: colors.danger + '40' }]}
            >
              <Trash2 color={colors.danger} size={16} />
              <Text style={[styles.actionText, { color: colors.danger }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

BookingDetailSheet.displayName = 'BookingDetailSheet';
export default BookingDetailSheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
  },
  dates: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoSection: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  notesLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  notesText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  tripLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.lg,
  },
  tripLinkLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
  },
  tripLinkName: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingDetailSheet.tsx
git commit -m "feat: add BookingDetailSheet component"
```

---

### Task 10: Create the bookings list view

**Files:**
- Create: `components/booking/BookingsListView.tsx`

- [ ] **Step 1: Create the bookings list that appears in the Trips tab**

Create `components/booking/BookingsListView.tsx`:

```tsx
import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import BookingCard from './BookingCard';
import AddBookingSheet, { type AddBookingSheetRef } from './AddBookingSheet';
import BookingDetailSheet, {
  type BookingDetailSheetRef,
  type BookingDetailData,
} from './BookingDetailSheet';
import { BOOKING_TYPES } from '@/constants/bookings';

interface BookingsListViewProps {
  bottomInset: number;
}

export default function BookingsListView({ bottomInset }: BookingsListViewProps) {
  const { colors, isDark } = useTheme();
  const addSheetRef = useRef<AddBookingSheetRef>(null);
  const detailSheetRef = useRef<BookingDetailSheetRef>(null);

  const bookings = useQuery(api.bookings.listBookings);
  const trips = useQuery(api.trips.listTrips);

  // Separate unassigned and assigned bookings
  const { unassigned, upcoming } = useMemo(() => {
    if (!bookings) return { unassigned: [], upcoming: [] };
    const unassigned = bookings.filter((b) => !b.tripId);
    const upcoming = bookings
      .filter((b) => b.tripId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return { unassigned, upcoming };
  }, [bookings]);

  const getTripName = useCallback(
    (tripId: string) => {
      if (!trips) return undefined;
      const trip = trips.find((t) => t._id === tripId);
      return trip?.isMultiCountry ? trip.routeTitle : trip?.countryName;
    },
    [trips]
  );

  const handleOpenDetail = useCallback(
    (booking: any) => {
      // Parse type-specific details
      const detailsKey = `${booking.type === 'car_rental' ? 'car' : booking.type}Details`;
      let typeDetails: Record<string, string> = {};
      if (booking[detailsKey]) {
        try {
          typeDetails = JSON.parse(booking[detailsKey]);
        } catch {}
      }

      const data: BookingDetailData = {
        id: booking._id,
        type: booking.type,
        title: booking.title,
        startDate: booking.startDate,
        endDate: booking.endDate,
        location: booking.location,
        provider: booking.provider,
        status: booking.status,
        confirmationNumber: booking.confirmationNumber,
        cost: booking.cost,
        currency: booking.currency,
        notes: booking.notes,
        tripId: booking.tripId,
        tripName: booking.tripId ? getTripName(booking.tripId) : undefined,
        typeDetails,
      };
      detailSheetRef.current?.open(data);
    },
    [getTripName]
  );

  // Loading state
  if (bookings === undefined) {
    return (
      <View style={styles.loadingContainer}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.skeleton,
              { backgroundColor: colors.shimmer, borderRadius: Radius.md },
            ]}
          />
        ))}
      </View>
    );
  }

  // Empty state
  if (bookings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyCard, { backgroundColor: colors.primary }, Shadows.card]}>
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyBody}>
            Add your flights, hotels, and other reservations to keep everything in one place.
          </Text>
          <TouchableOpacity
            onPress={() => addSheetRef.current?.open()}
            style={styles.emptyBtn}
          >
            <Plus color="#FFFFFF" size={16} />
            <Text style={styles.emptyBtnText}>Add Booking</Text>
          </TouchableOpacity>
        </View>
        <AddBookingSheet ref={addSheetRef} />
      </View>
    );
  }

  // Build sections
  const sections: { title: string; data: any[] }[] = [];
  if (unassigned.length > 0) {
    sections.push({ title: `Unassigned (${unassigned.length})`, data: unassigned });
  }
  if (upcoming.length > 0) {
    sections.push({ title: 'Linked Bookings', data: upcoming });
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={[...unassigned, ...upcoming]}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: bottomInset + 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          unassigned.length > 0 ? (
            <View style={[styles.inboxBanner, { backgroundColor: colors.warning + '15' }]}>
              <Text style={[styles.inboxText, { color: colors.warning }]}>
                {unassigned.length} unassigned booking{unassigned.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <BookingCard
            id={item._id}
            type={item.type}
            title={item.title}
            startDate={item.startDate}
            endDate={item.endDate}
            location={item.location}
            provider={item.provider}
            status={item.status}
            tripName={item.tripId ? getTripName(item.tripId) : undefined}
            autoMatched={item.autoMatched}
            onPress={() => handleOpenDetail(item)}
            onLinkTrip={!item.tripId ? () => {} : undefined}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => addSheetRef.current?.open()}
        style={[
          styles.fab,
          { backgroundColor: colors.accent, bottom: bottomInset + 80 },
          Shadows.glow(colors.accent, 0.4),
        ]}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>

      <AddBookingSheet ref={addSheetRef} />
      <BookingDetailSheet ref={detailSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    gap: 12,
    paddingTop: Spacing.md,
  },
  skeleton: {
    height: 72,
    opacity: 0.6,
  },
  emptyContainer: {
    paddingTop: Spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    borderRadius: 20,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
  },
  emptyBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  emptyBtnText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  inboxBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  inboxText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  fab: {
    position: 'absolute',
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/booking/BookingsListView.tsx
git commit -m "feat: add BookingsListView with FAB and empty state"
```

---

### Task 11: Update Trips screen with segmented control

**Files:**
- Modify: `app/(tabs)/trips.tsx`

- [ ] **Step 1: Add the segmented control and bookings view to the Trips screen**

At the top of `app/(tabs)/trips.tsx`, add the import:

```typescript
import BookingsListView from '@/components/booking/BookingsListView';
```

Add a new state variable alongside the existing `sortBy` state:

```typescript
const [activeTab, setActiveTab] = useState<'trips' | 'bookings'>('trips');
```

- [ ] **Step 2: Add the segmented control component**

Insert the segmented control right after the `headerRow` View and before the sort pills, inside the main list return block (after line 306 in the current file). The segmented control renders in all states (loading, empty, and main list):

Replace the entire `headerRow` View in the main list section with:

```tsx
<View style={styles.headerRow}>
  <View>
    <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>
    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
      {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
    </Text>
  </View>
</View>

{/* Segmented control */}
<View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.border }]}>
  <TouchableOpacity
    onPress={() => setActiveTab('trips')}
    style={[
      styles.segment,
      activeTab === 'trips' && { backgroundColor: colors.accent },
    ]}
  >
    <Text
      style={[
        styles.segmentText,
        { color: activeTab === 'trips' ? '#FFFFFF' : colors.textMuted },
      ]}
    >
      My Trips
    </Text>
  </TouchableOpacity>
  <TouchableOpacity
    onPress={() => setActiveTab('bookings')}
    style={[
      styles.segment,
      activeTab === 'bookings' && { backgroundColor: colors.accent },
    ]}
  >
    <Text
      style={[
        styles.segmentText,
        { color: activeTab === 'bookings' ? '#FFFFFF' : colors.textMuted },
      ]}
    >
      Bookings
    </Text>
  </TouchableOpacity>
</View>
```

- [ ] **Step 3: Conditionally render trips or bookings**

Wrap the existing sort pills + FlatList in a condition, and add the bookings view:

```tsx
{activeTab === 'trips' ? (
  <>
    {/* Existing sort pills */}
    <View style={styles.sortRow}>
      {/* ... existing sort pills code ... */}
    </View>
    {/* Existing FlatList */}
    <FlatList
      {/* ... existing FlatList code ... */}
    />
  </>
) : (
  <BookingsListView bottomInset={insets.bottom} />
)}
```

- [ ] **Step 4: Add segmented control styles**

Add these styles to the existing `StyleSheet.create`:

```typescript
segmentedControl: {
  flexDirection: 'row',
  borderRadius: Radius.sm,
  borderWidth: 1,
  padding: 3,
  marginBottom: Spacing.md,
},
segment: {
  flex: 1,
  paddingVertical: 8,
  alignItems: 'center',
  borderRadius: Radius.xs,
},
segmentText: {
  fontFamily: FontFamily.condensedSemibold,
  fontSize: FontSize.sm,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
},
```

- [ ] **Step 5: Add the segmented control to empty and loading states too**

In both the loading and empty return blocks, add the same segmented control after the heading, and wrap the loading/empty content in a `{activeTab === 'trips' ? (...) : (<BookingsListView bottomInset={insets.bottom} />)}` conditional.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/trips.tsx
git commit -m "feat: add bookings segmented control to Trips screen"
```

---

### Task 12: Add bookings timeline to trip detail screen

**Files:**
- Modify: `app/trip/[id].tsx`
- Create: `components/booking/TripBookingsTimeline.tsx`

- [ ] **Step 1: Create the trip bookings timeline component**

Create `components/booking/TripBookingsTimeline.tsx`:

```tsx
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Calendar } from 'lucide-react-native';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  BOOKING_TYPES,
  type BookingType,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';
import AddBookingSheet, { type AddBookingSheetRef } from './AddBookingSheet';

interface TripBookingsTimelineProps {
  tripId: string;
  onBookingPress: (booking: any) => void;
}

export default function TripBookingsTimeline({ tripId, onBookingPress }: TripBookingsTimelineProps) {
  const { colors, isDark } = useTheme();
  const addSheetRef = useRef<AddBookingSheetRef>(null);
  const bookings = useQuery(api.bookings.listBookingsByTrip, {
    tripId: tripId as any,
  });

  if (bookings === undefined) return null;

  // Sort by startDate
  const sorted = [...(bookings || [])].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Calendar color={colors.textSecondary} size={16} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Bookings
        </Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {sorted.length}
        </Text>
      </View>

      {sorted.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No bookings yet — add your flights, hotels, and more.
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {sorted.map((booking, index) => {
            const config = BOOKING_TYPES[booking.type as BookingType];
            const typeColor = getBookingColor(booking.type as BookingType, isDark);
            const Icon = config.icon;
            const isLast = index === sorted.length - 1;

            return (
              <TouchableOpacity
                key={booking._id}
                activeOpacity={0.7}
                onPress={() => onBookingPress(booking)}
                style={styles.timelineItem}
              >
                {/* Timeline line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, { backgroundColor: typeColor }]} />
                  {!isLast && (
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
                  )}
                </View>

                {/* Card */}
                <View
                  style={[
                    styles.timelineCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    Shadows.subtle,
                  ]}
                >
                  <View style={styles.cardRow}>
                    <Icon color={typeColor} size={16} />
                    <Text
                      style={[styles.cardTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {booking.title}
                    </Text>
                  </View>
                  <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                    {formatBookingDates(booking.startDate, booking.endDate)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Add booking button */}
      <TouchableOpacity
        onPress={() => addSheetRef.current?.open(tripId)}
        style={[styles.addBtn, { borderColor: colors.border }]}
      >
        <Plus color={colors.textMuted} size={14} />
        <Text style={[styles.addBtnText, { color: colors.textMuted }]}>
          Add Booking
        </Text>
      </TouchableOpacity>

      <AddBookingSheet ref={addSheetRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    flex: 1,
  },
  count: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
  },
  emptyCard: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  timelineCard: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    flex: 1,
  },
  cardDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
    marginLeft: 22, // align with title after icon
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  addBtnText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
  },
});
```

- [ ] **Step 2: Add the timeline to the trip detail screen**

In `app/trip/[id].tsx`, add the import at the top:

```typescript
import TripBookingsTimeline from '@/components/booking/TripBookingsTimeline';
```

Then add the `<TripBookingsTimeline>` component inside the Overview tab content (or at the top of the Logistics tab, whichever feels more natural — the Overview tab is recommended since bookings are the first thing a user wants to see for their trip). Place it after the highlights section and before the seasonal guide:

```tsx
<TripBookingsTimeline
  tripId={trip._id}
  onBookingPress={(booking) => {
    // Open booking detail sheet — can be added in a follow-up
  }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add components/booking/TripBookingsTimeline.tsx app/trip/[id].tsx
git commit -m "feat: add bookings timeline to trip detail screen"
```

---

### Task 13: Verify everything works end-to-end

**Files:** None (testing only)

- [ ] **Step 1: Start the Convex dev server**

Run: `npx convex dev`

Expected: Schema deploys successfully with the new `bookings` table.

- [ ] **Step 2: Start the Expo dev server**

Run: `npx expo start`

Expected: App compiles without TypeScript errors.

- [ ] **Step 3: Test the segmented control on Trips screen**

Open the app → navigate to Trips tab → verify the "My Trips" | "Bookings" segmented control appears. Toggle between them. The "My Trips" view should work exactly as before. The "Bookings" view should show the empty state.

- [ ] **Step 4: Test manual booking creation**

On the Bookings view → tap the FAB (or "Add Booking" button in empty state) → verify the type picker bottom sheet appears → select "Flight" → verify the form appears → fill in title + start date + a few fields → tap "Save Booking" → verify it appears in the list.

- [ ] **Step 5: Test booking detail sheet**

Tap the created booking → verify the detail sheet opens with all the info. Test the delete action.

- [ ] **Step 6: Test trip-linked booking**

Navigate to a trip detail → verify the "Bookings" timeline section appears → tap "Add Booking" → create a booking → verify it appears in the timeline and is auto-linked to the trip.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```

(Only if fixes were needed.)

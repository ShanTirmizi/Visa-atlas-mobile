# Booking Integration Design

> Turn Visa Atlas into the single source of truth for every travel booking — flights, hotels, experiences, car rentals, insurance, and restaurants.

## Overview

Users book travel across many platforms (Airbnb, Booking.com, Skyscanner, airline apps, etc.). This feature brings all those bookings into Visa Atlas, linked to their trip plans. Three sync layers (calendar sync, manual entry, future direct APIs/email parsing) ensure coverage regardless of platform support.

## Architecture: Approach C — Calendar + Manual First, APIs Later

**Why this approach:**
- Calendar sync is fastest to build and covers many platforms (Booking.com, Google Flights, airlines all auto-add calendar events)
- Manual entry covers everything else with zero dependency on third-party approvals
- Privacy-friendly: calendar read-only is a lighter ask than email access
- Direct APIs and email parsing layer on in future phases without architectural changes

## Data Model

New `bookings` table in Convex:

```
bookings
├── id (auto)
├── userId
├── type: "flight" | "hotel" | "experience" | "car_rental" | "insurance" | "restaurant"
├── source: "calendar" | "manual" | "api"
├── provider: string (e.g. "Booking.com", "Airbnb", "Skyscanner", "Manual")
├── status: "upcoming" | "active" | "completed" | "cancelled"
│
├── Core fields (all types):
│   ├── title: string ("Hilton Tokyo", "LHR → NRT BA005")
│   ├── startDate: string (ISO)
│   ├── endDate: string (ISO)
│   ├── location: string ("Tokyo, Japan")
│   ├── countryCode: string ("JP")
│   ├── confirmationNumber?: string
│   ├── cost?: number
│   ├── currency?: string
│   ├── notes?: string
│
├── Type-specific (stored as JSON):
│   ├── flightDetails?: { airline, flightNumber, departure, arrival, class, stops }
│   ├── hotelDetails?: { hotelName, address, checkIn, checkOut, roomType, guests }
│   ├── experienceDetails?: { activityName, duration, meetingPoint, groupSize }
│   ├── carDetails?: { company, pickupLocation, dropoffLocation, carType }
│   ├── insuranceDetails?: { provider, policyNumber, coverage, travelers }
│   ├── restaurantDetails?: { name, cuisine, partySize, time }
│
├── Trip linking:
│   ├── tripId?: Id<"trips"> (linked trip, null = unassigned)
│   ├── autoMatched: boolean (was this suggested by the app?)
│
├── Calendar sync:
│   ├── calendarEventId?: string (for dedup on re-sync)
│   ├── calendarSource?: "google" | "apple"
│
└── timestamps: createdAt, updatedAt
```

One unified table with a `type` discriminator and optional type-specific JSON blobs. Keeps queries simple while allowing rich data per type.

## Calendar Sync Engine

### Flow

1. **Connect** — User taps "Connect Calendar" → OAuth for Google Calendar or Expo Calendar API for on-device Apple Calendar access
2. **Scan** — Fetch events from last 30 days + next 12 months
3. **Classify** — Each event runs through a classification pipeline:
   - **Known organizers** — Match organizer email against curated list (`@booking.com`, `@airbnb.com`, `@skyscanner.net`, airline domains). High confidence → auto-classify type.
   - **Location signals** — Event location in a different country than user's home → likely travel-related
   - **Keyword matching** — Title/description contains: "check-in", "flight", "booking confirmation", "reservation", "pick-up", "rental", "policy number" etc.
   - **Confidence score** — Each signal adds to a score. Above threshold → auto-import. Below but non-zero → "Review these" list for user confirmation.
4. **Categorize** — Map classified events to booking types via type-specific keywords:
   - Flight: airline names, flight numbers, "departing", "arriving"
   - Hotel: "check-in", "check-out", "room", hotel chain names
   - Experience: "tour", "experience", "activity", "tickets"
   - Car rental: "pick-up", "rental", car company names
   - Insurance: "policy", "coverage", insurance provider names
   - Restaurant: "reservation", "table for", restaurant names
5. **Deduplicate** — Store `calendarEventId` to prevent re-importing on subsequent syncs
6. **Match to trips** — Compare booking dates + country code against existing trips, suggest links

### Sync Triggers

- User taps "Sync now" button
- App opening (if last sync > 24 hours ago)
- Pull-to-refresh on bookings screen

### Privacy

- Apple Calendar parsing happens **on-device** (Expo Calendar API, no server round-trip)
- Google Calendar uses OAuth with read-only scope (`calendar.readonly`)
- User can disconnect at any time; deletes sync data but keeps manually-confirmed bookings

## Manual Entry Flow

### Entry Points

- "Add Booking" FAB on the bookings screen
- "Add Booking" action within trip detail view (pre-links to that trip)
- From unassigned inbox nudge ("Not what you booked? Add it manually")

### Flow

1. **Pick type** — 6 icon tiles in a grid: Flight, Hotel, Experience, Car Rental, Insurance, Restaurant. One tap.
2. **Quick form** — Type-specific with only essentials:
   - **Flight**: Airline, flight number, departure date, from → to
   - **Hotel**: Name, city/country, check-in, check-out
   - **Experience**: Activity name, date, location
   - **Car Rental**: Company, pickup date/location, dropoff date/location
   - **Insurance**: Provider, start/end date, policy number
   - **Restaurant**: Name, date, time, city
3. **Optional extras** — Expandable "More details" section: cost, confirmation number, notes, guests/party size
4. **Link to trip** — Auto-suggests matching trip. User can confirm, pick different, or skip.
5. **Save** — Booking created in Convex, appears immediately in trip timeline and bookings inbox.

### Design Principles

- Under 30 seconds to add a basic booking
- Smart defaults: country auto-fills from linked trip, dates default to trip dates
- No required fields beyond type + title + one date
- User can edit/enrich later

## UI & Screens

### 1. Bookings View (inside Trips tab)

No new tab — bookings live inside the existing Trips tab as a toggle:

- Segmented control at top: **My Trips** | **Bookings**
- Bookings view shows:
  - **Unassigned inbox** at top (with count badge) — cards with nudge to create/link trip
  - **Upcoming bookings** grouped by date — each card: type icon, title, dates, provider badge, linked trip chip
  - Pull-to-refresh triggers calendar sync

### 2. Trip Detail — Bookings Timeline

New section within existing trip detail screen:

- Chronological timeline with date markers on the left
- Cards for each booking: type icon, title, time, provider
- Tap to expand details (confirmation number, cost, notes)
- "Add booking" button at bottom of timeline
- Empty state: "No bookings yet — sync your calendar or add manually"

### 3. Booking Detail Sheet

Bottom sheet (consistent with existing `@gorhom/bottom-sheet` pattern):

- Header: type icon + title + status badge
- Key info section (type-specific: flight number, check-in time, etc.)
- Linked trip chip (tap to navigate, or "Link to trip" if unassigned)
- Actions: Edit, Delete, Unlink from trip
- Confirmation number with copy button
- Notes field

## Trip Matching Logic

### Algorithm

1. **Extract country** — Derive `countryCode` from booking location/destination
2. **Date overlap** — Find trips where booking dates overlap trip's `startDate` → `endDate`
3. **Score matches:**
   - Exact country + date overlap → **high confidence** (auto-suggest)
   - Same region (booking in Paris, trip to France) → **medium confidence** ("Is this part of your France trip?")
   - Date overlap, different country → **low confidence** (only suggest for multi-country trips)
   - No overlap → **unassigned inbox**

### User-Facing Behavior

- **High confidence**: Card shows "Linked to Tokyo Trip" with "Wrong? Change" link
- **Medium confidence**: Card shows "Part of your France trip?" with Accept / Dismiss
- **Low/no match**: Sits in unassigned inbox with "Link to trip" and "Create new trip"

### Edge Cases

- **Multi-country trips** — Match against each leg's country and dates (uses existing `isMultiCountry` + `legs`)
- **Multiple trips in same country** — Dates are tiebreaker; if ambiguous, ask user
- **Booking outside trip dates** — 1-day buffer on either side (common for flights departing day before)

### Unassigned Booking Behavior

Bookings that don't match any trip go to the unassigned inbox with a nudge: "Looks like you're going to Barcelona! Create a trip?" Options:
- Create new trip (pre-fills destination + dates from booking)
- Link to existing trip
- Dismiss (stays in inbox)

## Phased Rollout

### Phase 1 — Manual Entry + Bookings UI (foundation)
- Bookings data model in Convex (schema, queries, mutations)
- Manual entry flow (type picker → quick form → save)
- Bookings toggle on Trips screen
- Bookings timeline in Trip Detail
- Booking detail bottom sheet
- Trip auto-matching logic
- Unassigned inbox with nudges
- Edit/delete booking flows

**Independently shippable.** Users can track all bookings manually.

### Phase 2 — Calendar Sync
- Google Calendar OAuth integration
- Apple Calendar on-device sync (Expo Calendar API)
- Classification pipeline (known organizers, keywords, location signals)
- Confidence scoring + "Review these" list
- Dedup logic with `calendarEventId`
- Sync triggers (manual, on-open, pull-to-refresh)
- Connect/disconnect calendar in More tab settings
- Sync status indicator

### Phase 3 — Direct APIs (future)
- Booking.com affiliate API integration
- Skyscanner partner API
- Other partner APIs as agreements are secured
- Richer booking data (images, ratings, cancellation policies)

### Phase 4 — Email Parsing (future)
- Gmail/Outlook OAuth
- Schema.org extraction from confirmation emails
- Known sender domain filtering
- Same classification pipeline with email-specific signals

Each phase is independently valuable. Phase 1 alone makes Visa Atlas a better trip organizer. Phase 2 adds auto-import magic. Phases 3-4 reduce manual work as partnerships develop.

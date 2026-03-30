# Email Parsing Design (Phase 4a — Gmail)

> Auto-import travel bookings from Gmail by scanning for booking confirmation emails from known travel providers, extracting structured data via schema.org and fallback classification.

## Overview

Users receive booking confirmations via email. This feature connects their Gmail account via OAuth, scans for travel-related emails, extracts booking data (dates, hotel names, flight numbers, confirmation codes), and creates bookings in Visa Atlas — linked to their trip plans.

## Architecture: Approach B — Convex Actions + Vercel OAuth

- **OAuth flow** handled by Vercel API routes (`visa-atlas.vercel.app/api/auth/gmail` and `/callback`) — proper redirect handling, secure token exchange
- **Email scanning** runs as Convex actions — direct access to bookings table, no extra hop
- **Tokens** stored in Convex `emailAccounts` table
- **Trigger**: On-demand ("Scan Now") + auto-scan every 24h on app open

## Data Model

### New `emailAccounts` table in Convex:

```
emailAccounts
├── provider: "gmail" | "outlook"
├── email: string (user's email address)
├── accessToken: string
├── refreshToken: string
├── tokenExpiry: number (timestamp ms)
├── isConnected: boolean
├── lastScanTime: string | null (ISO date)
├── lastScanMessageId: string | null (for incremental scanning)
└── _creationTime (auto)
```

### Schema update to existing `bookings` table:

Add `"email"` to the source union:
```
bookings.source: "manual" | "calendar" | "api" | "email"
```

## OAuth Flow (Gmail)

1. Mobile app opens a web browser to `visa-atlas.vercel.app/api/auth/gmail`
2. Vercel endpoint redirects to Google OAuth consent screen with scope: `gmail.readonly`
3. User grants access → Google redirects to `visa-atlas.vercel.app/api/auth/gmail/callback`
4. Callback exchanges auth code for access + refresh tokens
5. Callback stores tokens in Convex via mutation (creates `emailAccounts` row)
6. Callback redirects to deep link `visaatlas://email-connected?provider=gmail`
7. Mobile app catches deep link, updates UI to show Gmail connected

Token refresh: When scanning, if accessToken expired (check tokenExpiry), use refreshToken to get a new one. Store the new tokens.

Disconnect: Delete the `emailAccounts` row. Imported bookings remain.

## Email Scanning Pipeline

When a scan is triggered (manual tap or auto 24h), a Convex action runs:

### Step 1: Fetch emails

Call Gmail API `GET /gmail/v1/users/me/messages` with query:
- `from:({known sender domains joined by OR})` to match known travel providers
- `newer_than:{days since last scan}d` to limit scope (default 90d for first scan)
- Paginate through results
- Fetch full message content for each match (RFC822 format or metadata+body)

### Step 2: Extract booking data

Two strategies, tried in order of priority:

**A. Schema.org extraction (high confidence):**
- Parse email HTML body for `<script type="application/ld+json">` blocks
- Look for known reservation types: `FlightReservation`, `LodgingReservation`, `FoodEstablishmentReservation`, `RentalCarReservation`, `EventReservation`
- Extract structured fields: reservationNumber, checkinTime, checkoutTime, departureAirport, arrivalAirport, hotelName, flightNumber, etc.
- Map to booking type and create with high confidence

**B. Known sender + classification (fallback):**
- If no schema.org found, use the same classification pipeline from Phase 2
- Sender email domain → match against KNOWN_ORGANIZERS
- Subject line + body snippet → keyword scoring
- Events above CONFIDENCE.AUTO_IMPORT → auto-import
- Events above CONFIDENCE.REVIEW → add to review list

### Step 3: Dedup

Before creating a booking, check if one already exists with:
- Same `confirmationNumber`, OR
- Same `title + startDate` combination

Skip duplicates.

### Step 4: Create bookings

Call `createBooking` mutation with:
- `source: 'email'`
- `provider`: extracted provider name (e.g. "Booking.com", "British Airways")
- All extracted details (title, dates, location, confirmationNumber, type-specific details)

### Step 5: Trip matching

Same `findMatchingTrip` logic — country code (if extractable from email) + date overlap.

### Step 6: Update scan state

Store `lastScanTime` and `lastScanMessageId` for incremental scanning next time.

## UI Integration

### More tab — Email Sync section

New menu item "Email Sync" in the More screen, alongside existing "Calendar Sync":
- When not connected: "Connect Gmail" button → opens OAuth in browser
- When connected: Shows email address, last scan time, "Scan Now" button, "Disconnect" button (with Alert confirmation)

### Bookings tab

- Pull-to-refresh triggers both calendar sync AND email sync
- Low-confidence email imports appear in the same review banner
- Email-sourced bookings show provider badge (e.g. "Gmail") on BookingCard

### No new screens — everything fits into existing UI surfaces.

## Scan Window

- First scan: Last 90 days
- Subsequent scans: Since last scan time (using `lastScanMessageId` or date filter)
- Known sender domains: Reuse the `KNOWN_ORGANIZERS` list from `constants/calendarProviders.ts`

## Security

- Gmail OAuth scope is `gmail.readonly` — cannot send, delete, or modify emails
- Tokens stored in Convex (server-side) — not on device
- Refresh tokens used server-side only
- User can disconnect at any time, which deletes all stored tokens

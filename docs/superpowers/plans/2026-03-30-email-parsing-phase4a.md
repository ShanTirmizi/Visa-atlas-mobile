# Gmail Email Parsing (Phase 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-import travel bookings from Gmail by scanning for confirmation emails from known travel providers, extracting data via schema.org and fallback classification, and creating bookings in Convex.

**Architecture:** OAuth handled by Vercel API routes (redirect + callback + token exchange). Email scanning runs as a Convex HTTP action that calls Gmail API, parses emails, and creates bookings directly. An EmailProvider context on the mobile side manages connection state and sync triggers. Reuses the existing classification pipeline from Phase 2.

**Tech Stack:** Google OAuth 2.0, Gmail API (REST), Convex HTTP actions + mutations, expo-linking (deep links), existing booking components from Phase 1-2.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/schema.ts` | **MODIFY** — Add `emailAccounts` table, add `"email"` to bookings source union |
| `convex/emailAccounts.ts` | **NEW** — Queries/mutations for email account CRUD and token management |
| `convex/emailSync.ts` | **NEW** — Convex HTTP action: Gmail API calls, email parsing, booking creation |
| `utils/schemaOrgParser.ts` | **NEW** — Parse schema.org JSON-LD from email HTML, map to booking types |
| `utils/emailClassifier.ts` | **NEW** — Classify emails using sender domain + subject/body (reuses Phase 2 constants) |
| `contexts/email-context.tsx` | **NEW** — EmailProvider: connection state, sync triggers, mirrors CalendarProvider |
| `app/_layout.tsx` | **MODIFY** — Add EmailProvider to provider stack |
| `app/(tabs)/more.tsx` | **MODIFY** — Add "Email Sync" menu item and section |
| `components/booking/BookingsListView.tsx` | **MODIFY** — Pull-to-refresh triggers email sync too |
| `constants/api.ts` | **MODIFY** — Add Gmail OAuth endpoints |

---

### Task 1: Update schema — add emailAccounts table and email source

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add "email" to bookings source union**

In `convex/schema.ts`, find the bookings table `source` field (around line 87) and add the `"email"` literal:

```typescript
    source: v.union(
      v.literal("manual"),
      v.literal("calendar"),
      v.literal("api"),
      v.literal("email")
    ),
```

- [ ] **Step 2: Add emailAccounts table**

Add after the `bookings` table definition (before the closing of `defineSchema`):

```typescript
  // Email account connections for booking import
  emailAccounts: defineTable({
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(), // timestamp ms
    isConnected: v.boolean(),
    lastScanTime: v.optional(v.string()), // ISO date
    lastScanMessageId: v.optional(v.string()), // for incremental scanning
  }).index("by_provider", ["provider"]),
```

- [ ] **Step 3: Update the bookings source validator in convex/bookings.ts**

In `convex/bookings.ts`, find `bookingSourceValidator` and add `"email"`:

```typescript
const bookingSourceValidator = v.union(
  v.literal("manual"),
  v.literal("calendar"),
  v.literal("api"),
  v.literal("email")
);
```

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/bookings.ts
git commit -m "feat: add emailAccounts table and email booking source"
```

---

### Task 2: Create emailAccounts queries and mutations

**Files:**
- Create: `convex/emailAccounts.ts`

- [ ] **Step 1: Create the file**

Create `convex/emailAccounts.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByProvider = query({
  args: { provider: v.union(v.literal("gmail"), v.literal("outlook")) },
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("emailAccounts")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .collect();
    return accounts[0] ?? null;
  },
});

export const listConnected = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("emailAccounts").collect();
    return all.filter((a) => a.isConnected);
  },
});

export const upsertAccount = mutation({
  args: {
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiry: args.tokenExpiry,
        isConnected: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailAccounts", {
      ...args,
      isConnected: true,
    });
  },
});

export const updateTokens = mutation({
  args: {
    id: v.id("emailAccounts"),
    accessToken: v.string(),
    tokenExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      accessToken: args.accessToken,
      tokenExpiry: args.tokenExpiry,
    });
  },
});

export const updateScanState = mutation({
  args: {
    id: v.id("emailAccounts"),
    lastScanTime: v.string(),
    lastScanMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const disconnect = mutation({
  args: { id: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Update Convex generated types**

Add `emailAccounts` import to `convex/_generated/api.d.ts`:

```typescript
import type * as bookings from "../bookings.js";
import type * as emailAccounts from "../emailAccounts.js";
import type * as trips from "../trips.js";
import type * as visaGuides from "../visaGuides.js";
```

And to the `ApiFromModules` block:

```typescript
declare const fullApi: ApiFromModules<{
  bookings: typeof bookings;
  emailAccounts: typeof emailAccounts;
  trips: typeof trips;
  visaGuides: typeof visaGuides;
}>;
```

- [ ] **Step 3: Commit**

```bash
git add convex/emailAccounts.ts convex/_generated/api.d.ts
git commit -m "feat: add emailAccounts queries and mutations"
```

---

### Task 3: Create schema.org email parser

**Files:**
- Create: `utils/schemaOrgParser.ts`

- [ ] **Step 1: Create the parser**

Create `utils/schemaOrgParser.ts`:

```typescript
import type { BookingType } from '@/constants/bookings';

export interface ParsedEmailBooking {
  type: BookingType;
  title: string;
  startDate: string;       // ISO date
  endDate?: string;
  location?: string;
  confirmationNumber?: string;
  provider: string;
  details: Record<string, string>; // type-specific details for JSON storage
}

// Map schema.org @type to our BookingType
const SCHEMA_TYPE_MAP: Record<string, BookingType> = {
  'FlightReservation': 'flight',
  'LodgingReservation': 'hotel',
  'FoodEstablishmentReservation': 'restaurant',
  'RentalCarReservation': 'car_rental',
  'EventReservation': 'experience',
  'BusReservation': 'flight', // treat bus like flight (transport)
  'TrainReservation': 'flight', // treat train like flight (transport)
};

/**
 * Extract schema.org JSON-LD from email HTML body.
 * Returns parsed booking data or null if no recognized reservation found.
 */
export function parseSchemaOrg(htmlBody: string, senderDomain: string): ParsedEmailBooking | null {
  // Find all JSON-LD script blocks
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonLdRegex.exec(htmlBody)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const result = parseReservation(item, senderDomain);
        if (result) return result;
      }
    } catch {
      // Malformed JSON-LD — skip this block
    }
  }

  return null;
}

function parseReservation(item: any, senderDomain: string): ParsedEmailBooking | null {
  const type = item['@type'];
  const bookingType = SCHEMA_TYPE_MAP[type];
  if (!bookingType) return null;

  const confirmationNumber =
    item.reservationNumber || item.confirmationNumber || undefined;

  const provider = extractProvider(item, senderDomain);

  switch (bookingType) {
    case 'flight':
      return parseFlight(item, confirmationNumber, provider);
    case 'hotel':
      return parseHotel(item, confirmationNumber, provider);
    case 'restaurant':
      return parseRestaurant(item, confirmationNumber, provider);
    case 'car_rental':
      return parseCarRental(item, confirmationNumber, provider);
    case 'experience':
      return parseExperience(item, confirmationNumber, provider);
    default:
      return null;
  }
}

function extractProvider(item: any, senderDomain: string): string {
  if (item.provider?.name) return item.provider.name;
  if (item.reservationFor?.provider?.name) return item.reservationFor.provider.name;
  // Fall back to sender domain, cleaned up
  const parts = senderDomain.replace('www.', '').split('.');
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

function toDateString(value: any): string {
  if (!value) return new Date().toISOString().split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}

function parseFlight(item: any, confirmationNumber: string | undefined, provider: string): ParsedEmailBooking {
  const leg = item.reservationFor || item;
  const departure = leg.departureAirport?.iataCode || leg.departureStation?.name || '';
  const arrival = leg.arrivalAirport?.iataCode || leg.arrivalStation?.name || '';
  const airline = leg.airline?.name || provider;
  const flightNumber = leg.flightNumber || '';

  return {
    type: 'flight',
    title: `${departure} → ${arrival}${flightNumber ? ` ${airline} ${flightNumber}` : ''}`.trim() || `Flight via ${provider}`,
    startDate: toDateString(leg.departureTime || item.checkinTime),
    endDate: toDateString(leg.arrivalTime),
    location: arrival,
    confirmationNumber,
    provider,
    details: {
      airline,
      flightNumber,
      departure,
      arrival,
    },
  };
}

function parseHotel(item: any, confirmationNumber: string | undefined, provider: string): ParsedEmailBooking {
  const hotel = item.reservationFor || {};
  const hotelName = hotel.name || `Hotel via ${provider}`;
  const address = hotel.address?.streetAddress || hotel.address?.name || '';

  return {
    type: 'hotel',
    title: hotelName,
    startDate: toDateString(item.checkinTime || item.checkinDate),
    endDate: toDateString(item.checkoutTime || item.checkoutDate),
    location: address || hotel.address?.addressLocality,
    confirmationNumber,
    provider,
    details: {
      hotelName,
      address,
      checkIn: item.checkinTime ? new Date(item.checkinTime).toTimeString().slice(0, 5) : '',
      checkOut: item.checkoutTime ? new Date(item.checkoutTime).toTimeString().slice(0, 5) : '',
    },
  };
}

function parseRestaurant(item: any, confirmationNumber: string | undefined, provider: string): ParsedEmailBooking {
  const restaurant = item.reservationFor || {};
  const name = restaurant.name || `Restaurant via ${provider}`;

  return {
    type: 'restaurant',
    title: name,
    startDate: toDateString(item.startTime || item.reservationFor?.startDate),
    location: restaurant.address?.streetAddress || restaurant.address?.addressLocality,
    confirmationNumber,
    provider,
    details: {
      name,
      partySize: String(item.partySize || ''),
      time: item.startTime ? new Date(item.startTime).toTimeString().slice(0, 5) : '',
    },
  };
}

function parseCarRental(item: any, confirmationNumber: string | undefined, provider: string): ParsedEmailBooking {
  const rental = item.reservationFor || {};
  const company = rental.provider?.name || provider;

  return {
    type: 'car_rental',
    title: `${company} rental`,
    startDate: toDateString(item.pickupTime || item.pickupDate),
    endDate: toDateString(item.dropoffTime || item.dropoffDate),
    location: item.pickupLocation?.name || item.pickupLocation?.address?.streetAddress,
    confirmationNumber,
    provider,
    details: {
      company,
      pickupLocation: item.pickupLocation?.name || '',
      dropoffLocation: item.dropoffLocation?.name || '',
      carType: rental.name || '',
    },
  };
}

function parseExperience(item: any, confirmationNumber: string | undefined, provider: string): ParsedEmailBooking {
  const event = item.reservationFor || {};
  const name = event.name || `Event via ${provider}`;

  return {
    type: 'experience',
    title: name,
    startDate: toDateString(event.startDate || item.startTime),
    endDate: event.endDate ? toDateString(event.endDate) : undefined,
    location: event.location?.name || event.location?.address?.streetAddress,
    confirmationNumber,
    provider,
    details: {
      activityName: name,
      duration: '',
      meetingPoint: event.location?.name || '',
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/schemaOrgParser.ts
git commit -m "feat: add schema.org email parser for booking extraction"
```

---

### Task 4: Create email classifier (fallback for non-schema.org emails)

**Files:**
- Create: `utils/emailClassifier.ts`

- [ ] **Step 1: Create the classifier**

Create `utils/emailClassifier.ts`:

```typescript
import { KNOWN_ORGANIZERS, CONFIDENCE } from '@/constants/calendarProviders';
import { classifyEvent, type ClassifiedEvent, type CalendarEvent } from './calendarClassifier';

/**
 * Classify an email as a potential travel booking.
 * Reuses the calendar classifier by mapping email fields to CalendarEvent shape.
 *
 * @param subject - Email subject line
 * @param bodySnippet - First ~500 chars of email body text
 * @param senderEmail - Sender's email address
 * @param date - Email date (ISO string)
 */
export function classifyEmail(
  subject: string,
  bodySnippet: string,
  senderEmail: string,
  date: string
): ClassifiedEvent | null {
  // Map email to CalendarEvent shape for reuse of classifier
  const event: CalendarEvent = {
    id: `email-${date}-${subject.slice(0, 30)}`,
    title: subject,
    notes: bodySnippet,
    organizer: senderEmail,
    startDate: date,
    endDate: date,
  };

  return classifyEvent(event);
}

/**
 * Extract the domain from an email address.
 * "noreply@booking.com" → "booking.com"
 */
export function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return email.toLowerCase();
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Check if an email sender is from a known travel provider.
 */
export function isKnownTravelSender(senderEmail: string): boolean {
  const domain = extractDomain(senderEmail);
  return Object.keys(KNOWN_ORGANIZERS).some((known) => domain.includes(known));
}

/**
 * Build a Gmail search query to find emails from known travel senders.
 * Returns a query string like: "from:booking.com OR from:airbnb.com OR ..."
 */
export function buildGmailSearchQuery(daysBack: number): string {
  const domains = Object.keys(KNOWN_ORGANIZERS);
  const fromClauses = domains.map((d) => `from:${d}`).join(' OR ');
  return `(${fromClauses}) newer_than:${daysBack}d`;
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/emailClassifier.ts
git commit -m "feat: add email classifier with Gmail search query builder"
```

---

### Task 5: Create Convex email sync action

**Files:**
- Create: `convex/emailSync.ts`

- [ ] **Step 1: Create the sync action**

Create `convex/emailSync.ts`:

```typescript
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Gmail API base URL
const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType: string; body?: { data?: string }; parts?: any[] }[];
  };
  internalDate: string;
}

/**
 * Refresh Gmail access token using refresh token.
 */
async function refreshGmailToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Fetch message list from Gmail matching a search query.
 */
async function fetchGmailMessages(
  accessToken: string,
  query: string,
  maxResults: number = 50
): Promise<GmailMessage[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const res = await fetch(`${GMAIL_API}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    throw new Error(`Gmail list failed: ${res.status}`);
  }

  const data = await res.json();
  return data.messages || [];
}

/**
 * Fetch full message detail.
 */
async function fetchGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Gmail detail failed: ${res.status}`);
  return await res.json();
}

/**
 * Extract text or HTML body from a Gmail message.
 */
function extractBody(payload: GmailMessageDetail["payload"]): {
  html: string;
  text: string;
} {
  let html = "";
  let text = "";

  function walkParts(parts: any[]) {
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = Buffer.from(part.body.data, "base64url").toString("utf-8");
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        text = Buffer.from(part.body.data, "base64url").toString("utf-8");
      } else if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  if (payload.parts) {
    walkParts(payload.parts);
  } else if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    text = decoded;
    html = decoded;
  }

  return { html, text };
}

/**
 * Get a header value from a Gmail message.
 */
function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

/**
 * Main email sync action.
 * Fetches emails from Gmail, parses them, creates bookings.
 */
export const scanGmail = action({
  args: {
    accountId: v.id("emailAccounts"),
  },
  handler: async (ctx, args) => {
    // 1. Get account details
    const account = await ctx.runQuery(api.emailAccounts.getByProvider, {
      provider: "gmail",
    });

    if (!account || account._id !== args.accountId || !account.isConnected) {
      return { imported: 0, reviewed: 0, error: "Account not connected" };
    }

    // 2. Refresh token if needed
    let accessToken = account.accessToken;
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    if (Date.now() >= account.tokenExpiry) {
      try {
        const refreshed = await refreshGmailToken(
          account.refreshToken,
          clientId,
          clientSecret
        );
        accessToken = refreshed.accessToken;
        const newExpiry = Date.now() + refreshed.expiresIn * 1000;

        await ctx.runMutation(api.emailAccounts.updateTokens, {
          id: account._id,
          accessToken,
          tokenExpiry: newExpiry,
        });
      } catch (error) {
        return { imported: 0, reviewed: 0, error: "Token refresh failed" };
      }
    }

    // 3. Build search query
    const daysBack = account.lastScanTime
      ? Math.ceil(
          (Date.now() - new Date(account.lastScanTime).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 90;

    // Import known organizer domains from calendarProviders at runtime
    // We inline a subset here since Convex actions can't import from @/ aliases
    const KNOWN_DOMAINS = [
      "booking.com", "hotels.com", "marriott.com", "hilton.com", "airbnb.com",
      "skyscanner.net", "kayak.com", "britishairways.com", "emirates.com",
      "ryanair.com", "easyjet.com", "lufthansa.com", "united.com", "delta.com",
      "getyourguide.com", "viator.com", "hertz.com", "avis.com", "europcar.com",
      "opentable.com", "thefork.com", "worldnomads.com",
    ];

    const fromClauses = KNOWN_DOMAINS.map((d) => `from:${d}`).join(" OR ");
    const query = `(${fromClauses}) newer_than:${daysBack}d`;

    // 4. Fetch matching messages
    let messages: GmailMessage[];
    try {
      messages = await fetchGmailMessages(accessToken, query);
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return { imported: 0, reviewed: 0, error: "Gmail access revoked" };
      }
      return { imported: 0, reviewed: 0, error: error.message };
    }

    if (messages.length === 0) {
      await ctx.runMutation(api.emailAccounts.updateScanState, {
        id: account._id,
        lastScanTime: new Date().toISOString(),
      });
      return { imported: 0, reviewed: 0, error: null };
    }

    // 5. Get existing bookings for dedup
    const existingBookings = await ctx.runQuery(api.bookings.listBookings);
    const existingConfirmations = new Set(
      existingBookings
        .filter((b: any) => b.confirmationNumber)
        .map((b: any) => b.confirmationNumber)
    );
    const existingTitleDates = new Set(
      existingBookings.map((b: any) => `${b.title}|${b.startDate}`)
    );

    // 6. Process each message
    let imported = 0;
    let latestMessageId: string | null = null;

    for (const msg of messages) {
      try {
        const detail = await fetchGmailMessageDetail(accessToken, msg.id);
        const { html, text } = extractBody(detail.payload);
        const subject = getHeader(detail.payload.headers, "Subject");
        const fromHeader = getHeader(detail.payload.headers, "From");
        const dateHeader = getHeader(detail.payload.headers, "Date");

        // Extract sender domain
        const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
        const senderEmail = (emailMatch[1] || fromHeader).toLowerCase();
        const senderDomain = senderEmail.includes("@")
          ? senderEmail.split("@")[1]
          : senderEmail;

        // Try schema.org extraction first
        // Inline a minimal schema.org parser for Convex action context
        let booking = tryParseSchemaOrg(html, senderDomain);

        // Fallback: classify by subject + sender
        if (!booking) {
          booking = classifyBySubject(subject, text.slice(0, 500), senderDomain, dateHeader);
        }

        if (!booking) continue;

        // Dedup check
        if (booking.confirmationNumber && existingConfirmations.has(booking.confirmationNumber)) {
          continue;
        }
        if (existingTitleDates.has(`${booking.title}|${booking.startDate}`)) {
          continue;
        }

        // Build details JSON
        const detailsKey = booking.type === "car_rental"
          ? "carDetails"
          : `${booking.type}Details`;

        // Create booking
        await ctx.runMutation(api.bookings.createBooking, {
          type: booking.type as any,
          source: "email" as any,
          provider: booking.provider,
          status: "upcoming" as any,
          title: booking.title,
          startDate: booking.startDate,
          endDate: booking.endDate,
          location: booking.location,
          confirmationNumber: booking.confirmationNumber,
          [detailsKey]: Object.keys(booking.details).length > 0
            ? JSON.stringify(booking.details)
            : undefined,
        });

        imported++;
        if (!latestMessageId) latestMessageId = msg.id;
      } catch {
        // Skip individual message failures
        continue;
      }
    }

    // 7. Update scan state
    await ctx.runMutation(api.emailAccounts.updateScanState, {
      id: account._id,
      lastScanTime: new Date().toISOString(),
      lastScanMessageId: latestMessageId ?? account.lastScanMessageId,
    });

    return { imported, reviewed: 0, error: null };
  },
});

// ─── Inline schema.org parser (simplified for Convex action) ────────

interface ParsedBooking {
  type: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  confirmationNumber?: string;
  provider: string;
  details: Record<string, string>;
}

const SCHEMA_TYPE_MAP: Record<string, string> = {
  FlightReservation: "flight",
  LodgingReservation: "hotel",
  FoodEstablishmentReservation: "restaurant",
  RentalCarReservation: "car_rental",
  EventReservation: "experience",
  TrainReservation: "flight",
  BusReservation: "flight",
};

function tryParseSchemaOrg(html: string, senderDomain: string): ParsedBooking | null {
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const bookingType = SCHEMA_TYPE_MAP[item["@type"]];
        if (!bookingType) continue;

        const confirmation = item.reservationNumber || item.confirmationNumber;
        const providerName =
          item.provider?.name ||
          item.reservationFor?.provider?.name ||
          senderDomain.replace("www.", "").split(".")[0];

        const toDate = (v: any) =>
          v ? new Date(v).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

        if (bookingType === "flight") {
          const leg = item.reservationFor || item;
          const dep = leg.departureAirport?.iataCode || "";
          const arr = leg.arrivalAirport?.iataCode || "";
          const num = leg.flightNumber || "";
          return {
            type: "flight",
            title: dep && arr ? `${dep} → ${arr}${num ? ` ${num}` : ""}` : `Flight via ${providerName}`,
            startDate: toDate(leg.departureTime || item.checkinTime),
            endDate: toDate(leg.arrivalTime),
            location: arr,
            confirmationNumber: confirmation,
            provider: providerName,
            details: { airline: leg.airline?.name || providerName, flightNumber: num, departure: dep, arrival: arr },
          };
        }

        if (bookingType === "hotel") {
          const hotel = item.reservationFor || {};
          return {
            type: "hotel",
            title: hotel.name || `Hotel via ${providerName}`,
            startDate: toDate(item.checkinTime || item.checkinDate),
            endDate: toDate(item.checkoutTime || item.checkoutDate),
            location: hotel.address?.addressLocality,
            confirmationNumber: confirmation,
            provider: providerName,
            details: { hotelName: hotel.name || "", address: hotel.address?.streetAddress || "" },
          };
        }

        if (bookingType === "restaurant") {
          const rest = item.reservationFor || {};
          return {
            type: "restaurant",
            title: rest.name || `Restaurant via ${providerName}`,
            startDate: toDate(item.startTime),
            location: rest.address?.addressLocality,
            confirmationNumber: confirmation,
            provider: providerName,
            details: { name: rest.name || "", partySize: String(item.partySize || "") },
          };
        }

        if (bookingType === "car_rental") {
          return {
            type: "car_rental",
            title: `${providerName} rental`,
            startDate: toDate(item.pickupTime || item.pickupDate),
            endDate: toDate(item.dropoffTime || item.dropoffDate),
            location: item.pickupLocation?.name,
            confirmationNumber: confirmation,
            provider: providerName,
            details: { company: providerName, pickupLocation: item.pickupLocation?.name || "", dropoffLocation: item.dropoffLocation?.name || "" },
          };
        }

        if (bookingType === "experience") {
          const evt = item.reservationFor || {};
          return {
            type: "experience",
            title: evt.name || `Event via ${providerName}`,
            startDate: toDate(evt.startDate || item.startTime),
            endDate: evt.endDate ? toDate(evt.endDate) : undefined,
            location: evt.location?.name,
            confirmationNumber: confirmation,
            provider: providerName,
            details: { activityName: evt.name || "" },
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Fallback classifier by subject line ────────

const TYPE_KEYWORDS: Record<string, string[]> = {
  flight: ["flight", "boarding", "departure", "airline", "airways"],
  hotel: ["check-in", "checkout", "hotel", "resort", "hostel", "room", "accommodation"],
  experience: ["tour", "experience", "activity", "tickets", "museum"],
  car_rental: ["car rental", "car hire", "pickup", "rental car"],
  insurance: ["travel insurance", "policy", "coverage"],
  restaurant: ["reservation", "table for", "dinner at", "restaurant"],
};

function classifyBySubject(
  subject: string,
  bodySnippet: string,
  senderDomain: string,
  dateHeader: string
): ParsedBooking | null {
  const combined = `${subject} ${bodySnippet}`.toLowerCase();
  const cleanDomain = senderDomain.replace("www.", "");

  let bestType: string | null = null;
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  if (!bestType || bestScore === 0) return null;

  const date = dateHeader
    ? new Date(dateHeader).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const providerName = cleanDomain.split(".")[0];
  const capitalizedProvider = providerName.charAt(0).toUpperCase() + providerName.slice(1);

  return {
    type: bestType,
    title: subject.slice(0, 100),
    startDate: date,
    provider: capitalizedProvider,
    details: {},
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/emailSync.ts
git commit -m "feat: add Gmail sync Convex action with schema.org parsing"
```

---

### Task 6: Add Gmail OAuth endpoints to API constants

**Files:**
- Modify: `constants/api.ts`

- [ ] **Step 1: Add Gmail auth endpoints**

Add to the `endpoints` object in `constants/api.ts`:

```typescript
  // Gmail OAuth
  gmailAuth: `${API_BASE}/api/auth/gmail`,
  gmailCallback: `${API_BASE}/api/auth/gmail/callback`,
```

- [ ] **Step 2: Commit**

```bash
git add constants/api.ts
git commit -m "feat: add Gmail OAuth endpoint constants"
```

---

### Task 7: Create EmailProvider context

**Files:**
- Create: `contexts/email-context.tsx`

- [ ] **Step 1: Create the context**

Create `contexts/email-context.tsx` following the exact same pattern as `contexts/calendar-context.tsx`:

```tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Linking } from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { endpoints } from '@/constants/api';

interface EmailContextValue {
  gmailAccount: any | null; // emailAccounts row or null
  isSyncing: boolean;
  lastSyncResult: { imported: number; error: string | null } | null;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  syncGmail: () => Promise<void>;
  loaded: boolean;
}

const EmailContext = createContext<EmailContextValue | null>(null);

export function EmailProvider({ children }: { children: React.ReactNode }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ imported: number; error: string | null } | null>(null);
  const autoSyncFired = useRef(false);

  const gmailAccount = useQuery(api.emailAccounts.getByProvider, { provider: 'gmail' });
  const scanGmail = useAction(api.emailSync.scanGmail);
  const disconnectAccount = useMutation(api.emailAccounts.disconnect);

  const loaded = gmailAccount !== undefined;

  // Auto-sync on app open if connected and last sync > 24h ago
  useEffect(() => {
    if (!loaded || autoSyncFired.current) return;
    if (!gmailAccount || !gmailAccount.isConnected) return;

    if (gmailAccount.lastScanTime) {
      const hoursSince =
        (Date.now() - new Date(gmailAccount.lastScanTime).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return;
    }

    autoSyncFired.current = true;
    syncGmail();
  }, [loaded, gmailAccount?.isConnected, gmailAccount?.lastScanTime]);

  const connectGmail = useCallback(async () => {
    // Open Gmail OAuth in browser — the Vercel endpoint handles the redirect dance
    // After OAuth completes, the callback stores tokens in Convex and redirects
    // to a deep link that brings the user back to the app
    await Linking.openURL(endpoints.gmailAuth);
  }, []);

  const disconnectGmail = useCallback(async () => {
    if (!gmailAccount) return;
    await disconnectAccount({ id: gmailAccount._id });
  }, [gmailAccount, disconnectAccount]);

  const syncGmail = useCallback(async () => {
    if (isSyncing || !gmailAccount || !gmailAccount.isConnected) return;

    setIsSyncing(true);
    try {
      const result = await scanGmail({ accountId: gmailAccount._id });
      setLastSyncResult({
        imported: result.imported,
        error: result.error ?? null,
      });
    } catch (error: any) {
      setLastSyncResult({ imported: 0, error: error.message || 'Sync failed' });
    }
    setIsSyncing(false);
  }, [isSyncing, gmailAccount, scanGmail]);

  const value = useMemo(
    () => ({
      gmailAccount,
      isSyncing,
      lastSyncResult,
      connectGmail,
      disconnectGmail,
      syncGmail,
      loaded,
    }),
    [gmailAccount, isSyncing, lastSyncResult, connectGmail, disconnectGmail, syncGmail, loaded]
  );

  return (
    <EmailContext.Provider value={value}>{children}</EmailContext.Provider>
  );
}

export function useEmail() {
  const ctx = useContext(EmailContext);
  if (!ctx) throw new Error('useEmail must be used within EmailProvider');
  return ctx;
}
```

**Note:** This file uses `useAction` for the Convex action and `useMutation` — add the missing `useMutation` import from `convex/react`.

Fix the import line to:
```typescript
import { useAction, useQuery, useMutation } from 'convex/react';
```

- [ ] **Step 2: Commit**

```bash
git add contexts/email-context.tsx
git commit -m "feat: add EmailProvider context for Gmail sync state"
```

---

### Task 8: Add EmailProvider to app layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add import and wrap**

Read `app/_layout.tsx`. Add import:
```typescript
import { EmailProvider } from '@/contexts/email-context';
```

Wrap `<EmailProvider>` around children, inside `<CalendarProvider>`:
```tsx
<CalendarProvider>
  <EmailProvider>
    {/* existing children */}
  </EmailProvider>
</CalendarProvider>
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add EmailProvider to app layout"
```

---

### Task 9: Add Email Sync section to More screen

**Files:**
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Read and add imports**

Add imports:
```typescript
import { Mail, RefreshCw as EmailRefreshCw } from 'lucide-react-native';
import { useEmail } from '@/contexts/email-context';
```

(Note: RefreshCw may already be imported from Phase 2. If so, just add Mail.)

- [ ] **Step 2: Update Section type**

Add `'email'` to the Section type:
```typescript
type Section = 'main' | 'visas' | 'favorites' | 'visited' | 'settings' | 'calendar' | 'email';
```

- [ ] **Step 3: Add useEmail hook**

Inside the component, add:
```typescript
const { gmailAccount, isSyncing: isEmailSyncing, syncGmail, connectGmail, disconnectGmail } = useEmail();
```

- [ ] **Step 4: Add Email Sync menu item**

In the `menuItems` array, after the 'calendar' item and before 'settings':
```typescript
{
  key: 'email' as Section,
  label: 'Email Sync',
  subtitle: gmailAccount?.isConnected
    ? `${gmailAccount.email} \u00B7 ${gmailAccount.lastScanTime ? formatRelativeTime(gmailAccount.lastScanTime) : 'Never synced'}`
    : 'Connect Gmail',
  icon: <Mail color="#FFFFFF" size={22} />,
  tint: colors.secondary,
},
```

- [ ] **Step 5: Add renderEmail section**

Add a `renderEmail` function following the same pattern as `renderCalendar`:

```tsx
const renderEmail = () => (
  <View style={styles.sectionContent}>
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => setActiveSection('main')}
      hitSlop={12}
    >
      <ArrowLeft color={colors.foreground} size={20} />
    </TouchableOpacity>

    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
      Email Sync
    </Text>
    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
      Import booking confirmations from your Gmail inbox.
    </Text>

    {!gmailAccount?.isConnected ? (
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.primary, borderWidth: 0 }]}
        onPress={() => connectGmail()}
      >
        <View style={styles.settingInfo}>
          <Mail color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Connect Gmail
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>
    ) : (
      <>
        {/* Connected account info */}
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <View style={styles.settingInfo}>
            <Mail color={colors.textSecondary} size={20} />
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>
              {gmailAccount.email}
            </Text>
          </View>
        </View>

        {/* Scan now */}
        <TouchableOpacity
          style={[
            styles.settingRow,
            { backgroundColor: colors.primary, borderWidth: 0, opacity: isEmailSyncing ? 0.6 : 1 },
          ]}
          onPress={() => syncGmail()}
          disabled={isEmailSyncing}
        >
          <View style={styles.settingInfo}>
            <RefreshCw color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              {isEmailSyncing ? 'Scanning...' : 'Scan Now'}
            </Text>
          </View>
          {gmailAccount.lastScanTime && (
            <Text style={[styles.settingValue, { color: 'rgba(255,255,255,0.70)' }]}>
              {formatRelativeTime(gmailAccount.lastScanTime)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Disconnect */}
        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.danger, borderWidth: 0 }]}
          onPress={() => {
            Alert.alert(
              'Disconnect Gmail',
              'This will stop scanning your emails. Existing imported bookings will remain.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Disconnect',
                  style: 'destructive',
                  onPress: () => disconnectGmail(),
                },
              ],
            );
          }}
        >
          <View style={styles.settingInfo}>
            <Unlink color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              Disconnect Gmail
            </Text>
          </View>
          <ChevronRight color="#FFFFFF" size={18} />
        </TouchableOpacity>
      </>
    )}
  </View>
);
```

- [ ] **Step 6: Add to render switch**

After `{activeSection === 'calendar' && renderCalendar()}`:
```tsx
{activeSection === 'email' && renderEmail()}
```

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/more.tsx"
git commit -m "feat: add Email Sync section to More screen"
```

---

### Task 10: Add email sync to pull-to-refresh

**Files:**
- Modify: `components/booking/BookingsListView.tsx`

- [ ] **Step 1: Add email imports**

Add:
```typescript
import { useEmail } from '@/contexts/email-context';
```

- [ ] **Step 2: Add hook and combined sync**

Inside the component, add:
```typescript
const { gmailAccount, isSyncing: isEmailSyncing, syncGmail } = useEmail();
```

Update the `refreshControl` onRefresh to trigger BOTH syncs:
```tsx
refreshControl={
  (isConnected || gmailAccount?.isConnected) ? (
    <RefreshControl
      refreshing={isSyncing || isEmailSyncing}
      onRefresh={() => {
        if (isConnected) sync();
        if (gmailAccount?.isConnected) syncGmail();
      }}
      tintColor={colors.primary}
    />
  ) : undefined
}
```

- [ ] **Step 3: Commit**

```bash
git add components/booking/BookingsListView.tsx
git commit -m "feat: add email sync to pull-to-refresh"
```

---

### Task 11: Verify everything compiles

**Files:** None (testing only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No new errors.

- [ ] **Step 2: Fix any issues**

Address any TypeScript errors.

- [ ] **Step 3: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during email sync verification"
```

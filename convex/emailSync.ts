"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ===== Types =====

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: any[];
  };
  internalDate: string;
}

interface ParsedBooking {
  type: "flight" | "hotel" | "experience" | "car_rental" | "insurance" | "restaurant";
  provider: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  confirmationNumber?: string;
  details: Record<string, any>;
}

// ===== Constants =====

const TRAVEL_DOMAINS = [
  "booking.com",
  "airbnb.com",
  "expedia.com",
  "hotels.com",
  "skyscanner.net",
  "kayak.com",
  "tripadvisor.com",
  "vrbo.com",
  "agoda.com",
  "hostelworld.com",
  "ryanair.com",
  "easyjet.com",
  "britishairways.com",
  "emirates.com",
  "united.com",
  "delta.com",
  "aa.com",
  "southwest.com",
  "lufthansa.com",
  "klm.com",
  "hertz.com",
  "enterprise.com",
  "avis.com",
  "rentalcars.com",
  "opentable.com",
  "resy.com",
  "getyourguide.com",
  "viator.com",
  "worldnomads.com",
  "allianz-assistance.com",
];

const TYPE_KEYWORDS: Record<ParsedBooking["type"], string[]> = {
  flight: [
    "flight", "boarding pass", "itinerary", "e-ticket", "airline",
    "departure", "arrival", "gate", "seat", "check-in", "fly",
  ],
  hotel: [
    "hotel", "reservation", "check-in", "check-out", "accommodation",
    "room", "suite", "hostel", "stay", "lodge", "resort", "villa",
  ],
  experience: [
    "tour", "activity", "experience", "ticket", "excursion",
    "attraction", "museum", "event", "show", "concert",
  ],
  car_rental: [
    "car rental", "rental car", "vehicle", "pickup", "drop-off",
    "hertz", "enterprise", "avis", "rent a car",
  ],
  insurance: [
    "travel insurance", "policy", "coverage", "claim",
    "world nomads", "allianz", "insurance",
  ],
  restaurant: [
    "restaurant", "reservation", "dining", "table for",
    "opentable", "resy", "dinner", "lunch", "brunch",
  ],
};

const DOMAIN_TYPE_MAP: Record<string, ParsedBooking["type"]> = {
  "ryanair.com": "flight",
  "easyjet.com": "flight",
  "britishairways.com": "flight",
  "emirates.com": "flight",
  "united.com": "flight",
  "delta.com": "flight",
  "aa.com": "flight",
  "southwest.com": "flight",
  "lufthansa.com": "flight",
  "klm.com": "flight",
  "booking.com": "hotel",
  "airbnb.com": "hotel",
  "hotels.com": "hotel",
  "agoda.com": "hotel",
  "hostelworld.com": "hotel",
  "vrbo.com": "hotel",
  "hertz.com": "car_rental",
  "enterprise.com": "car_rental",
  "avis.com": "car_rental",
  "rentalcars.com": "car_rental",
  "opentable.com": "restaurant",
  "resy.com": "restaurant",
  "getyourguide.com": "experience",
  "viator.com": "experience",
  "worldnomads.com": "insurance",
  "allianz-assistance.com": "insurance",
  "expedia.com": "hotel",
  "kayak.com": "flight",
  "skyscanner.net": "flight",
  "tripadvisor.com": "experience",
};

// ===== Helper Functions =====

async function refreshGmailToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

async function fetchGmailMessages(
  accessToken: string,
  query: string,
  maxResults: number
): Promise<GmailMessage[]> {
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new Error("Gmail access revoked");
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail messages fetch failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.messages ?? [];
}

async function fetchGmailMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    throw new Error("Gmail access revoked");
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail message detail fetch failed (${response.status}): ${error}`);
  }

  return await response.json();
}

function extractBody(payload: GmailMessageDetail["payload"]): { html: string; text: string } {
  let html = "";
  let text = "";

  function walkParts(parts: any[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html += Buffer.from(part.body.data, "base64url").toString("utf-8");
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        text += Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  // Check top-level body first
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    // Guess mime type from content
    if (decoded.includes("<html") || decoded.includes("<div")) {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  // Walk nested parts
  walkParts(payload.parts);

  return { html, text };
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value ?? "";
}

function extractDomainFromEmail(from: string): string {
  const match = from.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : "";
}

function tryParseSchemaOrg(html: string, senderDomain: string): ParsedBooking | null {
  if (!html) return null;

  const ldJsonRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = item["@type"];

        if (type === "FlightReservation") {
          const flight = item.reservationFor || {};
          const dep = flight.departureAirport || {};
          const arr = flight.arrivalAirport || {};
          return {
            type: "flight",
            provider: senderDomain,
            title: `${flight.airline?.name ?? senderDomain} - ${dep.iataCode ?? "?"} to ${arr.iataCode ?? "?"}`,
            startDate: flight.departureTime ?? item.reservationFor?.departureTime ?? new Date().toISOString(),
            endDate: flight.arrivalTime,
            location: `${dep.iataCode ?? ""} → ${arr.iataCode ?? ""}`,
            confirmationNumber: item.reservationNumber ?? item.confirmationNumber,
            details: {
              airline: flight.airline?.name,
              flightNumber: flight.flightNumber,
              departureAirport: dep.name,
              departureCode: dep.iataCode,
              arrivalAirport: arr.name,
              arrivalCode: arr.iataCode,
              departureTime: flight.departureTime,
              arrivalTime: flight.arrivalTime,
              seatNumber: item.airplaneSeat,
              cabin: item.airplaneSeatClass,
            },
          };
        }

        if (type === "LodgingReservation") {
          const hotel = item.reservationFor || {};
          const address = hotel.address || {};
          return {
            type: "hotel",
            provider: senderDomain,
            title: hotel.name ?? `Hotel - ${senderDomain}`,
            startDate: item.checkinTime ?? item.checkinDate ?? new Date().toISOString(),
            endDate: item.checkoutTime ?? item.checkoutDate,
            location: address.addressLocality
              ? `${address.addressLocality}, ${address.addressCountry ?? ""}`
              : undefined,
            confirmationNumber: item.reservationNumber ?? item.confirmationNumber,
            details: {
              hotelName: hotel.name,
              address: address.streetAddress,
              city: address.addressLocality,
              country: address.addressCountry,
              checkin: item.checkinTime ?? item.checkinDate,
              checkout: item.checkoutTime ?? item.checkoutDate,
            },
          };
        }

        if (type === "FoodEstablishmentReservation") {
          const restaurant = item.reservationFor || {};
          const address = restaurant.address || {};
          return {
            type: "restaurant",
            provider: senderDomain,
            title: restaurant.name ?? `Restaurant - ${senderDomain}`,
            startDate: item.startTime ?? new Date().toISOString(),
            endDate: item.endTime,
            location: address.addressLocality
              ? `${address.addressLocality}, ${address.addressCountry ?? ""}`
              : undefined,
            confirmationNumber: item.reservationNumber ?? item.confirmationNumber,
            details: {
              restaurantName: restaurant.name,
              partySize: item.partySize,
              address: address.streetAddress,
              city: address.addressLocality,
            },
          };
        }

        if (type === "RentalCarReservation") {
          const car = item.reservationFor || {};
          return {
            type: "car_rental",
            provider: senderDomain,
            title: `Car Rental - ${car.rentalCompany?.name ?? senderDomain}`,
            startDate: item.pickupTime ?? new Date().toISOString(),
            endDate: item.dropoffTime,
            location: item.pickupLocation?.name ?? item.pickupLocation?.address?.addressLocality,
            confirmationNumber: item.reservationNumber ?? item.confirmationNumber,
            details: {
              company: car.rentalCompany?.name,
              vehicleType: car.name,
              pickupLocation: item.pickupLocation?.name,
              dropoffLocation: item.dropoffLocation?.name,
              pickupTime: item.pickupTime,
              dropoffTime: item.dropoffTime,
            },
          };
        }

        if (type === "EventReservation") {
          const event = item.reservationFor || {};
          const location = event.location || {};
          return {
            type: "experience",
            provider: senderDomain,
            title: event.name ?? `Event - ${senderDomain}`,
            startDate: event.startDate ?? new Date().toISOString(),
            endDate: event.endDate,
            location: location.name ?? location.address?.addressLocality,
            confirmationNumber: item.reservationNumber ?? item.confirmationNumber,
            details: {
              eventName: event.name,
              venue: location.name,
              address: location.address?.streetAddress,
              city: location.address?.addressLocality,
            },
          };
        }
      }
    } catch {
      // JSON parse failure, continue to next match
    }
  }

  return null;
}

function classifyBySubject(
  subject: string,
  bodySnippet: string,
  senderDomain: string,
  dateHeader: string
): ParsedBooking | null {
  const combined = `${subject} ${bodySnippet}`.toLowerCase();

  // Check domain-based classification first
  let detectedType: ParsedBooking["type"] | null = null;

  for (const [domain, type] of Object.entries(DOMAIN_TYPE_MAP)) {
    if (senderDomain.includes(domain)) {
      detectedType = type;
      break;
    }
  }

  // If no domain match, try keyword matching
  if (!detectedType) {
    let bestScore = 0;
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      const score = keywords.reduce(
        (count, kw) => count + (combined.includes(kw.toLowerCase()) ? 1 : 0),
        0
      );
      if (score > bestScore) {
        bestScore = score;
        detectedType = type as ParsedBooking["type"];
      }
    }
    // Need at least one keyword match
    if (bestScore === 0) return null;
  }

  // Extract confirmation number from body
  const confMatch = combined.match(
    /(?:confirmation|booking|reference|order)\s*(?:#|number|no\.?|code)?:?\s*([A-Z0-9]{4,20})/i
  );

  // Try to parse date from the email Date header
  let startDate: string;
  try {
    startDate = dateHeader
      ? new Date(dateHeader).toISOString()
      : new Date().toISOString();
  } catch {
    startDate = new Date().toISOString();
  }

  return {
    type: detectedType!,
    provider: senderDomain,
    title: subject || `${detectedType} booking from ${senderDomain}`,
    startDate,
    confirmationNumber: confMatch?.[1],
    details: {
      rawSubject: subject,
      senderDomain,
    },
  };
}

// Map booking type to the details field key
function getDetailsKey(
  type: ParsedBooking["type"]
): "flightDetails" | "hotelDetails" | "experienceDetails" | "carDetails" | "insuranceDetails" | "restaurantDetails" {
  switch (type) {
    case "flight":
      return "flightDetails";
    case "hotel":
      return "hotelDetails";
    case "experience":
      return "experienceDetails";
    case "car_rental":
      return "carDetails";
    case "insurance":
      return "insuranceDetails";
    case "restaurant":
      return "restaurantDetails";
  }
}

// ===== Main Action =====

export const scanGmail = action({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    try {
      // 1. Get and verify account
      const account = await ctx.runQuery(api.emailAccounts.getByProvider, {
        provider: "gmail",
      });

      if (!account) {
        return { imported: 0, reviewed: 0, error: "No Gmail account connected" };
      }
      if (account._id !== args.accountId) {
        return { imported: 0, reviewed: 0, error: "Account ID mismatch" };
      }
      if (!account.isConnected) {
        return { imported: 0, reviewed: 0, error: "Gmail account is disconnected" };
      }

      let accessToken = account.accessToken;

      // 2. Refresh token if expired
      if (Date.now() >= account.tokenExpiry) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return { imported: 0, reviewed: 0, error: "Google OAuth credentials not configured" };
        }

        const refreshed = await refreshGmailToken(
          account.refreshToken,
          clientId,
          clientSecret
        );
        accessToken = refreshed.accessToken;

        await ctx.runMutation(api.emailAccounts.updateTokens, {
          id: account._id,
          accessToken: refreshed.accessToken,
          tokenExpiry: Date.now() + refreshed.expiresIn * 1000,
        });
      }

      // 3. Build Gmail search query
      const domainQueries = TRAVEL_DOMAINS.map((d) => `from:${d}`).join(" OR ");
      const lastScanTime = account.lastScanTime
        ? new Date(account.lastScanTime)
        : null;
      const daysBack = lastScanTime
        ? Math.max(
            1,
            Math.ceil(
              (Date.now() - lastScanTime.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 90;
      const query = `(${domainQueries}) newer_than:${daysBack}d`;

      // 4. Fetch message list
      let messages: GmailMessage[];
      try {
        messages = await fetchGmailMessages(accessToken, query, 50);
      } catch (err: any) {
        if (err.message === "Gmail access revoked") {
          return { imported: 0, reviewed: 0, error: "Gmail access has been revoked. Please reconnect your account." };
        }
        throw err;
      }

      if (messages.length === 0) {
        await ctx.runMutation(api.emailAccounts.updateScanState, {
          id: account._id,
          lastScanTime: Date.now(),
        });
        return { imported: 0, reviewed: 0, error: null };
      }

      // 10. Get existing bookings for dedup
      const existingBookings = await ctx.runQuery(api.bookings.listBookings, {});

      let imported = 0;
      let lastMessageId: string | undefined;

      // 5. Process each message
      for (const msg of messages) {
        try {
          if (!lastMessageId) lastMessageId = msg.id;

          const detail = await fetchGmailMessageDetail(accessToken, msg.id);

          // 7. Extract headers
          const subject = getHeader(detail.payload.headers, "Subject");
          const from = getHeader(detail.payload.headers, "From");
          const dateHeader = getHeader(detail.payload.headers, "Date");
          const senderDomain = extractDomainFromEmail(from);

          // 6. Extract body
          const { html, text } = extractBody(detail.payload);

          // 8. Try schema.org first
          let parsed = tryParseSchemaOrg(html, senderDomain);

          // 9. Fallback to keyword classification
          if (!parsed) {
            const bodySnippet = (text || html).substring(0, 2000);
            parsed = classifyBySubject(subject, bodySnippet, senderDomain, dateHeader);
          }

          if (!parsed) continue;

          // 10. Dedup check
          const isDuplicate = existingBookings.some((existing) => {
            if (
              parsed!.confirmationNumber &&
              existing.confirmationNumber &&
              parsed!.confirmationNumber === existing.confirmationNumber
            ) {
              return true;
            }
            if (
              existing.title === parsed!.title &&
              existing.startDate === parsed!.startDate
            ) {
              return true;
            }
            return false;
          });

          if (isDuplicate) continue;

          // 11. Create booking
          const detailsKey = getDetailsKey(parsed.type);
          await ctx.runMutation(api.bookings.createBooking, {
            type: parsed.type,
            source: "email" as const,
            provider: parsed.provider,
            status: "upcoming" as const,
            title: parsed.title,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            location: parsed.location,
            confirmationNumber: parsed.confirmationNumber,
            [detailsKey]: JSON.stringify(parsed.details),
          });

          imported++;
        } catch (err: any) {
          if (err.message === "Gmail access revoked") {
            return {
              imported,
              reviewed: 0,
              error: "Gmail access has been revoked. Please reconnect your account.",
            };
          }
          // Skip individual message errors, continue processing
          console.error(`Failed to process message ${msg.id}:`, err);
        }
      }

      // 12. Update scan state
      await ctx.runMutation(api.emailAccounts.updateScanState, {
        id: account._id,
        lastScanTime: Date.now(),
        lastScanMessageId: lastMessageId,
      });

      // 13. Return results
      return { imported, reviewed: 0, error: null };
    } catch (err: any) {
      console.error("scanGmail action failed:", err);
      return {
        imported: 0,
        reviewed: 0,
        error: err.message ?? "Unknown error during Gmail scan",
      };
    }
  },
});

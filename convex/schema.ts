import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  trips: defineTable({
    countryCode: v.string(),
    countryName: v.string(),
    status: v.union(v.literal("planned"), v.literal("completed")),
    duration: v.number(),
    region: v.string(),
    costLevel: v.number(),
    dailyBudget: v.string(),
    flightHours: v.number(),
    iataCode: v.string(),
    currency: v.string(),
    language: v.string(),
    timezone: v.string(),
    capital: v.string(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    surpriseMe: v.optional(v.boolean()),
    vibeTag: v.optional(v.string()),
    // Travel party
    companions: v.optional(v.string()), // JSON: { count: number, notes: string }
    // Travel dates
    startDate: v.optional(v.string()), // ISO date e.g. "2026-06-15"
    endDate: v.optional(v.string()),   // ISO date, auto-calculated from startDate + duration
    // Images from Unsplash (stored once at generation, not re-fetched)
    heroImage: v.optional(v.string()), // JSON: { url, credit, creditUrl, link }
    dayImages: v.optional(v.string()), // JSON: array of { url, thumb, credit, creditUrl } | null
    // AI-generated content stored as JSON strings
    itinerary: v.string(),
    budgetBreakdown: v.string(),
    packingSuggestions: v.string(),
    visaChecklist: v.string(),
    highlights: v.string(),
    accommodationTips: v.string(),
    // Local info (AI-generated)
    localEssentials: v.optional(v.string()), // JSON: { emergencyNumber, policeNumber, ambulanceNumber, ukEmbassy, nearestHospital }
    localGuide: v.optional(v.string()), // JSON: { apps, tipping, connectivity, tapWater, plugType, dressCode, scamWarnings, localCustoms, cashOrCard }
    // Car rental guide (AI-generated)
    carRental: v.optional(v.string()), // JSON: { recommended, summary, companies[], idpRequired, drivingSide, roadConditions, fuelCost, insurance, tolls, parkingTips, tips[] }
    // Seasonal travel guide (AI-generated)
    seasonalGuide: v.optional(v.string()), // JSON: { bestWeather, bestValue, fewestCrowds, festivals, sweetSpot, avoid }
    // Multi-country trip support
    isMultiCountry: v.optional(v.boolean()),
    routeTitle: v.optional(v.string()), // e.g., "Prague → Vienna → Budapest"
    legs: v.optional(v.string()), // JSON: array of TripLeg objects
  })
    .index("by_status", ["status"])
    .index("by_country", ["countryCode"]),

  // Chat messages for iterating on trips
  tripMessages: defineTable({
    tripId: v.id("trips"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
  }).index("by_trip", ["tripId", "timestamp"]),

  // Visa application guides
  visaGuides: defineTable({
    countryCode: v.string(),
    countryName: v.string(),
    visaType: v.string(),
    userProfile: v.string(), // JSON: { employment, purpose, rejections, travelMonth, applyingFrom }
    guide: v.string(), // JSON: full generated guide content
    checklist: v.string(), // JSON: array of { id, label, checked, category, tip? }
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  }).index("by_country", ["countryCode"]),

  // Travel bookings (flights, hotels, experiences, etc.)
  bookings: defineTable({
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
      v.literal("api"),
      v.literal("email")
    ),
    provider: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    // Core fields
    title: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
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
    // Calendar sync
    calendarEventId: v.optional(v.string()),
    calendarSource: v.optional(
      v.union(v.literal("google"), v.literal("apple"))
    ),
  })
    .index("by_trip", ["tripId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_date", ["startDate"]),

  // Email account connections for booking import
  emailAccounts: defineTable({
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
    isConnected: v.boolean(),
    lastScanTime: v.optional(v.string()),
    lastScanMessageId: v.optional(v.string()),
  }).index("by_provider", ["provider"]),
});

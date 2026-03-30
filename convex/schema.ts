import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
});

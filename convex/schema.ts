import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ── Trips ──
  trips: defineTable({
    userId: v.id("users"),
    countryCode: v.string(),
    countryName: v.string(),
    region: v.string(),
    capital: v.string(),
    currency: v.string(),
    language: v.string(),
    timezone: v.string(),
    iataCode: v.string(),
    status: v.union(v.literal("planned"), v.literal("completed")),
    duration: v.number(),
    costLevel: v.number(),
    dailyBudget: v.string(),
    flightHours: v.number(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    surpriseMe: v.optional(v.boolean()),
    vibeTag: v.optional(v.string()),
    companions: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    itinerary: v.string(),
    budgetBreakdown: v.string(),
    packingSuggestions: v.string(),
    visaChecklist: v.string(),
    highlights: v.string(),
    accommodationTips: v.string(),
    heroImage: v.optional(v.string()),
    dayImages: v.optional(v.string()),
    localEssentials: v.optional(v.string()),
    localGuide: v.optional(v.string()),
    carRental: v.optional(v.string()),
    seasonalGuide: v.optional(v.string()),
    isMultiCountry: v.optional(v.boolean()),
    routeTitle: v.optional(v.string()),
    legs: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_country", ["countryCode"])
    .index("by_user", ["userId"]),

  // ── Trip Messages ──
  tripMessages: defineTable({
    tripId: v.id("trips"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
  }).index("by_trip", ["tripId", "timestamp"]),

  // ── Visa Guides ──
  visaGuides: defineTable({
    userId: v.id("users"),
    countryCode: v.string(),
    countryName: v.string(),
    visaType: v.string(),
    userProfile: v.string(),
    guide: v.string(),
    checklist: v.string(),
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  })
    .index("by_country", ["countryCode"])
    .index("by_user", ["userId"]),

  // ── Bookings ──
  bookings: defineTable({
    userId: v.id("users"),
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
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    title: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    location: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    provider: v.optional(v.string()),
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
    calendarSource: v.optional(
      v.union(v.literal("google"), v.literal("apple"))
    ),
    assignedTo: v.optional(v.id("users")),
  })
    .index("by_trip", ["tripId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_date", ["startDate"])
    .index("by_user", ["userId"]),

  // ── Email Accounts ──
  emailAccounts: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiry: v.number(),
    isConnected: v.boolean(),
    lastScanTime: v.optional(v.number()),
    lastScanMessageId: v.optional(v.string()),
  }).index("by_provider", ["provider"]),

  // ── Trip Collaborators ──
  tripCollaborators: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    joinedAt: v.number(),
  })
    .index("by_trip", ["tripId"])
    .index("by_user", ["userId"])
    .index("by_trip_and_user", ["tripId", "userId"]),

  // ── Trip Invites ──
  tripInvites: defineTable({
    tripId: v.id("trips"),
    inviteCode: v.string(),
    invitedEmail: v.optional(v.string()),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
  })
    .index("by_code", ["inviteCode"])
    .index("by_trip", ["tripId"])
    .index("by_email", ["invitedEmail"]),

  // ── Trip Votes ──
  tripVotes: defineTable({
    tripId: v.id("trips"),
    activityId: v.string(),
    userId: v.id("users"),
    vote: v.union(v.literal("up"), v.literal("down")),
  }).index("by_trip_and_activity", ["tripId", "activityId"]),

  // ── Trip Presence ──
  tripPresence: defineTable({
    tripId: v.id("trips"),
    userId: v.id("users"),
    lastSeen: v.number(),
  }).index("by_trip", ["tripId"]),
});

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
    status: v.union(
      v.literal("planned"),
      v.literal("completed"),
      v.literal("generating"),
      v.literal("failed"),
    ),
    duration: v.number(),
    costLevel: v.number(),
    dailyBudget: v.string(),
    flightHours: v.number(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    visaCost: v.optional(v.string()),
    visaProcessingTime: v.optional(v.string()),
    visaForms: v.optional(v.string()),
    visaPassportValidity: v.optional(v.string()),
    visaEntries: v.optional(v.string()),
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
    activityImages: v.optional(v.string()),
    localEssentials: v.optional(v.string()),
    localGuide: v.optional(v.string()),
    carRental: v.optional(v.string()),
    seasonalGuide: v.optional(v.string()),
    isMultiCountry: v.optional(v.boolean()),
    routeTitle: v.optional(v.string()),
    legs: v.optional(v.string()),
    // User-pinned trip — heart on the trip detail header. Distinct from
    // country-level favorites (which live in client-side AsyncStorage).
    starred: v.optional(v.boolean()),
    // Streaming generation tracking. `failedSections` lists section keys that
    // errored during a streaming run; `originalInputs` is a JSON-stringified
    // snapshot of the original create-trip inputs (for resume/retry); and
    // `generationStartedAt` is the ms-epoch timestamp the stream kicked off,
    // used to detect timeouts.
    failedSections: v.optional(v.array(v.string())),
    originalInputs: v.optional(v.string()),
    generationStartedAt: v.optional(v.number()),
    // User's free-text trip brief — original text plus any merged-in answers
    // from the refinement clarifying-questions flow. Trimmed; whitespace-only
    // is normalized to undefined. Capped at 2000 chars in the action handler.
    // Surfaced on the trip detail page via TripBriefReadout.
    userNotes: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_country", ["countryCode"])
    .index("by_user", ["userId"]),

  // ── Country Tips Cache ──
  // LLM-generated country-level tips for any country not covered by the
  // handwritten data/localInfo.ts (88 countries today). First user to
  // generate a trip for an uncovered country pays the LLM cost; the
  // result is cached here forever so every subsequent trip / country
  // detail page reads the cached row instantly. Mirrors the LocalInfo
  // interface from data/localInfo.ts so CountryTipsView can render
  // either source identically.
  countryTipsCache: defineTable({
    countryCode: v.string(), // alpha-3, e.g. "MUS"
    emergencyNumber: v.string(),
    policeNumber: v.string(),
    ambulanceNumber: v.string(),
    fireNumber: v.string(),
    ukEmbassy: v.optional(
      v.object({
        city: v.string(),
        phone: v.string(),
        address: v.string(),
        website: v.string(),
      }),
    ),
    essentialApps: v.array(
      v.object({
        name: v.string(),
        purpose: v.string(),
      }),
    ),
    tippingCulture: v.string(),
    dressCode: v.optional(v.string()),
    scamWarnings: v.optional(v.array(v.string())),
    localCustoms: v.optional(v.array(v.string())),
    tapWater: v.union(
      v.literal("safe"),
      v.literal("unsafe"),
      v.literal("varies"),
    ),
    plugType: v.string(),
    simCard: v.string(),
    currencyTip: v.optional(v.string()),
    generatedAt: v.number(),
  }).index("by_country", ["countryCode"]),

  // ── Trip Messages ──
  tripMessages: defineTable({
    tripId: v.id("trips"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
  }).index("by_trip", ["tripId", "timestamp"]),

  // ── Visa Guide Messages ──
  visaGuideMessages: defineTable({
    guideId: v.id("visaGuides"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    userId: v.optional(v.id("users")),
  }).index("by_guide", ["guideId", "timestamp"]),

  // ── Email verification codes ──
  // Post-signin email verification (separate from Convex Auth's signup-time
  // verify flow which we removed). We send a 6-digit code, store it here,
  // and clear it once verified.
  emailVerificationCodes: defineTable({
    userId: v.id("users"),
    code: v.string(),
    expiresAt: v.number(),
  }).index("by_user", ["userId"]),

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
  })
    .index("by_provider", ["provider"])
    .index("by_user_and_provider", ["userId", "provider"])
    .index("by_user", ["userId"]),

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

  // ── User Profiles ──
  // Per-user flags that don't fit in the auth-managed users table. The auth
  // users doc is owned by @convex-dev/auth, so anything app-specific (like
  // whether the user has finished onboarding) lives here. Tied to userId so
  // it survives across devices and sign-outs — and conversely, AsyncStorage
  // values from a previous account on the same device never leak in.
  userProfiles: defineTable({
    userId: v.id("users"),
    onboarded: v.boolean(),
    onboardedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});

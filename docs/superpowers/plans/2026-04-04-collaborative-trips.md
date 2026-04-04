# Collaborative Trip Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user scoping and real-time collaborative trip planning with roles, invites, voting, unified chat, and presence.

**Architecture:** Add `userId` to all content tables, create collaboration tables (tripCollaborators, tripInvites, tripVotes, tripPresence), add auth checks to all backend functions, build invite flow (link + email), extend chat for multi-user, add voting and presence to trip detail screen.

**Tech Stack:** Convex (backend + real-time), @convex-dev/auth (user identity), Expo Router (deep links), React Native

---

## File Structure

### New Files
```
convex/lib/auth.ts                — getAuthUser() and checkTripPermission() helpers
convex/tripCollaborators.ts       — Collaborator CRUD + permission checks
convex/tripInvites.ts             — Invite creation, acceptance, code generation
convex/tripVotes.ts               — Activity voting create/toggle/query
convex/tripPresence.ts            — Presence heartbeat upsert/query
convex/wipeTestData.ts            — One-time script to delete all test data
app/invite/[code].tsx             — Accept invite deep link screen
app/trip/collaborators.tsx        — Manage collaborators screen
app/trip/invite.tsx               — Invite creation screen (link + email)
components/CollaboratorAvatars.tsx — Avatar row + presence dots
components/ActivityVote.tsx        — Upvote/downvote buttons for itinerary
```

### Modified Files
```
convex/schema.ts                  — Add new tables, add userId to existing tables
convex/trips.ts                   — Add auth, scope by user/collaborator
convex/bookings.ts                — Add auth, scope queries
convex/visaGuides.ts              — Add auth, scope queries
app/(tabs)/trips.tsx              — Show shared trips, collaborator badges
app/trip/[id].tsx                 — Add collaborators section, presence, voting
app/chat/[tripId].tsx             — Multi-user chat with names/avatars
app/_layout.tsx                   — Add invite deep link route
hooks/use-offline-query.ts        — Add collaborator query cache configs
```

---

### Task 1: Wipe Test Data

**Files:**
- Create: `convex/wipeTestData.ts`

- [ ] **Step 1: Create the wipe script**

```typescript
// convex/wipeTestData.ts
import { internalMutation } from "./_generated/server";

export const wipeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["trips", "tripMessages", "bookings", "visaGuides"] as const;
    for (const table of tables) {
      const docs = await ctx.db.query(table).take(1000);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});
```

- [ ] **Step 2: Run the wipe from the Convex dashboard**

Go to the Convex dashboard → Functions → Run `wipeTestData.wipeAll` as an internal mutation. Or run:

```bash
npx convex run --component wipeTestData:wipeAll
```

Verify all tables are empty.

- [ ] **Step 3: Commit**

```bash
git add convex/wipeTestData.ts
git commit -m "chore: add test data wipe script"
```

---

### Task 2: Auth Helper

**Files:**
- Create: `convex/lib/auth.ts`

- [ ] **Step 1: Create the auth helper module**

```typescript
// convex/lib/auth.ts
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

/**
 * Get the authenticated user's ID or throw.
 * Use this at the top of every query/mutation that requires auth.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/**
 * Get the authenticated user's document or throw.
 */
export async function requireAuthUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const userId = await requireAuth(ctx);
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

type Role = "owner" | "editor" | "viewer";

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/**
 * Check if the current user has at least the required role on a trip.
 * Returns the user's collaborator document.
 * Throws if the user doesn't have sufficient permission.
 */
export async function checkTripPermission(
  ctx: QueryCtx | MutationCtx,
  tripId: Id<"trips">,
  requiredRole: Role
): Promise<{ userId: Id<"users">; role: Role }> {
  const userId = await requireAuth(ctx);

  const collaborator = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip_and_user", (q) =>
      q.eq("tripId", tripId).eq("userId", userId)
    )
    .unique();

  if (!collaborator) {
    throw new Error("You don't have access to this trip");
  }

  if (ROLE_LEVEL[collaborator.role] < ROLE_LEVEL[requiredRole]) {
    throw new Error(`Requires ${requiredRole} role, you have ${collaborator.role}`);
  }

  return { userId, role: collaborator.role };
}

/**
 * Check if a user is a collaborator on a trip (without throwing).
 */
export async function isTripCollaborator(
  ctx: QueryCtx | MutationCtx,
  tripId: Id<"trips">,
  userId: Id<"users">
): Promise<boolean> {
  const collaborator = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip_and_user", (q) =>
      q.eq("tripId", tripId).eq("userId", userId)
    )
    .unique();

  return collaborator !== null;
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat(collab): add auth helpers — requireAuth, checkTripPermission"
```

---

### Task 3: Schema Changes

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Update the schema**

Replace the entire `convex/schema.ts` with:

```typescript
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
    iataCode: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("completed")),
    duration: v.number(),
    costLevel: v.string(),
    dailyBudget: v.number(),
    flightHours: v.number(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    companions: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    itinerary: v.optional(v.string()),
    budgetBreakdown: v.optional(v.string()),
    packingSuggestions: v.optional(v.string()),
    visaChecklist: v.optional(v.string()),
    highlights: v.optional(v.string()),
    accommodationTips: v.optional(v.string()),
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
```

- [ ] **Step 2: Run `npx convex dev` to validate schema**

```bash
npx convex dev --once
```

Expected: Schema pushes successfully.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(collab): update schema — add userId, collaboration tables"
```

---

### Task 4: Update trips.ts with Auth + Scoping

**Files:**
- Modify: `convex/trips.ts`

- [ ] **Step 1: Rewrite trips.ts with auth checks**

Replace the entire file:

```typescript
// convex/trips.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

// ── Queries ──

export const listTrips = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    // Get all trips where user is a collaborator
    const collabs = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const trips = await Promise.all(
      collabs.map(async (c) => {
        const trip = await ctx.db.get(c.tripId);
        return trip ? { ...trip, _role: c.role } : null;
      })
    );
    return trips
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getTrip = query({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "viewer");
    return await ctx.db.get(args.id);
  },
});

export const getCollaborators = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    const collabs = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
    // Enrich with user info
    return Promise.all(
      collabs.map(async (c) => {
        const user = await ctx.db.get(c.userId);
        return {
          ...c,
          userName: user?.name ?? "Unknown",
          userImage: user?.image ?? null,
          userEmail: user?.email ?? null,
        };
      })
    );
  },
});

// ── Mutations ──

export const createTrip = mutation({
  args: {
    countryCode: v.string(),
    countryName: v.string(),
    region: v.string(),
    capital: v.string(),
    currency: v.string(),
    language: v.string(),
    timezone: v.string(),
    iataCode: v.optional(v.string()),
    status: v.union(v.literal("planned"), v.literal("completed")),
    duration: v.number(),
    costLevel: v.string(),
    dailyBudget: v.number(),
    flightHours: v.number(),
    visaCategory: v.string(),
    visaNotes: v.optional(v.string()),
    companions: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    itinerary: v.optional(v.string()),
    budgetBreakdown: v.optional(v.string()),
    packingSuggestions: v.optional(v.string()),
    visaChecklist: v.optional(v.string()),
    highlights: v.optional(v.string()),
    accommodationTips: v.optional(v.string()),
    heroImage: v.optional(v.string()),
    dayImages: v.optional(v.string()),
    localEssentials: v.optional(v.string()),
    localGuide: v.optional(v.string()),
    carRental: v.optional(v.string()),
    seasonalGuide: v.optional(v.string()),
    isMultiCountry: v.optional(v.boolean()),
    routeTitle: v.optional(v.string()),
    legs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    // Create the trip
    const tripId = await ctx.db.insert("trips", { ...args, userId });
    // Add creator as owner collaborator
    await ctx.db.insert("tripCollaborators", {
      tripId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });
    return tripId;
  },
});

export const updateTripStatus = mutation({
  args: {
    id: v.id("trips"),
    status: v.union(v.literal("planned"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updateTripField = mutation({
  args: {
    id: v.id("trips"),
    field: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");
    const allowedFields = [
      "itinerary", "budgetBreakdown", "packingSuggestions",
      "visaChecklist", "highlights", "accommodationTips",
      "heroImage", "dayImages", "localEssentials", "localGuide",
      "carRental", "seasonalGuide", "companions",
    ];
    if (!allowedFields.includes(args.field)) {
      throw new Error(`Field "${args.field}" is not updatable`);
    }
    await ctx.db.patch(args.id, { [args.field]: args.value });
  },
});

export const updateTripMeta = mutation({
  args: {
    id: v.id("trips"),
    duration: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "editor");
    const updates: Record<string, unknown> = {};
    if (args.duration !== undefined) updates.duration = args.duration;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }
  },
});

export const deleteTrip = mutation({
  args: { id: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.id, "owner");
    // Cascade delete: messages, collaborators, invites, votes, presence
    const messages = await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const msg of messages) await ctx.db.delete(msg._id);

    const collabs = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const c of collabs) await ctx.db.delete(c._id);

    const invites = await ctx.db
      .query("tripInvites")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const inv of invites) await ctx.db.delete(inv._id);

    const votes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) => q.eq("tripId", args.id))
      .collect();
    for (const vote of votes) await ctx.db.delete(vote._id);

    const presence = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.id))
      .collect();
    for (const p of presence) await ctx.db.delete(p._id);

    await ctx.db.delete(args.id);
  },
});

// ── Messages ──

export const getMessages = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    return await ctx.db
      .query("tripMessages")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    tripId: v.id("trips"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For user messages, verify permission
    if (args.role === "user") {
      await checkTripPermission(ctx, args.tripId, "viewer");
    }
    await ctx.db.insert("tripMessages", {
      tripId: args.tripId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      userId: args.userId,
      userName: args.userName,
    });
  },
});
```

- [ ] **Step 2: Verify `npx convex dev --once` passes**

- [ ] **Step 3: Commit**

```bash
git add convex/trips.ts
git commit -m "feat(collab): add auth checks and user scoping to trips"
```

---

### Task 5: Update bookings.ts with Auth

**Files:**
- Modify: `convex/bookings.ts`

- [ ] **Step 1: Rewrite bookings.ts with auth checks**

Replace the entire file:

```typescript
// convex/bookings.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

const bookingTypeValidator = v.union(
  v.literal("flight"), v.literal("hotel"), v.literal("experience"),
  v.literal("car_rental"), v.literal("insurance"), v.literal("restaurant")
);
const bookingSourceValidator = v.union(
  v.literal("manual"), v.literal("calendar"), v.literal("api"), v.literal("email")
);
const bookingStatusValidator = v.union(
  v.literal("upcoming"), v.literal("active"), v.literal("completed"), v.literal("cancelled")
);

export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const listBookingsByTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    return await ctx.db
      .query("bookings")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .order("desc")
      .collect();
  },
});

export const listUnassignedBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return bookings.filter((b) => b.tripId === undefined);
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found");
    }
    return booking;
  },
});

export const createBooking = mutation({
  args: {
    type: bookingTypeValidator,
    source: bookingSourceValidator,
    status: bookingStatusValidator,
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
    calendarSource: v.optional(v.union(v.literal("google"), v.literal("apple"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.tripId) {
      await checkTripPermission(ctx, args.tripId, "editor");
    }
    return await ctx.db.insert("bookings", { ...args, userId });
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
    provider: v.optional(v.string()),
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
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found");
    }
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) filtered[k] = val;
    }
    await ctx.db.patch(args.id, filtered);
  },
});

export const linkBookingToTrip = mutation({
  args: {
    id: v.id("bookings"),
    tripId: v.id("trips"),
    autoMatched: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found");
    }
    await checkTripPermission(ctx, args.tripId, "editor");
    await ctx.db.patch(args.id, {
      tripId: args.tripId,
      autoMatched: args.autoMatched ?? false,
    });
  },
});

export const unlinkBookingFromTrip = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found");
    }
    await ctx.db.patch(args.id, { tripId: undefined, autoMatched: undefined });
  },
});

export const deleteBooking = mutation({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking || booking.userId !== userId) {
      throw new Error("Booking not found");
    }
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/bookings.ts
git commit -m "feat(collab): add auth checks and user scoping to bookings"
```

---

### Task 6: Update visaGuides.ts with Auth

**Files:**
- Modify: `convex/visaGuides.ts`

- [ ] **Step 1: Rewrite visaGuides.ts with auth checks**

Replace the entire file:

```typescript
// convex/visaGuides.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const listGuides = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getGuide = query({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (!guide || guide.userId !== userId) {
      throw new Error("Guide not found");
    }
    return guide;
  },
});

export const getGuideByCountry = query({
  args: { countryCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guides = await ctx.db
      .query("visaGuides")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return guides.find((g) => g.countryCode === args.countryCode) ?? null;
  },
});

export const createGuide = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("visaGuides", { ...args, userId });
  },
});

export const updateChecklist = mutation({
  args: { id: v.id("visaGuides"), checklist: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (!guide || guide.userId !== userId) {
      throw new Error("Guide not found");
    }
    await ctx.db.patch(args.id, { checklist: args.checklist });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("visaGuides"),
    status: v.union(
      v.literal("preparing"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (!guide || guide.userId !== userId) {
      throw new Error("Guide not found");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteGuide = mutation({
  args: { id: v.id("visaGuides") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const guide = await ctx.db.get(args.id);
    if (!guide || guide.userId !== userId) {
      throw new Error("Guide not found");
    }
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/visaGuides.ts
git commit -m "feat(collab): add auth checks and user scoping to visa guides"
```

---

### Task 7: Trip Invites Backend

**Files:**
- Create: `convex/tripInvites.ts`

- [ ] **Step 1: Create the invites module**

```typescript
// convex/tripInvites.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAuthUser, checkTripPermission } from "./lib/auth";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const createInvite = mutation({
  args: {
    tripId: v.id("trips"),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    invitedEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "editor");
    const inviteCode = generateInviteCode();
    const inviteId = await ctx.db.insert("tripInvites", {
      tripId: args.tripId,
      inviteCode,
      invitedEmail: args.invitedEmail,
      role: args.role,
      createdBy: userId,
      expiresAt: Date.now() + INVITE_EXPIRY_MS,
      status: "pending",
    });
    return { inviteId, inviteCode };
  },
});

export const getInviteByCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("tripInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();
    if (!invite) return null;
    if (invite.status !== "pending" || invite.expiresAt < Date.now()) {
      return null;
    }
    // Enrich with trip info
    const trip = await ctx.db.get(invite.tripId);
    return { ...invite, tripName: trip?.countryName ?? "Unknown trip" };
  },
});

export const acceptInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const invite = await ctx.db
      .query("tripInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite already used");
    if (invite.expiresAt < Date.now()) throw new Error("Invite expired");

    // Check if already a collaborator
    const existing = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", invite.tripId).eq("userId", userId)
      )
      .unique();

    if (existing) throw new Error("You're already a collaborator on this trip");

    // Add as collaborator
    await ctx.db.insert("tripCollaborators", {
      tripId: invite.tripId,
      userId,
      role: invite.role,
      joinedAt: Date.now(),
    });

    // Mark invite as accepted
    await ctx.db.patch(invite._id, { status: "accepted" });

    return invite.tripId;
  },
});

export const listTripInvites = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "editor");
    return await ctx.db
      .query("tripInvites")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const getPendingInvitesForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);
    if (!user.email) return [];
    const invites = await ctx.db
      .query("tripInvites")
      .withIndex("by_email", (q) => q.eq("invitedEmail", user.email))
      .collect();
    const pending = invites.filter(
      (i) => i.status === "pending" && i.expiresAt > Date.now()
    );
    // Enrich with trip info
    return Promise.all(
      pending.map(async (inv) => {
        const trip = await ctx.db.get(inv.tripId);
        return { ...inv, tripName: trip?.countryName ?? "Unknown" };
      })
    );
  },
});

export const revokeInvite = mutation({
  args: { id: v.id("tripInvites") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.id);
    if (!invite) throw new Error("Invite not found");
    await checkTripPermission(ctx, invite.tripId, "owner");
    await ctx.db.delete(args.id);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tripInvites.ts
git commit -m "feat(collab): add trip invites — create, accept, revoke"
```

---

### Task 8: Trip Collaborators Backend

**Files:**
- Create: `convex/tripCollaborators.ts`

- [ ] **Step 1: Create the collaborators module**

```typescript
// convex/tripCollaborators.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { checkTripPermission } from "./lib/auth";

export const updateRole = mutation({
  args: {
    tripId: v.id("trips"),
    userId: v.id("users"),
    newRole: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "owner");
    const collab = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", args.userId)
      )
      .unique();
    if (!collab) throw new Error("Collaborator not found");
    if (collab.role === "owner") throw new Error("Cannot change owner role");
    await ctx.db.patch(collab._id, { role: args.newRole });
  },
});

export const removeCollaborator = mutation({
  args: {
    tripId: v.id("trips"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "owner");
    const collab = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", args.userId)
      )
      .unique();
    if (!collab) throw new Error("Collaborator not found");
    if (collab.role === "owner") throw new Error("Cannot remove the owner");
    await ctx.db.delete(collab._id);
  },
});

export const leaveTrip = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const { userId, role } = await checkTripPermission(ctx, args.tripId, "viewer");
    if (role === "owner") throw new Error("Owner cannot leave — delete the trip instead");
    const collab = await ctx.db
      .query("tripCollaborators")
      .withIndex("by_trip_and_user", (q) =>
        q.eq("tripId", args.tripId).eq("userId", userId)
      )
      .unique();
    if (collab) await ctx.db.delete(collab._id);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tripCollaborators.ts
git commit -m "feat(collab): add collaborator management — role update, remove, leave"
```

---

### Task 9: Trip Votes Backend

**Files:**
- Create: `convex/tripVotes.ts`

- [ ] **Step 1: Create the votes module**

```typescript
// convex/tripVotes.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

export const getVotesForTrip = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    return await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) => q.eq("tripId", args.tripId))
      .collect();
  },
});

export const toggleVote = mutation({
  args: {
    tripId: v.id("trips"),
    activityId: v.string(),
    vote: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");

    // Find existing vote by this user for this activity
    const allVotes = await ctx.db
      .query("tripVotes")
      .withIndex("by_trip_and_activity", (q) =>
        q.eq("tripId", args.tripId).eq("activityId", args.activityId)
      )
      .collect();

    const existingVote = allVotes.find((v) => v.userId === userId);

    if (existingVote) {
      if (existingVote.vote === args.vote) {
        // Same vote — toggle off (remove)
        await ctx.db.delete(existingVote._id);
        return null;
      }
      // Different vote — update
      await ctx.db.patch(existingVote._id, { vote: args.vote });
      return existingVote._id;
    }

    // No existing vote — create
    return await ctx.db.insert("tripVotes", {
      tripId: args.tripId,
      activityId: args.activityId,
      userId,
      vote: args.vote,
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tripVotes.ts
git commit -m "feat(collab): add activity voting — toggle up/down"
```

---

### Task 10: Trip Presence Backend

**Files:**
- Create: `convex/tripPresence.ts`

- [ ] **Step 1: Create the presence module**

```typescript
// convex/tripPresence.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, checkTripPermission } from "./lib/auth";

const PRESENCE_TIMEOUT_MS = 60_000; // 60 seconds

export const getPresence = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    await checkTripPermission(ctx, args.tripId, "viewer");
    const now = Date.now();
    const presenceDocs = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    // Filter to active (within timeout) and enrich with user info
    const active = presenceDocs.filter(
      (p) => now - p.lastSeen < PRESENCE_TIMEOUT_MS
    );

    return Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          userId: p.userId,
          userName: user?.name ?? "Unknown",
          userImage: user?.image ?? null,
          lastSeen: p.lastSeen,
        };
      })
    );
  },
});

export const heartbeat = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const { userId } = await checkTripPermission(ctx, args.tripId, "viewer");

    const existing = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    const myPresence = existing.find((p) => p.userId === userId);

    if (myPresence) {
      await ctx.db.patch(myPresence._id, { lastSeen: Date.now() });
    } else {
      await ctx.db.insert("tripPresence", {
        tripId: args.tripId,
        userId,
        lastSeen: Date.now(),
      });
    }
  },
});

export const leave = mutation({
  args: { tripId: v.id("trips") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("tripPresence")
      .withIndex("by_trip", (q) => q.eq("tripId", args.tripId))
      .collect();

    const myPresence = existing.find((p) => p.userId === userId);
    if (myPresence) {
      await ctx.db.delete(myPresence._id);
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tripPresence.ts
git commit -m "feat(collab): add presence — heartbeat, leave, get active"
```

---

### Task 11: Frontend — Invite Accept Screen + Deep Link

**Files:**
- Create: `app/invite/[code].tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create the invite accept screen**

```typescript
// app/invite/[code].tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import { UserPlus, Check, X } from 'lucide-react-native';

export default function AcceptInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const invite = useQuery(api.tripInvites.getInviteByCode, { inviteCode: code ?? '' });
  const acceptInvite = useMutation(api.tripInvites.acceptInvite);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!code) return;
    setIsAccepting(true);
    setError(null);
    try {
      const tripId = await acceptInvite({ inviteCode: code });
      router.replace(`/trip/${tripId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept invite');
    } finally {
      setIsAccepting(false);
    }
  };

  if (invite === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (invite === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <X size={48} color={colors.danger} />
        <Text style={[styles.title, { color: colors.foreground }]}>Invite Not Found</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This invite may have expired or already been used.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <UserPlus size={48} color={colors.primary} />
      <Text style={[styles.title, { color: colors.foreground }]}>Trip Invite</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        You've been invited to join "{invite.tripName}" as {invite.role === 'editor' ? 'an editor' : 'a viewer'}.
      </Text>
      {error && (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      )}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleAccept}
        disabled={isAccepting}
      >
        {isAccepting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Check size={18} color="#FFF" />
            <Text style={styles.buttonText}>Join Trip</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={[styles.link, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, marginTop: Spacing.lg },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.md, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl },
  error: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginBottom: Spacing.md },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: Radius.lg },
  buttonText: { fontFamily: FontFamily.semibold, fontSize: FontSize.md, color: '#FFF' },
  link: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginTop: Spacing.lg },
});
```

- [ ] **Step 2: Add the invite route to _layout.tsx**

In `app/_layout.tsx`, find the Stack.Screen entries and add:

```tsx
<Stack.Screen name="invite/[code]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
```

Add it after the existing `email-connected` screen entry.

- [ ] **Step 3: Commit**

```bash
git add app/invite/[code].tsx app/_layout.tsx
git commit -m "feat(collab): add invite accept screen with deep link routing"
```

---

### Task 12: Frontend — Update Trips List

**Files:**
- Modify: `app/(tabs)/trips.tsx`

- [ ] **Step 1: Update trip card to show collaboration info**

The `listTrips` query now returns trips with `_role` field. Update the trip card rendering to show:
- A "Shared" badge when `trip._role !== 'owner'`
- The user's role label (Editor / Viewer) on shared trips

Find the trip card rendering section. After the country name/flag display, add:

```tsx
{trip._role !== 'owner' && (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
    <Text style={{ fontFamily: FontFamily.condensed, fontSize: 11, color: colors.primary, textTransform: 'uppercase' }}>
      Shared · {trip._role}
    </Text>
  </View>
)}
```

- [ ] **Step 2: Disable delete for non-owners**

In the `handleDelete` function, add a check:

```typescript
if (isOffline) return;
// Add this line:
const tripToDelete = trips?.find(t => t._id === id);
if (tripToDelete?._role !== 'owner') return;
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/trips.tsx
git commit -m "feat(collab): show shared trip badges and restrict delete to owners"
```

---

### Task 13: Frontend — Collaborator Avatars Component

**Files:**
- Create: `components/CollaboratorAvatars.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/CollaboratorAvatars.tsx
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

interface Collaborator {
  userId: string;
  userName: string;
  userImage: string | null;
  role: string;
}

interface PresenceUser {
  userId: string;
  userName: string;
  userImage: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({
  name,
  image,
  size,
  isOnline,
}: {
  name: string;
  image: string | null;
  size: number;
  isOnline?: boolean;
}) {
  const { colors } = useTheme();
  const bgColors = ['#E76F51', '#2A9D8F', '#E9C46A', '#264653', '#F4A261'];
  const colorIndex = name.length % bgColors.length;

  return (
    <View style={{ position: 'relative' }}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColors[colorIndex],
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: FontFamily.semibold,
              fontSize: size * 0.4,
              color: '#FFF',
            }}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
      {isOnline && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: '#2EAA6E',
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      )}
    </View>
  );
}

export function CollaboratorAvatars({
  collaborators,
  presenceUsers,
  maxShow = 5,
}: {
  collaborators: Collaborator[];
  presenceUsers: PresenceUser[];
  maxShow?: number;
}) {
  const { colors } = useTheme();
  const onlineIds = new Set(presenceUsers.map((p) => p.userId));
  const shown = collaborators.slice(0, maxShow);
  const overflow = collaborators.length - maxShow;

  return (
    <View style={styles.container}>
      {shown.map((c, i) => (
        <View key={c.userId} style={[styles.avatarWrapper, { marginLeft: i > 0 ? -8 : 0 }]}>
          <Avatar
            name={c.userName}
            image={c.userImage}
            size={32}
            isOnline={onlineIds.has(c.userId)}
          />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.overflow,
            { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.overflowText, { color: colors.foreground }]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

export { Avatar };

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  avatarWrapper: { borderWidth: 2, borderColor: '#FFF', borderRadius: 18 },
  overflow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 1,
  },
  overflowText: { fontFamily: FontFamily.semibold, fontSize: 11 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/CollaboratorAvatars.tsx
git commit -m "feat(collab): add CollaboratorAvatars component with presence dots"
```

---

### Task 14: Frontend — Update Trip Detail with Collaborators + Presence

**Files:**
- Modify: `app/trip/[id].tsx`

- [ ] **Step 1: Add collaborator and presence queries**

At the top of the `TripDetailScreen` component, after the existing `trip` query, add:

```typescript
import { useQuery, useMutation } from 'convex/react';
import { CollaboratorAvatars } from '@/components/CollaboratorAvatars';
```

And in the component body:

```typescript
const collaborators = useQuery(api.trips.getCollaborators, { tripId: id as Id<'trips'> });
const presenceUsers = useQuery(api.tripPresence.getPresence, { tripId: id as Id<'trips'> });
const heartbeat = useMutation(api.tripPresence.heartbeat);
const leavePresence = useMutation(api.tripPresence.leave);

// Presence heartbeat
useEffect(() => {
  if (!id) return;
  const tripId = id as Id<'trips'>;
  heartbeat({ tripId });
  const interval = setInterval(() => heartbeat({ tripId }), 30_000);
  return () => {
    clearInterval(interval);
    leavePresence({ tripId });
  };
}, [id]);
```

- [ ] **Step 2: Add collaborator avatars to the header area**

In the trip detail header section (after the country name), add:

```tsx
{collaborators && collaborators.length > 1 && (
  <View style={{ marginTop: 8 }}>
    <CollaboratorAvatars
      collaborators={collaborators}
      presenceUsers={presenceUsers ?? []}
    />
  </View>
)}
```

- [ ] **Step 3: Add "Invite" button for editors/owners**

Add an invite button that navigates to the invite screen:

```tsx
<TouchableOpacity
  onPress={() => router.push(`/trip/invite?tripId=${id}`)}
  style={{ marginLeft: 'auto' }}
>
  <UserPlus size={20} color={colors.primary} />
</TouchableOpacity>
```

Import `UserPlus` from lucide-react-native and add `useEffect` to imports.

- [ ] **Step 4: Commit**

```bash
git add app/trip/[id].tsx
git commit -m "feat(collab): add collaborator avatars, presence, and invite button to trip detail"
```

---

### Task 15: Frontend — Invite Creation Screen

**Files:**
- Create: `app/trip/invite.tsx`

- [ ] **Step 1: Create the invite screen**

```typescript
// app/trip/invite.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Share, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import { ArrowLeft, Link, Mail, UserPlus } from 'lucide-react-native';

type InviteRole = 'editor' | 'viewer';

export default function InviteScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const createInvite = useMutation(api.tripInvites.createInvite);
  const [role, setRole] = useState<InviteRole>('editor');
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleShareLink = async () => {
    setIsCreating(true);
    try {
      const { inviteCode } = await createInvite({
        tripId: tripId as Id<'trips'>,
        role,
      });
      const link = `visaatlas://invite/${inviteCode}`;
      await Share.share({ message: `Join my trip on Visa Atlas! ${link}`, url: link });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create invite');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEmailInvite = async () => {
    if (!email.trim()) return;
    setIsCreating(true);
    try {
      await createInvite({
        tripId: tripId as Id<'trips'>,
        role,
        invitedEmail: email.trim().toLowerCase(),
      });
      Alert.alert('Invite Sent', `Invite sent to ${email}`);
      setEmail('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Invite Collaborators</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Role Picker */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>Role</Text>
      <View style={styles.roleRow}>
        {(['editor', 'viewer'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRole(r)}
            style={[
              styles.roleButton,
              {
                backgroundColor: role === r ? colors.primary : colors.card,
                borderColor: role === r ? colors.primary : colors.borderSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.roleText,
                { color: role === r ? '#FFF' : colors.foreground },
              ]}
            >
              {r === 'editor' ? 'Editor' : 'Viewer'}
            </Text>
            <Text
              style={[
                styles.roleDesc,
                { color: role === r ? 'rgba(255,255,255,0.7)' : colors.textSecondary },
              ]}
            >
              {r === 'editor' ? 'Can edit trip details' : 'Can only view'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Share Link */}
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleShareLink}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Link size={18} color="#FFF" />
            <Text style={styles.actionText}>Share Invite Link</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Email Invite */}
      <View style={[styles.divider, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or invite by email</Text>
      </View>

      <View style={styles.emailRow}>
        <TextInput
          style={[
            styles.emailInput,
            { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.borderSubtle },
          ]}
          placeholder="email@example.com"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={handleEmailInvite}
          disabled={isCreating || !email.trim()}
        >
          <Mail size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  label: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  roleButton: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center' },
  roleText: { fontFamily: FontFamily.semibold, fontSize: FontSize.md },
  roleDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 2 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: Spacing.md, borderRadius: Radius.lg },
  actionText: { fontFamily: FontFamily.semibold, fontSize: FontSize.md, color: '#FFF' },
  divider: { borderTopWidth: 1, marginVertical: Spacing.xl, alignItems: 'center' },
  dividerText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginTop: -10, backgroundColor: 'transparent', paddingHorizontal: Spacing.sm },
  emailRow: { flexDirection: 'row', gap: Spacing.sm },
  emailInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  sendButton: { width: 48, height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 2: Add route to _layout.tsx**

```tsx
<Stack.Screen name="trip/invite" options={{ animation: 'slide_from_right' }} />
```

- [ ] **Step 3: Commit**

```bash
git add app/trip/invite.tsx app/_layout.tsx
git commit -m "feat(collab): add invite creation screen with link sharing and email invite"
```

---

### Task 16: Frontend — Multi-User Chat

**Files:**
- Modify: `app/chat/[tripId].tsx`

- [ ] **Step 1: Update chat to use Convex messages and show sender info**

Key changes to the chat screen:

1. Replace local `useState` messages with Convex query:
```typescript
const messages = useOfflineQuery(api.trips.getMessages, { tripId: tripId as Id<'trips'> });
```

2. Import and use `useConvexAuth` to get current user info:
```typescript
import { useConvexAuth } from 'convex/react';
import { getAuthUserId } from '@convex-dev/auth/server';
```

Actually, on the client side use `useQuery` to get current user. Add a new query to trips.ts for getting the current user:

3. Update the `sendMessage` function to persist to Convex:
```typescript
const addMessageMutation = useMutation(api.trips.addMessage);

const sendMessage = async () => {
  if (isOffline || !text || isSending) return;
  // Add user message to Convex
  await addMessageMutation({
    tripId: tripId as Id<'trips'>,
    role: 'user',
    content: text,
    userId: currentUserId,
    userName: currentUserName,
  });
  // Then call AI endpoint...
};
```

4. In the message rendering, show sender name for user messages:
```tsx
{item.role === 'user' && item.userName && (
  <Text style={{ fontFamily: FontFamily.semibold, fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>
    {item.userName}
  </Text>
)}
```

5. Use different colors for own messages vs other people's messages.

- [ ] **Step 2: Commit**

```bash
git add app/chat/[tripId].tsx
git commit -m "feat(collab): update chat for multi-user with sender names and Convex persistence"
```

---

### Task 17: Verify End-to-End

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v serifItalic
```

Expected: No new errors.

- [ ] **Step 2: Push schema to Convex**

```bash
npx convex dev --once
```

Expected: Schema deploys successfully with new tables.

- [ ] **Step 3: Test the flow**

1. Open app → sign in → create a trip → verify trip shows with "Owner" role
2. Create an invite → share the link
3. Sign in with a different account → open the invite link → accept → verify trip appears in list as "Shared"
4. Both users open the same trip → verify presence dots appear
5. One user edits itinerary → verify other user sees changes in real-time
6. Send chat messages → verify both users see all messages with sender names

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(collab): adjustments from end-to-end verification"
```

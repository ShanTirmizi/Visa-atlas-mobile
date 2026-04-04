# Collaborative Trip Planning — Design Spec

## Problem

Visa Atlas has zero collaboration features. Every trip is isolated to one user. The #1 reason travelers choose Wanderlog is real-time co-planning — couples and friend groups plan together. We need to match and exceed this with visa-aware collaboration that no competitor has.

## Prerequisites

The app currently has no user scoping — all trips are global, queries don't check auth, and no userId exists on content tables. This spec covers both user scoping and collaboration as a combined feature. Existing trip/booking/guide/message data will be wiped (confirmed as test data only).

## Decisions

- **Scope:** Combined user scoping + collaboration in one release. Clean data wipe, no migration needed.
- **Invite flow:** Both share links (deep links) and in-app email search.
- **Chat model:** Single unified thread — humans and AI in one stream.
- **Role system:** Owner / Editor / Viewer with permission matrix.
- **Conflict resolution:** Convex real-time subscriptions handle live sync. Last-write-wins for concurrent edits (acceptable for trip planning where true conflicts are rare).

## Data Model Changes

### Wipe Existing Data

Delete all documents from: `trips`, `bookings`, `visaGuides`, `tripMessages`. Keep user accounts and auth tables intact.

### Add userId to Content Tables

**trips** — Add fields:
- `userId: v.id("users")` — the trip owner
- Add index `by_user` on `[userId]`

**bookings** — Add fields:
- `userId: v.id("users")` — who created the booking
- `assignedTo: v.optional(v.id("users"))` — who's responsible for this booking (for split assignments)

**visaGuides** — Add fields:
- `userId: v.id("users")` — who created the guide

### New Tables

**tripCollaborators**
```
tripId: v.id("trips")
userId: v.id("users")
role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer"))
joinedAt: v.number()
```
- Indexes: `by_trip` on `[tripId]`, `by_user` on `[userId]`
- The owner always has a row here too (role: "owner") for uniform querying

**tripInvites**
```
tripId: v.id("trips")
inviteCode: v.string()
invitedEmail: v.optional(v.string())
role: v.union(v.literal("editor"), v.literal("viewer"))
createdBy: v.id("users")
expiresAt: v.number()
status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired"))
```
- Indexes: `by_code` on `[inviteCode]`, `by_trip` on `[tripId]`

**tripVotes**
```
tripId: v.id("trips")
activityId: v.string()
userId: v.id("users")
vote: v.union(v.literal("up"), v.literal("down"))
```
- Index: `by_trip_and_activity` on `[tripId, activityId]`

**tripPresence**
```
tripId: v.id("trips")
userId: v.id("users")
lastSeen: v.number()
```
- Index: `by_trip` on `[tripId]`
- Documents auto-expire (delete if lastSeen > 60 seconds ago)

### Extend Existing Tables

**tripMessages** — Add fields:
- `userId: v.optional(v.id("users"))` — null for AI messages, set for human messages
- `userName: v.optional(v.string())` — display name for human messages

The existing `role` field ("user" | "assistant") still distinguishes human vs AI messages.

## Auth & Permissions

### User Resolution

Every query and mutation must:
1. Call `const identity = await ctx.auth.getUserIdentity()`
2. If null, throw "Not authenticated"
3. Look up the user document via `identity.tokenIdentifier`

Create a shared helper `getAuthUser(ctx)` that does this and returns the user doc.

### Query Scoping

**listTrips** — Return trips where the user is in `tripCollaborators` (any role). This covers both owned trips and shared trips.

**getTrip** — Check that the user is in `tripCollaborators` for this trip before returning data.

**listBookings** — Return bookings where the booking's trip has the user in `tripCollaborators`, OR bookings with `userId` matching current user and no tripId.

**listGuides** — Return only guides where `userId` matches current user.

### Permission Matrix

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View trip & details | Yes | Yes | Yes |
| Edit itinerary/fields | Yes | Yes | No |
| Add/edit bookings | Yes | Yes | No |
| Delete trip | Yes | No | No |
| Invite collaborators | Yes | Yes | No |
| Remove collaborators | Yes | No | No |
| Change collaborator roles | Yes | No | No |
| Vote on activities | Yes | Yes | Yes |
| Send chat messages | Yes | Yes | Yes |

Create a helper `checkTripPermission(ctx, tripId, requiredRole)` that verifies the user's role meets the minimum required level (viewer < editor < owner).

## Invite Flow

### Share Link

1. Owner/editor taps "Invite" on trip detail screen
2. Selects role: Editor or Viewer
3. System generates a `tripInvite` with a random `inviteCode` (nanoid, 12 chars)
4. Deep link generated: `visaatlas://invite/{inviteCode}`
5. User shares via native share sheet (WhatsApp, iMessage, etc.)
6. Recipient opens link → app opens → if not logged in, redirects to sign-in first → then accepts invite
7. System creates `tripCollaborator` row, marks invite as accepted

### Email Invite

1. Owner/editor taps "Invite by email"
2. Types email address, selects role
3. System creates a `tripInvite` with `invitedEmail` set
4. If email matches an existing user → show in-app notification (query `tripInvites` where `invitedEmail` matches current user's email)
5. If no matching user → they'll see pending invites when they sign up with that email
6. User accepts → same flow as share link

### Invite Expiry

Invites expire after 7 days. A scheduled function (cron) runs daily to mark expired invites.

## Trip Chat (Unified)

### Architecture

Single chat thread per trip. The existing `tripMessages` table is reused with the new `userId` and `userName` fields.

**Message types:**
- Human message: `role: "user"`, `userId` set, `userName` set
- AI message: `role: "assistant"`, `userId` null

**Sending a message:**
1. User sends text → mutation creates `tripMessage` with their userId and userName
2. All collaborators see it instantly via Convex subscription
3. If the message is directed at the AI (all messages go to AI for now), the AI response is also added to the thread
4. AI has full context of the human conversation

**Permissions:** All collaborators (owner, editor, viewer) can send messages.

## Activity Voting

### How It Works

The itinerary is stored as a JSON string on the trip. Each activity within a day can be identified by a composite key: `day-{dayNumber}-{timeSlot}` (e.g., `day-1-morning`, `day-2-evening`).

**Voting flow:**
1. On the itinerary tab, each activity shows upvote/downvote buttons with counts
2. User taps up or down → mutation creates/updates a `tripVote` document
3. Vote counts are derived by querying `tripVotes` filtered by tripId + activityId
4. Tapping the same vote again removes it (toggle behavior)

**Display:** Show vote count and who voted (small avatar dots next to the count).

## Visa-Aware Collaboration

### Per-Collaborator Visa Check

When a collaborator joins a trip:
1. Look up the trip's destination `countryCode`
2. Look up the collaborator's nationality (from user profile, if set)
3. Cross-reference with `data/visaData.ts` to determine visa requirements
4. Display on the trip's collaborator list: "Visa free", "e-Visa required", "Visa required", or "Set nationality to check"

### User Nationality

Add an optional `nationality` field to the user profile. Users can set this in Settings. If not set, show a prompt to set it when they join a collaborative trip.

## Presence Indicators

### How It Works

When a user is viewing a trip detail screen:
1. On mount: upsert a `tripPresence` document with current timestamp
2. Every 30 seconds: update `lastSeen` timestamp
3. On unmount: delete the presence document

**Display:** Show small avatar circles at the top of the trip detail screen for collaborators currently present (lastSeen within 60 seconds).

**Cleanup:** A query filters out stale presence docs (> 60 seconds old). No cron needed — stale entries are simply ignored by the query and naturally overwritten on next visit.

## UI Changes

### Trip Detail Screen
- Add "Collaborators" section showing avatars + roles
- Add "Invite" button (for owner/editor)
- Add presence dots at the top
- Add vote buttons on itinerary activities
- Chat becomes multi-user with sender names/avatars

### Trips List Screen
- Show small collaborator count badge on shared trips
- Show "Shared with you" label on trips you don't own

### New Screens
- **Invite screen** — role picker + share link + email input
- **Collaborator management** — list collaborators, change roles, remove
- **Pending invites** — show invites waiting for the current user (in-app notification)
- **Accept invite** — screen shown when opening a deep link invite

### Settings
- Add "Nationality" field for visa-aware collaboration

## Offline Mode Integration

The offline mode (already built) needs to handle collaborative data:
- Cache collaborative trips the same way as owned trips
- Offline mutations queue works the same — intent-based, replayed on reconnect
- Presence indicators are online-only (no caching needed)
- Votes can be queued offline

## New Dependencies

- `nanoid` or similar — for generating invite codes (or use `crypto.randomUUID()`)

## Files to Create

```
convex/tripCollaborators.ts      — CRUD + permission helpers
convex/tripInvites.ts            — Invite creation, acceptance, expiry
convex/tripVotes.ts              — Vote create/toggle/query
convex/tripPresence.ts           — Presence upsert/query
convex/lib/auth.ts               — getAuthUser() and checkTripPermission() helpers
app/invite/[code].tsx            — Accept invite screen
app/trip/collaborators.tsx       — Manage collaborators screen
app/trip/invite.tsx              — Invite flow screen
components/CollaboratorAvatars.tsx — Presence dots + avatar row
components/ActivityVote.tsx      — Vote buttons for itinerary items
components/InviteBanner.tsx      — Pending invite notification
```

## Files to Modify

```
convex/schema.ts                 — Add new tables, add userId to existing tables
convex/trips.ts                  — Add auth checks, scope by user/collaborator
convex/bookings.ts               — Add auth checks, scope queries
convex/visaGuides.ts             — Add auth checks, scope queries
convex/tripMessages.ts           — Add userId/userName fields
app/(tabs)/trips.tsx             — Show shared trips, collaborator badges
app/trip/[id].tsx                — Add collaborators section, presence, voting
app/chat/[tripId].tsx            — Multi-user chat with names/avatars
app/more/settings.tsx            — Add nationality field
app/_layout.tsx                  — Add invite deep link handling
```

## Out of Scope

- Push notifications for invites/messages (separate feature, needs expo-notifications)
- Per-person packing lists (can build after core collaboration works)
- Booking assignment UI (data model supports it via `assignedTo`, UI deferred)
- Read receipts in chat
- Typing indicators in chat

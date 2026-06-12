import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;
type AnyAuthCtx = QueryCtx | MutationCtx | ActionCtx;

const roleLevels: Record<string, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/**
 * Returns the authenticated user's Id<"users">, or throws "Not authenticated".
 *
 * Works for queries, mutations, and actions — only depends on `getAuthUserId`,
 * which doesn't need `ctx.db`.
 */
export async function requireAuth(ctx: AnyAuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/**
 * Returns the full Doc<"users"> for the authenticated user, or throws if
 * not authenticated or the user document is missing.
 */
export async function requireAuthUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const userId = await requireAuth(ctx);
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error("User not found");
  }
  return user;
}

/**
 * Verifies the authenticated user is a collaborator on `tripId` with at least
 * `requiredRole` access. Throws on missing access or insufficient role.
 *
 * Returns `{ userId, role }`.
 *
 * NOTE: The `tripCollaborators` table is added in Task 3. TypeScript errors
 * here are expected until the schema is updated.
 */
export async function checkTripPermission(
  ctx: AuthCtx,
  tripId: Id<"trips">,
  requiredRole: "viewer" | "editor" | "owner",
): Promise<{ userId: Id<"users">; role: string }> {
  const userId = await requireAuth(ctx);

  const collaborator = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip_and_user", (q) =>
      q.eq("tripId", tripId).eq("userId", userId),
    )
    .unique();

  if (collaborator === null) {
    throw new Error("You don't have access to this trip");
  }

  const requiredLevel = roleLevels[requiredRole] ?? 0;
  const actualLevel = roleLevels[collaborator.role] ?? 0;

  if (actualLevel < requiredLevel) {
    throw new Error(
      `Requires ${requiredRole} role, you have ${collaborator.role}`,
    );
  }

  return { userId, role: collaborator.role as string };
}

/**
 * Token-gated PUBLIC access — the documented exception to the
 * requireAuth-everywhere rule (see CLAUDE.md "Convex Security Guidelines").
 * The share token IS the authorization: a 20-char CSPRNG capability string
 * (~2^116 guesses) that any trip editor can revoke. Every public
 * share-surface function (convex/tripShares.ts getSharedTrip /
 * recordShareView) MUST resolve access through this helper and must only
 * return / touch allowlisted data (see convex/lib/sharePayload.ts).
 * Returns the active share + its non-deleted trip, or null (never throws —
 * the web page turns null into a branded 404).
 */
export async function requireShareToken(
  ctx: AuthCtx,
  token: string,
): Promise<{ share: Doc<"tripShares">; trip: Doc<"trips"> } | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  const share = await ctx.db
    .query("tripShares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (share === null || share.revokedAt !== undefined) return null;
  const trip = await ctx.db.get(share.tripId);
  if (trip === null || trip.deletedAt !== undefined) return null;
  return { share, trip };
}

/**
 * Returns true if `userId` is a collaborator on `tripId`, false otherwise.
 */
export async function isTripCollaborator(
  ctx: AuthCtx,
  tripId: Id<"trips">,
  userId: Id<"users">,
): Promise<boolean> {
  const collaborator = await ctx.db
    .query("tripCollaborators")
    .withIndex("by_trip_and_user", (q) =>
      q.eq("tripId", tripId).eq("userId", userId),
    )
    .unique();

  return collaborator !== null;
}

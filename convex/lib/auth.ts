import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

const roleLevels: Record<string, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/**
 * Returns the authenticated user's Id<"users">, or throws "Not authenticated".
 */
export async function requireAuth(ctx: AuthCtx): Promise<Id<"users">> {
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

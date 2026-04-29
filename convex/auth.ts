import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      // Google OIDC userinfo returns a `picture` URL — pull it through into
      // the users table's `image` field so we can render it in the app.
      // Apple does NOT expose a profile photo, so there's no equivalent there.
      profile: (googleInfo: any) => ({
        id: googleInfo.sub,
        name: googleInfo.name ?? undefined,
        email: googleInfo.email,
        image: googleInfo.picture ?? undefined,
      }),
    }),
    Apple({
      profile: (appleInfo: any) => {
        const name = appleInfo.user
          ? `${appleInfo.user.name?.firstName ?? ""} ${appleInfo.user.name?.lastName ?? ""}`.trim()
          : undefined;
        return {
          id: appleInfo.sub,
          name: name || undefined,
          email: appleInfo.email,
        };
      },
    }),
    Password({
      // Email verification is decoupled from sign-up so users can land in
      // the app immediately. The "Verify your email" affordance lives in
      // settings and runs against a separate verification flow.
      reset: ResendOTPPasswordReset,
    }),
  ],
  callbacks: {
    // Allow mobile deep link redirects (exp://, visaatlas://)
    // Fallback: if the session-stored redirectTo is missing (a rough edge in
    // @convex-dev/auth 0.0.91 where the OAuth state doesn't always preserve
    // redirectTo across the Google round-trip), land on the app scheme so the
    // dev client intercepts and the auth session can finish.
    async redirect({ redirectTo }) {
      if (redirectTo && (redirectTo.startsWith("visaatlas://") || redirectTo.startsWith("exp://"))) {
        return redirectTo;
      }
      return "visaatlas://";
    },
    // Override the default createOrUpdateUser to gracefully handle the
    // "orphan account" case: if an account record points to a userId
    // whose user doc has been deleted (typical in dev / wipe-and-retry
    // workflows), the default impl tries to patch a nonexistent doc and
    // throws "Update on nonexistent document ID ...". We treat that as a
    // signal to insert a fresh user instead.
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) {
        const existing = await ctx.db.get(existingUserId);
        if (existing) {
          await ctx.db.patch(existingUserId, profile);
          return existingUserId;
        }
        // Orphan — fall through to insert a new user.
      }
      return await ctx.db.insert("users", profile);
    },
  },
});

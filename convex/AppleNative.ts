/**
 * Native Apple Sign In via ID-token verification.
 *
 * The iOS app uses `expo-apple-authentication` to show the system Apple
 * Sign-In sheet, which returns a signed identity token (a JWT). The mobile
 * client passes that token to `signIn('apple-native', { idToken, name? })`,
 * and this provider verifies it server-side against Apple's JWKS, then
 * looks up or creates the matching Convex user.
 *
 * No Services ID, no `.p8` private key, no Vercel/Convex callback URL —
 * Apple's public keys are all we need to trust the ID token.
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  createAccount,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

// The bundle identifier embedded in the ID token's `aud` claim. Apple signs
// the token specifically for this audience, so verifying against it stops
// tokens issued for any other app from being replayed against ours.
const BUNDLE_ID = "com.tirmazilabs.visaatlas";

// Apple publishes its rotating signing keys here; `jose` caches them and
// auto-refreshes on `kid` rotation, so we never deal with key management.
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

export const AppleNative = ConvexCredentials({
  id: "apple-native",
  authorize: async (credentials, ctx) => {
    const idToken = credentials?.idToken;
    if (typeof idToken !== "string" || idToken.length === 0) {
      throw new Error("Missing Apple identity token");
    }

    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: "https://appleid.apple.com",
      audience: BUNDLE_ID,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("Apple identity token missing subject");
    }

    const email =
      typeof payload.email === "string" ? payload.email : undefined;

    // Apple only sends the user's name on the FIRST sign-in, and only via
    // the client (not the ID token). The mobile client forwards it as a
    // separate `name` credential when present.
    const name =
      typeof credentials?.name === "string" && credentials.name.length > 0
        ? credentials.name
        : undefined;

    const existing = await retrieveAccount(ctx, {
      provider: "apple-native",
      account: { id: payload.sub },
    });

    if (existing) {
      return { userId: existing.user._id };
    }

    // Apple's `email_verified` claim is always true for Apple-issued
    // identities, so linking by verified email is safe — a user who
    // previously signed up with the same email via Google or password
    // will land on their existing account instead of getting a duplicate.
    const profile: Record<string, string> = {};
    if (email) profile.email = email;
    if (name) profile.name = name;

    const created = await createAccount(ctx, {
      provider: "apple-native",
      account: { id: payload.sub },
      profile,
      shouldLinkViaEmail: email !== undefined,
    });

    return { userId: created.user._id };
  },
});

import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth } from "./lib/auth";
import { Resend as ResendAPI } from "resend";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

const RESEND_KEY = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
const RESEND_FROM =
  process.env.REMINDER_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ??
  process.env.AUTH_EMAIL_FROM ??
  "Visa Atlas <onboarding@resend.dev>";

// 10-minute code lifetime.
const CODE_TTL_MS = 10 * 60 * 1000;
// A 6-digit code (10^6 space) is enumerable without a guess limit — invalidate
// the code after this many wrong attempts so brute force can't run to completion.
const MAX_VERIFY_ATTEMPTS = 5;
// Minimum gap between "Send code" requests, to stop email-bombing the user
// (and burning Resend quota) via a hammered public action.
const RESEND_COOLDOWN_MS = 60 * 1000;

/** Generates a fresh 6-digit code, stores it, and emails it via Resend.
 *  Public action — call from the mobile when the user taps "Send code". */
export const sendVerificationCode = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    | { status: "sent" | "alreadyVerified" | "noEmail" | "sendFailed" }
    | { status: "cooldown"; retryInSeconds: number }
  > => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.runQuery(internal.emailVerification._getUser, {
      userId,
    });
    if (!user) throw new Error("User not found");
    if (user.emailVerificationTime) {
      return { status: "alreadyVerified" };
    }
    if (!user.email) {
      return { status: "noEmail" };
    }

    // CSPRNG, not Math.random — the code is a short-lived bearer secret.
    // Same RandomReader pattern as convex/ResendOTP.ts.
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const code = generateRandomString(random, "0123456789", 6);
    const stored: { stored: true } | { stored: false; waitMs: number } =
      await ctx.runMutation(internal.emailVerification._storeCode, {
        userId,
        code,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
    if (!stored.stored) {
      // A code went out moments ago — don't send another email yet.
      return {
        status: "cooldown",
        retryInSeconds: Math.max(1, Math.ceil(stored.waitMs / 1000)),
      };
    }

    if (!RESEND_KEY) {
      throw new Error(
        "RESEND_API_KEY is not set. Configure it on Convex with `npx convex env set RESEND_API_KEY <key>`.",
      );
    }
    const resend = new ResendAPI(RESEND_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [user.email],
      subject: "Verify your Visa Atlas email",
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`,
    });
    if (error) {
      // Log the provider detail for debugging, but never throw it — the
      // client renders thrown action messages verbatim, and Resend errors
      // leak provider internals (sandbox-mode rejection, request IDs).
      console.error("Resend send failed:", error.message ?? error);
      // The code row was stored before the send; clear it so the user's
      // retry isn't blocked by a cooldown for an email that never arrived.
      await ctx.runMutation(internal.emailVerification._clearCodes, { userId });
      return { status: "sendFailed" };
    }
    return { status: "sent" };
  },
});

/** Internal — read user fields needed by the action. */
export const _getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ?? null,
      emailVerificationTime: user.emailVerificationTime ?? null,
    };
  },
});

/** Internal — replace any existing code for this user with a fresh one.
 *  Enforces the resend cooldown: if a code was issued less than
 *  `RESEND_COOLDOWN_MS` ago, nothing is stored and the remaining wait is
 *  returned so the action can skip the email send. */
export const _storeCode = internalMutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ stored: true } | { stored: false; waitMs: number }> => {
    const existing = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const newest = existing.reduce<(typeof existing)[number] | null>(
      (acc, e) => (acc === null || e._creationTime > acc._creationTime ? e : acc),
      null,
    );
    if (newest !== null) {
      const elapsed = Date.now() - newest._creationTime;
      if (elapsed < RESEND_COOLDOWN_MS) {
        return { stored: false, waitMs: RESEND_COOLDOWN_MS - elapsed };
      }
    }
    for (const e of existing) await ctx.db.delete(e._id);
    await ctx.db.insert("emailVerificationCodes", args);
    return { stored: true };
  },
});

/** Internal — drop any stored codes for this user. Used when the email
 *  provider rejects the send, so the cooldown doesn't block a retry for a
 *  code that never reached the inbox. */
export const _clearCodes = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
  },
});

/** Public — verify the code the user typed. On success, sets the user's
 *  `emailVerificationTime`.
 *
 *  Failure paths RETURN a structured result instead of throwing: a throw
 *  would roll back the whole mutation transaction, including the
 *  brute-force attempt counter we need to persist on every wrong guess.
 *  After `MAX_VERIFY_ATTEMPTS` wrong guesses the code is invalidated. */
export const verifyCode = mutation({
  args: { code: v.string() },
  handler: async (
    ctx,
    { code },
  ): Promise<
    | { verified: true }
    | {
        verified: false;
        reason: "noCode" | "expired" | "tooManyAttempts" | "invalid";
        attemptsLeft?: number;
      }
  > => {
    const userId = await requireAuth(ctx);
    const records = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (records.length === 0) {
      return { verified: false, reason: "noCode" };
    }
    const record = records[0];
    if (record.expiresAt < Date.now()) {
      await ctx.db.delete(record._id);
      return { verified: false, reason: "expired" };
    }
    if (record.code !== code.trim()) {
      const attempts = (record.attempts ?? 0) + 1;
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        await ctx.db.delete(record._id);
        return { verified: false, reason: "tooManyAttempts" };
      }
      await ctx.db.patch(record._id, { attempts });
      return {
        verified: false,
        reason: "invalid",
        attemptsLeft: MAX_VERIFY_ATTEMPTS - attempts,
      };
    }
    await ctx.db.patch(userId, { emailVerificationTime: Date.now() });
    await ctx.db.delete(record._id);
    return { verified: true };
  },
});

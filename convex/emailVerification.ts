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

const RESEND_KEY = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
const RESEND_FROM =
  process.env.REMINDER_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ??
  process.env.AUTH_EMAIL_FROM ??
  "Visa Atlas <onboarding@resend.dev>";

// 10-minute code lifetime.
const CODE_TTL_MS = 10 * 60 * 1000;

/** Generates a fresh 6-digit code, stores it, and emails it via Resend.
 *  Public action — call from the mobile when the user taps "Send code". */
export const sendVerificationCode = action({
  args: {},
  handler: async (ctx): Promise<{ status: "sent" | "alreadyVerified" | "noEmail" }> => {
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

    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    await ctx.runMutation(internal.emailVerification._storeCode, {
      userId,
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
    });

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
      throw new Error(`Resend rejected the email: ${error.message ?? "unknown error"}`);
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

/** Internal — replace any existing code for this user with a fresh one. */
export const _storeCode = internalMutation({
  args: {
    userId: v.id("users"),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
    await ctx.db.insert("emailVerificationCodes", args);
  },
});

/** Public — verify the code the user typed. On success, sets the user's
 *  `emailVerificationTime`; on failure, throws with a friendly message. */
export const verifyCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireAuth(ctx);
    const records = await ctx.db
      .query("emailVerificationCodes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (records.length === 0) {
      throw new Error("Send a code first.");
    }
    const record = records[0];
    if (record.expiresAt < Date.now()) {
      await ctx.db.delete(record._id);
      throw new Error("Code expired. Send a new one.");
    }
    if (record.code !== code.trim()) {
      throw new Error("Invalid code. Check your email and try again.");
    }
    await ctx.db.patch(userId, { emailVerificationTime: Date.now() });
    await ctx.db.delete(record._id);
    return { verified: true };
  },
});

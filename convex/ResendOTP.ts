import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

// Match the working subscription-tracker setup. Reads RESEND_API_KEY first
// (the conventional Resend name, also what subscription-tracker has set),
// falls back to AUTH_RESEND_KEY for back-compat. From-address tries the
// standard names before our auth-prefixed one, with a final fallback to
// Resend's onboarding sandbox (works without a verified domain — we don't
// have visaatlas.app verified yet).
const RESEND_KEY =
  process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
const RESEND_FROM =
  process.env.REMINDER_FROM_EMAIL
  ?? process.env.RESEND_FROM_EMAIL
  ?? process.env.AUTH_EMAIL_FROM
  ?? "Visa Atlas <onboarding@resend.dev>";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: RESEND_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    await resend.emails.send({
      from: RESEND_FROM,
      to: [email],
      subject: "Verify your email for Visa Atlas",
      text: `Your verification code is: ${token}`,
    });
  },
});

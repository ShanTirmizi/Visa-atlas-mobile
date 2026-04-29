import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

const RESEND_KEY =
  process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
const RESEND_FROM =
  process.env.REMINDER_FROM_EMAIL
  ?? process.env.RESEND_FROM_EMAIL
  ?? process.env.AUTH_EMAIL_FROM
  ?? "Visa Atlas <onboarding@resend.dev>";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
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
      subject: "Reset your Visa Atlas password",
      text: `Your password reset code is: ${token}`,
    });
  },
});

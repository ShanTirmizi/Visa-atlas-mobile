# Things to do before production

Security + hardening punch list from the audit done before App Store submission. Items are grouped by severity. Tick the box when done.

The auth fundamentals are right — every public Convex function gates on `requireAuth` / `checkTripPermission`, ownership is verified before patching, sessions live in iOS Keychain via `SecureStore`. What's left is hardening.

---

## Critical — block App Store submission until fixed

- [ ] **Invite-code enumeration**
  - **Where:** [convex/tripInvites.ts:44](convex/tripInvites.ts:44) `getInviteByCode` is unauthenticated, AND [convex/tripInvites.ts:7](convex/tripInvites.ts:7) `generateInviteCode()` uses `Math.random()` over `[A-Za-z0-9]{12}`.
  - **Impact:** The unauth lookup is intentional (so invitees can preview a trip before signing in), but combined with a non-crypto RNG and no rate limiting, an attacker can scan for valid invites and read trip metadata (`tripId`, `countryName`, inviter info).
  - **Fix:** Switch the generator to `crypto.getRandomValues` (the same library `convex/ResendOTP.ts` already uses via `@oslojs/crypto`). Add a per-IP throttle on `getInviteByCode` lookups (5/min is plenty for legitimate use). Bump code length to 16 if you want extra margin.

- [ ] **Message spoofing in collaborative trip chats**
  - **Where:** [convex/trips.ts:302](convex/trips.ts:302) `addMessage` accepts `userId: v.optional(v.id("users"))` and `userName: v.optional(v.string())` as client arguments.
  - **Impact:** Any authenticated user can post a message into a shared trip chat with another user's `userId` / `userName` attached. Render-time the bubble shows up as if that other user said it. Trust violation in collaborative trips.
  - **Fix:** Derive `userId` server-side from `requireAuth(ctx)` and ignore the client-supplied value when `role === 'user'`. For `role === 'assistant'`, drop `userId` entirely and force `userName: 'Visa Atlas'`. Update the client to stop passing these.

- [ ] **Unbounded user input flowing into LLM prompts**
  - **Where:** [convex/trips.ts:71-108](convex/trips.ts:71) (`createTrip` fields like `itinerary`, `budgetBreakdown`, `visaChecklist`, `highlights`, `accommodationTips`), [convex/trips.ts:306](convex/trips.ts:306) `addMessage` content, [convex/visaGuides.ts:139](convex/visaGuides.ts:139) `addGuideMessage` content. All `v.string()` with no max length.
  - **Impact:** A malicious user submits a 5MB string that gets piped into the Vercel `/api/trip-chat`, `/api/visa-chat`, etc. — direct OpenAI cost-bomb / token DoS.
  - **Fix:** Cap user-provided strings at the validator level. `v.string()` with a length check via a custom validator, or validate inside the handler (`if (args.content.length > 4000) throw …`). Suggested limits: chat content 4 000 chars, itinerary fields 16 000.

---

## Important — fix before real users sign up

- [ ] **OAuth tokens stored as plaintext in DB**
  - **Where:** [convex/emailAccounts.ts:31-63](convex/emailAccounts.ts:31) `upsertAccount` writes `accessToken`, `refreshToken`, `tokenExpiry` as plain string columns.
  - **Impact:** Convex encrypts at rest, but a backup leak / admin compromise / accidental export gives an attacker indefinite Gmail / Outlook inbox access for every linked user — not just an app session.
  - **Fix:** Encrypt the tokens client-side before sending (KMS / per-user key derived from auth subject), or move them out of Convex into a secrets manager (1Password Connect, AWS Secrets Manager, Doppler). At minimum, wrap them with a server-side encryption helper that uses a key from `process.env`.

- [ ] **No rate limit on OTP / password-reset sends**
  - **Where:** [convex/emailVerification.ts:25](convex/emailVerification.ts:25) `sendVerificationCode`, [convex/ResendOTP.ts](convex/ResendOTP.ts), [convex/ResendOTPPasswordReset.ts](convex/ResendOTPPasswordReset.ts).
  - **Impact:** A user (or scripted attacker) can hammer "resend" and burn your Resend email quota / get the domain rate-limited / spam target inboxes.
  - **Fix:** Add an `otpRateLimits` table keyed by `userId` (or `email` for forgot-password) with `lastSentAt` and `count`. Reject sends within a 30-second cooldown and cap at 3 per 15 minutes. Convex's TTL-style cleanup pattern works well here.

- [ ] **Error copy enables account enumeration**
  - **Where:** [convex/emailVerification.ts:110-120](convex/emailVerification.ts:110), [convex/tripInvites.ts:77-79](convex/tripInvites.ts:77), and the sign-in error paths.
  - **Impact:** Distinct messages for "user not found" vs. "wrong password" vs. "code expired" vs. "code not yet sent" let an attacker probe whether a given email is registered.
  - **Fix:** Collapse to generic copy — "Invalid email or password", "Couldn't verify the code". Keep distinct codes only in server logs for debugging.

---

## Nice to have — polish before scale

- [ ] **Surface a sign-out button that revokes server session**, not just clears local. `useAuthActions().signOut()` already does this; just make sure no path simply resets local state.

- [ ] **Add a Convex `userProfiles` cleanup mutation** when a user deletes their account, so orphan profiles don't accumulate.

- [ ] **Audit `console.warn` paths in production builds** — strip them via Babel plugin (`transform-remove-console`) or wrap in `if (__DEV__)`. They're already PII-free per the audit, but logs in TestFlight builds aren't great.

- [ ] **CSP / cert pinning on the Vercel API endpoints** (`/api/trip-chat`, `/api/scan-booking`, etc.) — these are public and accept anything. Add an HMAC signed by the Convex JWT so only authenticated app calls succeed.

- [ ] **Convex schema length caps** — `v.string()` should generally be replaced with a custom validator that bounds length. Apply across `convex/trips.ts`, `convex/bookings.ts`, `convex/visaGuides.ts`.

- [ ] **Privacy-policy + Terms must be reachable from the App Store listing** — they exist at `/more/privacy-policy` and `/more/terms` in-app, but the App Store reviewer needs hosted URLs (Apple won't accept in-app-only).

- [ ] **Penetration test pass** before public launch — at minimum run a session of `OWASP ZAP` against the Vercel endpoints, and pay someone competent to look at the auth flow. The above is what I caught in a desk review; a focused tester will find more.

---

## What's already good (don't regress)

- All public Convex functions gate on `requireAuth` / `checkTripPermission`. No exceptions found.
- Trip collaborator model (viewer / editor) is consistently enforced on writes.
- `userId` is never accepted as an authorization argument — it's always derived server-side.
- iOS sessions live in Keychain via `SecureStore`, with AsyncStorage fallback only on simulator.
- `convex/http.ts` only mounts auth routes — no custom open endpoints to attack.
- No PII in `console.*` logs.
- API endpoints in `constants/api.ts` and Convex URLs in `app.json` / `eas.json` are public-by-design and intended to ship.

---

**Rough estimate to clear Critical + Important:** 5–6 hours of focused work. The Critical block alone is 2–3 hours.

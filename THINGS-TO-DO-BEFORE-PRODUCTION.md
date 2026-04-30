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

- [ ] **Verify a Resend sending domain so verification emails can ship to non-owner addresses**
  - **Where:** [convex/emailVerification.ts:14-18](convex/emailVerification.ts:14) — `RESEND_FROM` defaults to `Visa Atlas <onboarding@resend.dev>`, which is Resend's shared sandbox domain. In sandbox mode, Resend rejects any recipient that isn't the account owner's verified email. The error surfaces to users as a giant raw stack trace (see [components/settings/VerifyEmailSheet.tsx](components/settings/VerifyEmailSheet.tsx)) when they tap "Send code".
  - **Impact:** Every real signup that isn't the Resend account owner sees a broken verification flow on the very first interaction. Currently mitigated by graying out the "Verify your email" row in `app/more/settings.tsx` with a "Coming soon" label — but that row needs to come back before launch.
  - **Fix:**
    1. Buy / pick the production domain (e.g. `visaatlas.app`).
    2. Add it at https://resend.com/domains and add the SPF / DKIM / DMARC / return-path DNS records at the registrar.
    3. Once verified, set the Convex env var: `npx convex env set RESEND_FROM_EMAIL "Visa Atlas <noreply@yourdomain.com>"`. The action already reads from this env var, no code change needed.
    4. Re-enable the verify-email row in `app/more/settings.tsx` (remove `disabled` prop, restore `onPress={() => verifyEmailRef.current?.open()}`, change `value` back to `"Unverified"`).
    5. Wrap the Resend send in a try/catch in `convex/emailVerification.ts` so the user-facing error is a friendly "Couldn't send code, try again" rather than a raw Resend message.

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

---

## Streaming trip generation (post-2026-04-30)

Follow-ups collected during the streaming-trip-generation feature build (branch `feat/stream-trip-generation`). None block the feature shipping; all are quality / hardening / cost optimizations.

### Convex backend

- [ ] **Add `visaCategory` patching** — currently the streaming flow leaves `trip.visaCategory` as `""` from the stub. The visa-bundle stream returns it but `convex/tripGeneration.ts:visaTransform` only patches `visaNotes` and `visaChecklist`. Either extend `SECTION_FIELD_MAP` to include `visaCategory` or add a one-off patch via `_patchTripField`.

- [ ] **De-duplicate image fetch** — `fetchAndPatchImages` fires twice (after Day 1, then after itinerary completion). The second call overwrites the first. Optimize to either skip the first call when the itinerary is small, or use a single call with a known-good day-list cutoff.

- [ ] **Anthropic concurrency tier-1 ceiling** — running 5 parallel section calls puts us at the tier-1 limit. Two simultaneous trips will queue or 429. Mitigations: (a) bump tier when traffic warrants, (b) add a 1-retry-with-backoff in `streamAnthropic` for 429s, (c) jitter the section calls slightly so the cache prefix lands first.

- [ ] **Country-level visa cache** — visa requirements for `(destinationCode, passportCode)` don't change per-user. Cache in a `visaCache` Convex table to avoid regenerating across users. Spec mentioned this as a cost mitigation; deferred from v1 because the cross-user data structure needs separate design.

- [ ] **Surface `ANTHROPIC_API_KEY not set` more gracefully** — currently the action calls `failGeneration` with that reason. The user just sees the failed-trip screen with a generic "try again" message. Worth a distinct "service config issue" UX or alerting.

- [ ] **`retrySection` JSON-parse-failure clears `failedSections` anyway** — the catch blocks in `retrySection`'s onDone (`convex/tripGeneration.ts` around the visa/tips bundle branches) swallow JSON parse failures and still call `_clearFailedSection`, marking retry as resolved without writing content. Add early `return` inside those `catch` blocks so the section stays in `failedSections` if parse fails.

- [ ] **Per-call model override in `streamAnthropic`** — currently the model is a hardcoded constant `MODEL = "claude-sonnet-4-6"` in `convex/lib/anthropicStream.ts`. Add `model?: string` to `StreamOptions` so per-section model selection (e.g. Haiku for highlights/tips) is possible without editing the lib.

- [ ] **Sanitize free-form input fields before interpolating into prompts** — `convex/lib/anthropicStream.ts:buildSystemPrompt` interpolates user-supplied `countryName`, `interests`, `companions`, etc. directly. Strip newlines + length-cap each field at the call site (`runGenerationStream`) to harden against accidental or malicious prompt injection.

- [ ] **SSE separator robustness** — the SSE parser in `convex/lib/anthropicStream.ts:streamAnthropic` splits on `\n\n` only. Works against the Anthropic API today (LF-only on the wire) but a CRLF-rewriting proxy could break it. Switch to `buffer.split(/\r?\n\r?\n/)` for defensiveness.

### Frontend

- [ ] **DayDeck streaming cursor only fires when partial-JSON parsing exists** — `getStreamingDayIndex(trip)` returns `parsed.length` (count of *completed* days), so the cursor never points at a card that exists in the deck under the current emit-day-on-completion parser. Two options: (a) implement partial-JSON parsing in the itinerary stream so partial days appear in the deck with the cursor on the streaming activity, or (b) change the helper to return `parsed.length - 1` (most-recently-completed day) and reframe the cursor as "this day's content is still arriving."

- [ ] **`NextTripHero` (featured trip) lacks the generating-state visual** — `TripRow` got the placeholder hero + GENERATING pill + progress strip, but the featured hero on the trips home didn't. Audit `components/trips/NextTripHero.tsx` (or wherever it lives) for the same treatment.

- [ ] **`TripFailedScreen` is centered + non-scrollable** — the back button + TopSafeAreaBlur are added, but if the layout ever needs to scroll (e.g. additional debug info), the blur + the central content need to be reconciled.

- [ ] **`SectionRetryCard` doesn't surface the retry being in-flight on the trip detail at the section level** — the card itself shows "Retrying..." but the rest of the screen (the progress strip, tab dots) doesn't reflect the in-flight state. Probably fine, but worth a UX pass once we see real failures.

- [ ] **Tab dot indicators for `localEssentials` failure** — `getTabDotIndicators` checks `hasFailed(trip, 'localEssentials')` for the Tips tab dot. Verify this matches the section name written by the streaming flow on failure (it should — bundle siblings cover this case).

### Streaming UX polish

- [ ] **Loading copy on the planner sheet brief flash** — currently shows "Starting your trip..." in a single italic line for the ≤1s window between tap and dismiss. Could be replaced with a more dynamic state, but only if user testing shows the current copy is missed.

- [ ] **Animation perf on lower-end iPhones** — the trip detail screen during generation runs ~8 Reanimated worklets simultaneously (top dots, image dots, day-pill dots, day-dot row pulse, cursor blink, hero shimmer, tips shimmer, progress strip). Spec assumes Reanimated keeps everything on the UI thread. Verify on iPhone 11 / iPhone 12 in TestFlight before shipping.

- [ ] **`TripGenerationStrip` overlap with `TopSafeAreaBlur`** — strip mounts above the blur via z-index, but the strip's progress line and the blur's bottom edge sit in the same vertical region. Visually verify on-device that the blur doesn't tint the strip's coral pixels.

# Visa Atlas — Technical Interview Prep

A study guide for talking about Visa Atlas in interviews: how it's built, why, and the
hard problems you solved. Answers are written in first person so you can say them out loud.
Everything here is grounded in the actual codebase (file references included so you can re-read
the real code before walking in).

> **One accuracy rule before you start:** *Trip generation* genuinely streams (5 parallel LLM
> calls, days appear one by one). *Chat* (trip copilot + visa chat) is request/response with a
> "thinking" spinner — it is **not** token-streaming. Keep these distinct. Saying "everything
> streams" is the kind of thing a sharp interviewer will catch you on.

---

## 0. The 30-second elevator pitch

> "Visa Atlas is a React Native / Expo travel app with a Convex reactive backend. The headline
> feature is AI trip generation: you give it a country and some preferences, and it builds a
> full day-by-day itinerary, visa requirements, budget, and a dining guide. The interesting
> engineering is in how that gets generated fast and reliably — I fan it out into 5 parallel
> streaming LLM calls and write each piece into the database as it arrives, so the UI fills in
> live instead of showing a 60-second spinner. The backend is Convex, so the client just
> subscribes to the trip document and re-renders reactively as the server patches it."

The three things that make you sound senior: **parallel fan-out**, **streaming via reactive DB
writes**, and the **mutation→scheduler→action reliability pattern**. Everything below expands those.

---

## 1. THE FLAGSHIP STORY — "We had a huge wait time, how did you fix it?"

This is your strongest story. Tell it as a before/after with a clear problem, a diagnosis, and a fix.

### The problem
> "The first version generated the whole trip in a single LLM call — itinerary, visa info,
> budget, highlights, all in one prompt. For a 7-day trip that's a massive amount of output
> tokens, so the user stared at a blank loading screen for 60–90 seconds. Worse, it was a single
> point of failure: if the model malformed the JSON anywhere, or the call timed out, you lost the
> *entire* trip and had to start over. And output tokens are generated sequentially, so a big
> response is fundamentally slow no matter what."

### Fix #1 — Parallelize into independent calls
> "I split generation into 5 concurrent calls, each producing one section: the itinerary, the
> visa bundle, the budget bundle, the highlights, and country tips. They run together with
> `Promise.all`, so the wall-clock time is the *slowest single call*, not the *sum* of all of
> them. Because output-token generation is the bottleneck, splitting one 8,000-token response
> into five ~1,000–1,500-token responses that generate in parallel cuts the perceived time
> dramatically."

- Code: `convex/tripGeneration.ts` — `runGenerationStream` orchestrates the fan-out; the
  `Promise.all([...])` is around `tripGeneration.ts:1180`.
- The 5 calls: **itinerary** (~1,300–1,700 tokens/day, streamed day-by-day), **visa bundle**
  (~1,024 tokens), **budget bundle** (~1,024), **highlights** (~512), **country tips** (~2,048,
  cached per country so it's usually free).
- A **6th call — the dining guide** (~8,192 tokens) — runs *after* the itinerary settles, as a
  *separate scheduled action*, because it needs the final list of neighborhoods and would
  otherwise blow the 10-minute action budget. Good detail to mention: "I sequenced the one piece
  that genuinely depends on another, and parallelized everything that's independent."

### Fix #2 — Stream each section in as it's produced
> "On top of parallelizing, I stream. Each call is an Anthropic streaming request — I read the
> server-sent events as they arrive and write partial results into the trip document
> incrementally. The itinerary is the best example: I wrote a small bracket-depth JSON parser
> that watches the token stream and, every time a day object closes, emits that one day. So the
> user literally watches Day 1 appear, then Day 2, then Day 3 — the screen is filling in within
> a few seconds instead of blank for a minute."

- Code: `convex/lib/anthropicStream.ts` — `streamAnthropic` (the SSE loop, ~`:497`) and
  `makeItineraryStreamParser` (the bracket-depth per-day emitter).
- Each emitted day calls a `patchTripSection` mutation → patches the trip doc → the client's
  reactive subscription pushes the update → React re-renders. **No polling.**

### Fix #3 — Per-section failure isolation
> "Because each section is its own call writing its own field, a failure is contained. If the
> visa call malforms its JSON but the itinerary is fine, the user still gets their itinerary and
> just sees a 'retry visa' card. Every promise is written to always settle — one section throwing
> never aborts the others. That turned 'the whole trip failed' into 'one card needs a retry.'"

- Failed sections are appended to a `failedSections` array on the trip; the UI renders retry
  cards. Retry is its own rate-limited endpoint (`retrySection`, 10/hour).

### The numbers to memorize
- **Before:** 1 call, ~60–90s blank screen, all-or-nothing.
- **After:** 5 parallel streaming calls, first content in **~2–4s**, full trip in **~30s**
  (network/latency-bound, not compute-bound), per-section retry on failure.
- Prompt caching (next section) cut input cost ~90% on top of the speed win.

### Likely follow-ups
- **"Why is it ~30s if they run in parallel?"** → "Latency to the model plus the longest single
  stream — the itinerary for a long trip is still a lot of tokens. Parallelizing removes the
  *additive* cost; it can't remove the single longest call. To go further I'd shorten the
  itinerary prompt or split it by day-ranges into multiple calls too."
- **"How do you parse incomplete JSON mid-stream?"** → bracket-depth counter; emit a day when its
  braces balance back to the array level. For the non-streamed sections I buffer the whole
  response then extract the first balanced JSON object (tolerant of code fences / prose
  preambles the model sometimes adds). Code: `extractFirstJsonObject` in `tripGeneration.ts`.
- **"What if two sections need to be consistent?"** → That's exactly why dining runs *after*
  itinerary, not in parallel — it depends on the finalized neighborhoods. Independent sections
  parallelize; dependent ones sequence.

---

## 2. STREAMING UI — "Walk me through how the UI updates live"

> "The key idea is I don't stream tokens to the client directly. The streaming happens
> server-side into the database, and the client just subscribes. Convex is a reactive backend —
> `useQuery` on the trip document is a live subscription. So my generation action streams from
> the model, and every few hundred milliseconds it patches the trip doc with another day or
> another section. Each patch invalidates the query and pushes new data to every subscribed
> client. The React Native UI re-renders with the new content. From the user's point of view
> it's streaming; under the hood it's reactive DB writes."

**Why this design over a direct WebSocket/SSE to the phone:**
- **Reliability:** mobile sockets blip constantly (backgrounding, tunnels, elevators). A direct
  client→model stream dies on every blip. Writing to the DB means the work continues server-side
  and the client re-syncs whatever it missed when it reconnects.
- **Multiplayer for free:** trips can have collaborators. Because state lives in the doc, every
  collaborator sees the trip fill in simultaneously.
- **Offline-ready:** the moment a section lands in the doc, it's also cached locally (SQLite),
  so it survives going offline.

**The chat distinction (be precise here):**
> "The chat copilot is different — it's request/response, not streaming. When you send a message,
> a rate-limited Convex action calls the model, waits for the full reply, and writes one
> assistant message. The message list is a reactive query so the reply appears atomically. While
> it's working I show a 'thinking' row — pulsing dots with cycling flavor text, animated on the
> Reanimated UI thread so it never stutters. I chose atomic writes there deliberately: chat
> replies are short, and an atomic write is cleaner for the offline cache and for multiplayer
> than a half-streamed message."

- Code: `app/chat/[tripId].tsx` (trip copilot), `app/visa-chat/[guideId].tsx` (visa chat),
  `convex/aiProxy.ts` (the proxy actions).
- Render perf detail worth dropping: message bubbles are `React.memo` with memoized props, so
  typing in the input box doesn't re-render the whole conversation.

---

## 3. RELIABILITY — "How do you handle a long job when the client can disconnect?"

This is the **mutation→scheduler→action pattern** and it's a genuinely strong systems answer.

> "Trip generation can take 30+ seconds. If the client called the generation action directly over
> the socket and waited, any socket blip would throw 'connection lost while action in flight' and
> strand the user. So I never call the long action from the client. Instead:
> 1. The client calls a fast **mutation**. Mutations are transactional and auto-retried by the
>    SDK across reconnects, so they're safe.
> 2. That mutation inserts the trip 'stub' immediately (status: `generating`) and **schedules**
>    the long-running action to run server-side.
> 3. The client navigates to the trip screen and **subscribes** to the doc reactively.
> 4. The scheduled action does the streaming work and patches the doc; the client just watches.
>
> The client's connection is now irrelevant to whether the work completes. It's the same shape as
> a durable job queue, but I get it for free from Convex's scheduler + reactivity."

**Watchdogs (shows production maturity):**
- A **zero-content stall check** at ~60s: if nothing has landed and no patch in ~180s, mark
  failed — kills zombie generations.
- A **stuck-generation check** at ~12min (actions cap at 10min): marks any still-empty sections
  failed and settles the status so the UI never hangs forever.
- A `lastStreamAt` timestamp on the doc is how the watchdog distinguishes "slow but alive" from
  "dead."

Code: `convex/tripGeneration.ts` — `generateTrip` mutation (`:170`), scheduled
`runGenerationStream`, the watchdog logic (`:791`, `:856`).

---

## 4. BACKEND & DATA MODELING — "Why Convex? Walk me through the schema."

**Why Convex:**
> "Three reasons. First, reactivity — `useQuery` is a live subscription, which is exactly what I
> needed for the streaming-into-the-doc pattern; I'd otherwise be hand-rolling WebSockets and
> cache invalidation. Second, the scheduler — durable background jobs without standing up a queue.
> Third, end-to-end TypeScript with generated types for documents and IDs, so the client and
> server share one type system. The tradeoff is vendor lock-in and less control than raw
> Postgres, which I'd weigh differently at larger scale."

**Schema highlights** (`convex/schema.ts`):
- `trips` — the core doc; itinerary/budget/dining stored as JSON-stringified fields, plus
  `status`, `failedSections`, image fields. Indexes: `by_user`, `by_country`, `by_status`.
- `tripCollaborators` — RBAC join table (owner/editor/viewer), indexed `by_trip_and_user`.
- `tripShares` — public capability tokens for share links.
- `visaProfiles` — the user's passports, held visas, and a large `visaMap` of computed
  eligibility (~100KB).
- `bookings`, `tripMessages`, `tripChatSessions`, `rateLimits`, `countryTipsCache` (cache),
  `blockedUsers` + `messageReports` (moderation), `emailAccounts` (OAuth tokens for booking
  import).

**Caching as a cost lever:** `countryTipsCache` and `dayTripDiscoveryCache` mean country-level
LLM output (emergency numbers, tipping culture, etc.) is generated **once per country** and
reused for every user. "I cache anything that isn't user-specific so I only pay for it once."

---

## 5. SECURITY & AUTH — "How do you do authorization?"

**Auth:** Convex Auth with three providers — Google OIDC, native Apple Sign-In (verifies the
Apple ID token against Apple's JWKS, bundle-ID audience check), and password + email OTP.
Identity is linked by verified email across providers. (`convex/auth.ts`, `convex/AppleNative.ts`)

**The rule you can state crisply:**
> "Every public query and mutation calls `requireAuth(ctx)` at the top, which derives the user ID
> *server-side* from the session — I never accept a userId as an argument, because that would let
> a client impersonate anyone. After auth, I verify ownership before touching any document."

- `requireAuth(ctx)` → `convex/lib/auth.ts`.
- `checkTripPermission(ctx, tripId, role)` → enforces the viewer<editor<owner hierarchy against
  the `tripCollaborators` table before any read/write.

**Public share links — the interesting part:**
> "Share links are unauthenticated, so I can't use the user. Instead they're capability tokens —
> a 20-character CSPRNG string, ~116 bits of entropy, generated with `crypto.getRandomValues`,
> not `Math.random`. The public endpoint looks up the token, checks it isn't revoked and the trip
> isn't deleted, and returns a **strict allowlist projection** of the trip — I rebuild a new
> object field by field rather than spreading the doc, so private fields like the owner's notes,
> visa checklist, and budget breakdown can never leak. Revoking sets a timestamp; re-sharing mints
> a fresh token so old leaked links die."

- Code: `convex/tripShares.ts`, `convex/lib/sharePayload.ts` (`buildSharedTripPayload`),
  `requireShareToken` in `convex/lib/auth.ts`.
- Nice detail: image URLs in the payload are validated `https://`-only, and there are bounds
  (max 80 stop-sets, 4 photos/stop) to prevent payload-inflation.

**Secrets:** All real API keys (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc.) live in Convex env
vars, never committed. The one committed key is the PostHog **write-only public project token**,
which is designed to ship in clients. OAuth tokens for Gmail/Outlook are stored server-side and
**sanitized out** of any client-facing query (`sanitizeAccount` in `convex/emailAccounts.ts`).

---

## 6. SAFETY & TRUST — two flavors, know both

### (a) User-generated content (App Store requirement)
> "Trips can be shared and have chat, so there's UGC. I have server-side **report** and **block**.
> Blocking is enforced server-side: when I fetch trip messages I filter out anyone the viewer has
> blocked before the data ever leaves the server, so blocked content can't be reconstructed
> client-side. Reports are stored for review. Message attribution is derived server-side too, so a
> client can't spoof who said what. It's a reactive moderation model — report-and-review — backed
> by a Terms section, rather than a proactive content filter."
- Code: `convex/moderation.ts`, message filtering in `convex/trips.ts` `getMessages`.

### (b) High-stakes visa accuracy (the one to be thoughtful about)
> "Visa guidance is genuinely high-stakes — wrong info could get someone denied boarding. So two
> things. First, the core visa data is a **curated static dataset**, not LLM-generated — sourced
> from Henley Passport Index, IATA Timatic, and embassy sites, with a last-verified date. I don't
> want a hallucinated visa rule. Second, I'm explicit that it's informational and that users must
> verify with the official embassy or consulate before travel — that's in the Terms, and it's the
> right posture for liability and for the user."
- Code: `data/visaData.ts` (curated dataset, ~195 countries), disclaimer in `app/more/terms.tsx`.
- **Honest weakness to volunteer if pushed:** the static dataset can go stale between app updates,
  and the in-*UI* "verify with embassy" disclaimer is lighter than the Terms version. A good
  roadmap answer: surface the `lastVerified` date inline on visa cards and add a per-card
  "confirm with the embassy" line.

---

## 7. COST & OBSERVABILITY — "How do you know what this costs?"

> "Every LLM call reports an `$ai_generation` event to PostHog with input/output/cache token
> counts, computed USD cost per model, latency, and a `purpose` tag like 'itinerary' or
> 'dining'. So I can see cost per feature and per trip in a dashboard. On the reduction side: the
> system prompt is wrapped in an ephemeral **prompt cache**, which is ~90% cheaper on input — and
> because I make 5 calls that share a system prompt, the cache pays off five times per
> generation. Country-level content is cached in the DB so I pay once per country, not once per
> user."

- Code: `convex/lib/posthog.ts` (`aiCostUsd`, `captureAIGeneration`, the per-model `PRICING`
  table), `lib/analytics.tsx` (client events).
- **Privacy-conscious detail to mention:** "Session replay is deliberately **off** — the app
  holds passport and visa data, and replay is the wrong default for that, even masked."
- Implementation detail that sounds senior: the server uses a **raw HTTP POST** to PostHog rather
  than the SDK, because the SDK buffers events and you lose them when a serverless function exits
  mid-request.

---

## 8. FRONTEND / REACT NATIVE — "What's notable on the client?"

- **Expo Router** file-based routing; 4 tabs (Trips, Explore map, Compare, Guides) plus chat,
  guide, country, and day-planner stacks.
- **MapLibre** native vector map for the world visa choropleth — countries colored by the user's
  eligibility category, computed against their held visas. Point-in-polygon re-check on tap for
  multi-polygon countries. There's a hidden "prewarm" map mounted after auth to warm the tile/GeoJSON
  cache so the first real tap is instant. (`app/(tabs)/explore.tsx`, `components/map/`)
- **Reanimated 4** for everything animated (worklets on the UI thread): keyboard-tracked input
  bar via `useReanimatedKeyboardAnimation`, scroll-driven blur header, thinking dots.
- **Offline-first:** a custom `useOfflineQuery` wraps Convex `useQuery`, debounce-caches to SQLite
  (3s trailing, hash-deduped), serves cache when offline, and **skips caching mid-generation docs**
  so it never persists a half-built trip. (`hooks/use-offline-query.ts`, `contexts/offline-context.tsx`)
- **Design system** in `constants/theme.ts`: editorial "paper" aesthetic, Fraunces/Inter/JetBrains
  Mono, light+dark via `useTheme()`. Worth saying you treat polish as a first-class requirement.

---

## 9. TRADEOFFS & "WHAT WOULD YOU DO DIFFERENTLY" (maturity questions)

Have honest answers ready — interviewers weight self-awareness heavily.

- **Prompt injection.** "User notes are interpolated into the system prompt without escaping. The
  blast radius is limited — a 2,000-char cap, rate limits, and the output is structured JSON I
  validate — but a determined user could try to steer generation. I'd add input
  delimiting/escaping and move user content into a clearly-fenced user turn rather than the system
  prompt." (`convex/lib/anthropicStream.ts`)
- **Static visa data staleness.** Covered in §6b — curated-not-hallucinated was the right call, but
  it needs a freshness pipeline and inline date surfacing.
- **Moderation is reactive.** Report/block + 24h review is the App Store baseline; at scale I'd add
  automated pre-filtering on shared/UGC content.
- **Convex lock-in.** Great for velocity and reactivity now; I'd re-evaluate at much larger scale or
  if I needed complex relational queries.
- **~30s generation.** Latency-bound on the longest call; next lever is splitting the itinerary
  itself by day-ranges into parallel calls, or a smaller/faster model for the cheap sections.

---

## 10. PRODUCT / BEHAVIORAL

- **"Why this app?"** Travel + visas is genuinely confusing; existing tools are either static
  government pages or generic AI chat. The bet is a *reactive, personalized* itinerary that's
  passport-aware (your visa status changes what the same country looks like).
- **"Hardest bug?"** The "connection lost while action in flight" stranding → led to the
  mutation→scheduler→action pattern (§3). Good because it's a real systems lesson, not a typo.
- **"How do you decide what to build?"** Point at the quality bar: ship the premium version of an
  interaction on the first pass, research the best-in-class pattern (Apple Mail, Linear, Airbnb)
  before inventing. That's a real engineering-values answer.
- **"Most proud of?"** The generation pipeline — it's where product (fast, live, resilient) and
  systems (parallel streaming, durable jobs, failure isolation) meet.

---

## Cheat sheet — numbers & names to have on the tip of your tongue

| Thing | Value |
|---|---|
| Parallel generation calls | **5** (itinerary, visa, budget, highlights, country tips) + dining after |
| Model | `claude-sonnet-4-6`, Anthropic Messages API, streaming SSE |
| First content visible | ~2–4s (vs ~60–90s before) |
| Full trip | ~30s, latency-bound |
| Prompt cache savings | ~90% on input, shared across the 5 calls |
| Reliability pattern | mutation → scheduler → action → reactive query |
| Share token | 20-char CSPRNG, ~116 bits, revocable, allowlist projection |
| Rate limits | generateTrip 5/hr, retrySection 10/hr, tweakDay 15/hr, chat 30/hr |
| Auth | Convex Auth: Google OIDC + native Apple + password/OTP |
| Cost tracking | PostHog `$ai_generation`, per-model pricing, replay OFF |
| Map | MapLibre native vector choropleth |

## Key files to re-read before the interview
- `convex/tripGeneration.ts` — the fan-out, streaming orchestration, watchdogs, rate limits
- `convex/lib/anthropicStream.ts` — SSE streaming + the bracket-depth per-day parser
- `convex/lib/auth.ts` + `convex/tripShares.ts` + `convex/lib/sharePayload.ts` — auth + share security
- `convex/lib/posthog.ts` — LLM cost tracking
- `convex/schema.ts` — data model
- `app/chat/[tripId].tsx` — the chat / thinking-spinner (non-streaming) path
- `hooks/use-offline-query.ts` — offline-first caching

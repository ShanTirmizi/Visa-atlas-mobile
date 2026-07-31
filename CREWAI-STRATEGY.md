# CrewAI in Visa Atlas — honest strategy for an AI / LLM / FDE job hunt

Researched against CrewAI's current (2026) docs, the multi-agent debate (Anthropic + Cognition),
2026 hiring signals for AI/LLM and forward-deployed engineer roles, and an audit of the Visa
Atlas codebase — then adversarially stress-tested by a skeptical-interviewer pass. This is the
reconciled view, not the rosy one.

---

## TL;DR

1. **As a résumé line, "CrewAI" is a *yellow flag* in 2026, not a green one.** The thing hiring
   managers say out loud: "LangChain/CrewAI on the resume and nothing else = tutorial-stack
   candidate," and their first follow-up is *"what did you build **without** the framework?"*
2. **Do NOT put CrewAI anywhere near your streaming trip generation, visa chat, trip chat,
   scan-booking, or surprise-me.** Those are coordinated *write* tasks building one artifact for
   one user in real time — the exact shape *both* Anthropic and Cognition say to keep
   single-threaded. Your Convex `mutation → scheduler → reactive query` design is **already** the
   "workflow over framework" pattern Anthropic's *Building Effective Agents* recommends. A crew
   would fight it, cost ~15× the tokens, and break your live day-by-day streaming UX.
3. **There is exactly one genuinely good fit:** an **asynchronous, tool-grounded verification
   layer** that runs *after* a trip is generated, checks the LLM's claims against *real tools*
   (OSRM routing, Photon geocoding, web search), and writes "verified / flagged" badges back into
   Convex. This uses agentic strengths your pipeline lacks (planning, external-tool grounding,
   critic loops) **without touching** the streaming UX.
4. **The twist that makes you look senior:** even that verifier doesn't *need* CrewAI — the
   strongest version is a plain async function on the raw Anthropic SDK. So the single most
   impressive thing you can say is **"I evaluated CrewAI and deliberately chose a structured
   workflow instead, here's the measured reason why."** That sentence beats any crew.
5. **The real hero is the eval harness, not the framework.** Evals are the #1 differentiator in
   2026 hiring ("the single biggest signal this person actually built with LLMs"). A 30-itinerary
   labeled gold set + precision/recall on your flagger + one caught hallucination is a better
   interview artifact than the entire app.

---

## 1. Is CrewAI useful for AI / LLM / FDE jobs? (the honest read)

**What 2026 hiring actually rewards** (AI/LLM eng *and* FDE both converge here):
- **Eval design** — metric, gold dataset, freshness, and a concrete regression/hallucination it
  caught. If your work doesn't mention evals, serious teams assume you shipped unevaluated
  features. This is the #1 signal.
- **Cost/latency wins with numbers** — "cut LLM spend 40–70% via caching + model routing,"
  "p95 X→Y." A project with no inference-cost story is an explicit red flag.
- **Grounding & reliability** — real tool use, structured/Pydantic output, retries, guardrails,
  RAG with actual recall numbers (not "implemented RAG").
- **Observability** — logging prompts/tools/costs/latencies, a postmortem of a real prod failure.
- **Judgment** — being able to say *why* you chose an architecture, and *when not* to reach for
  complexity. For FDE specifically: decompose an ambiguous brief, prototype scrappily, then lay
  out the production path; communication weighted ~equal to code.

**Where CrewAI lands against that:** naming it signals "rapid prototyper" at best, "followed a
tutorial" at worst. It carries production baggage too — weak in-task logging, poor crash recovery
(a 10-step run that dies at step 8 often restarts from scratch), and ~5M vs LangGraph's ~34M
monthly PyPI downloads. **The framework is never the signal; what you did with it is.** It only
helps when it's the vehicle for a real, *evaluated*, shipped system with numbers — and even then
it should be the least interesting clause in the sentence.

**Net:** Learning CrewAI is fine as a *learning goal*. As a *job lever*, the leverage is in the
evals + groundedness + cost control + the architectural judgment around it — which you can get
with or without the framework.

---

## 2. Why NOT to rebuild what you have (this *is* the senior move)

The multi-agent debate reconciles around a **read/write split**:
- **Anthropic, *Building Effective Agents* (Dec 2024):** simplicity first; most production value
  is *workflows* (prompt chaining, routing, parallelization, orchestrator-workers,
  evaluator-optimizer), not autonomous agent swarms. Frameworks add abstraction that hides
  prompts and makes debugging harder — start with raw API calls.
- **Cognition, *Don't Build Multi-Agents* (Jun 2025):** parallel sub-agents make independent
  decisions that silently conflict (the Flappy-Bird/Mario example). Keep coordinated work
  single-threaded; if it's too big for one context, add a *compression* step, not more agents.
- **Anthropic, *How we built our multi-agent research system* (Jun 2025):** parallel agents *do*
  work — but only for **read-heavy, breadth-first research** with self-contained briefs and fixed
  schemas, and at ~15× the token cost. Even Anthropic agrees coding/coordination is a poor fit.

**Your app's AI surfaces are coordinated writes for one user.** That's the keep-it-single-threaded
shape. Concretely, do **not** rebuild:

| Surface | Why it's already right |
|---|---|
| 5 parallel Anthropic streams (`runGenerationStream`) | Independent streams, per-section error isolation, no dependencies. A crew adds latency + ~15× tokens for zero gain. |
| Live day-by-day streaming (bracket-depth parser → `patchTripSection` → reactive doc) | This is the app's core liveness. A crew that aggregates in-memory and writes once hides ~30s behind a skeleton. Massive regression. |
| Visa chat / trip chat | Real-time single-user conversational writes. Multi-hop agent latency is brutal on mobile. |
| Scan-booking (Claude vision → JSON) | Already the right shape. The upgrade is an *eval set* for field-extraction accuracy, not agents. |
| Day planner (`generateGroundedPlan`) | Already an optimal single-agent design: native `web_search` + geocode + route in one coherent call. |
| Section retries, watchdogs, forever-cached country tips | Already robust workflow/caching patterns. |

Being able to *explain this table* in an interview is worth more than any crew you could build.

---

## 3. The one place it fits — a tool-grounded **verification layer**

Your pipeline emits itinerary/visa/budget from training data and **never checks any of it against
the real world.** That's the gap multi-agent strengths (planning + external tools + critic loops)
actually fill — and it's a *read-heavy, fan-out, fixed-schema* shape, which is the blessed one.

### Flagship: "Is this trip physically real?" (geographic-feasibility verifier)

- **What it does:** after a trip generates, extract each day's anchor places → geocode them
  (Photon) → compute *real* inter-day travel time (OSRM) → flag any leg over a threshold (~5–6h)
  or any day that isn't geographically sequential → suggest a concrete fix.
- **Why it's the pick:** both tools (OSRM, Photon) are **already integrated server-side**
  (`convex/lib/geo.ts`, used by the day planner) — no paywall, no ToS grey area, no legal stakes.
  It produces a **real, falsifiable number from a real routing engine** the base LLM provably
  cannot compute. Medium effort, self-contained, ships as a clean standalone story.
- **The wow (the demo that lands):** generate a deliberately overstuffed itinerary, then watch
  real OSRM travel times stream in as **red/amber/green badges per day**, with a tappable
  *"Day 3→4 is a 6h drive — add a travel day?"* This is verification grounded in a tool, not vibes.

### Second: visa-rule fact-checker (v2, higher stakes)

- Decompose the generated visa guide into atomic claims → check each against web search + your
  static `visaData.ts` for the destination × the traveler's actual passport → render a
  *"verified · embassy.gov"* chip per item, and flag contradictions ("model said yellow-fever
  required; official source says only if arriving from an endemic country"). **One screenshot of a
  caught hallucination, with a citation, is a better artifact than the whole app.**
- **Be honest about its limit:** visa web sources are messy/contradictory, so it must label
  "unverifiable" generously and **never auto-overwrite** border rules — surface flags + a
  disclaimer, not authoritative legal advice. Its output skews toward "couldn't confirm," which is
  why it's v2, not the flagship.

### The one *legitimate* parallel multi-agent fan-out (if you want to prove you know when it's right)

- **Destination-research enrichment** for country tips: N independent researcher workers, each
  with `web_search` + one narrow brief + a fixed output schema (safety, transit, closures, weather
  windows, scams), fanned-in by a synthesizer, cached forever per the existing pattern. This is
  the *only* shape Anthropic's research result endorses — independent reads, fresh context per
  worker, no mid-task coordination. Build this if you specifically want a "I know *when* multi-agent
  is correct" talking point.

### Cut these (they're contrived — the critique flagged them)

- **Highlights/dining coherence checker** — it's set-difference + fuzzy name matching dressed as a
  3-agent crew. Saying *"I decided this was a 20-line diff + one embedding call, not worth an
  LLM"* is a **better** interview line than building it.
- **Budget reality-check** — only as strong as a clean price source, and there isn't one (paywalled
  / ToS-grey). Degrades to web-search estimates. Defer.

---

## 4. The honest twist: build the flagship **without** CrewAI

The skeptical-interviewer pass was blunt: every verifier here is *"LLM + 1–3 tools + Pydantic +
one critic pass"* — that's the **evaluator-optimizer *workflow*** Anthropic explicitly
distinguishes *from* multi-agent. The "Geographer agent" does no reasoning a plain function
doesn't. So the strongest build is:

```
extract anchors  (cheap Haiku call or pure JSON parse)
      → geocode   (Photon — deterministic, no LLM)
      → route     (OSRM — deterministic, no LLM)
      → flag+suggest  (ONE Sonnet call, Pydantic-validated output)
      → write back to Convex
```

…on the **raw Anthropic SDK**, with a tool loop. Then *"why not just the SDK?"* becomes your
**strength**: *"I did — single-artifact verification doesn't need a multi-agent framework, and
here's the token/latency/cost delta I measured proving it."*

**Three paths, pick based on your goal:**

- **A — Max job signal, least framework:** build the verifier on the raw SDK + an eval harness.
  Story: *"I evaluated CrewAI, chose a structured workflow, measured why."* Strongest FDE/AI-eng
  signal, lowest effort.
- **B — Learn CrewAI for real:** build the verifier (or the destination-research fan-out) as a
  CrewAI **Flow** so you genuinely learn Flows/@persist/guardrails and have a demo. Slightly
  weaker pure signal; honest if framed as a learning project.
- **C — Both, as a documented comparison (most "we're serious"):** build it on the raw SDK *and*
  as a CrewAI Flow, then publish the measured comparison (tokens, p95 latency, $/run, lines of
  code, debuggability). **The comparison itself is the artifact** — it proves judgment *and*
  framework fluency in one repo.

---

## 5. Architecture — where it lives & the holes to close

CrewAI (or the raw-SDK verifier) lives **only** in the planned **FastAPI side-car**
(`FASTAPI_BACKEND_PROMPT.md`, wired via `utils/aiBackend.ts` / `EXPO_PUBLIC_AI_BACKEND_URL`).
**Never** in a Convex action (10-min cap, no Python) and **never** on-device. Convex stays the
database + reactive backbone.

**Flow end to end:**
1. **Trigger:** at the end of `runGenerationStream`, a Convex `internalAction` POSTs the `tripId`
   to FastAPI `/verify` (Bearer token, the contract you already have). FastAPI returns `202` and
   runs the job in the background.
2. **Run:** the verifier extracts anchors → geocode → route → one flag/suggest call.
3. **Stream back:** each result is written via a thin Convex mutation onto the trip doc; the client
   is already subscribed (`useOfflineQuery`), so **badges appear progressively and reactively** —
   you inherit the live feel with no SSE and full socket-blip resilience.

**Holes the critique found — close these or an interviewer will:**
- **Auth.** A server-to-server write-back has no user JWT, and your rule is "never accept a userId
  as an argument." Add a `verification` field to the `trips` schema and a `patchVerification`
  mutation guarded by a **dedicated service-role capability token** the side-car holds, scoped to
  only patch `verification.*` on the trip the trigger handed it. Don't fake a user identity.
- **No watchdog.** Generation has a 12-min finalizer; the verifier as designed has none, so a
  crashed job leaves `verification.status = "pending"` forever. **Port the finalizer** (a
  `scheduler.runAfter` ~3–5 min that flips stuck → `"unverified"`).
- **Cost tracking is TypeScript-only.** `convex/lib/posthog.ts` won't see Python calls. **Re-emit
  the `$ai_generation` event from FastAPI** (raw fetch, same `phc_` key) or your "60% cheaper"
  number is unverifiable.
- **Don't hammer public demo endpoints.** `geo.ts` itself notes OSRM/Photon public demos are
  unsuitable at scale. **Self-host OSRM** (a real, résumé-worthy infra detail) or cache geocodes
  aggressively + rate-limit. A verifier over every trip multiplies that load.
- **Durability.** FastAPI `BackgroundTasks` dies with the process. For the "serious" version use a
  real job store (Redis/RQ — or honestly, Convex's own scheduler, which you already run). Then the
  defensible line is *"I chose a job queue, not a multi-agent framework, because this is a durable
  async verification pipeline, not agent negotiation."*

---

## 6. Résumé / interview narrative (framework demoted to one clause)

> **Built an asynchronous itinerary-verification service** (FastAPI + Claude) that grounds
> LLM-generated travel plans against **real routing (OSRM) and geocoding (Photon)** data:
> extracts day anchors, computes true inter-city travel times, and flags physically-impossible
> itineraries via an **evaluator-optimizer critic loop**. Routed cheap checks to Haiku / synthesis
> to Sonnet (**~60% cheaper** vs all-Sonnet, measured), enforced **Pydantic structured output +
> guardrails**, and designed a **30-itinerary labeled eval set that gated deploys** and caught a
> class of hallucinated overnight-hop itineraries the generator shipped unverified. Results write
> back through Convex mutations so badges **stream into the React Native client reactively**,
> preserving the live-generation UX.

**Talking points that survive a real screen:**
1. *"Walk me through your eval"* → metric = flag precision/recall on a hand-labeled gold set;
   regression caught = overnight luggage city-hops the base model emitted with no grounding.
2. *The architectural "no"* → *"I deliberately did NOT multi-agent the chat or streaming
   generation; both Cognition and Anthropic say coordinated single-artifact writes stay
   single-threaded, and my Convex mutation→scheduler→reactive-query design is already the
   workflow-over-framework pattern Anthropic recommends."*
3. *"What did you build without the framework?"* → the streaming pipeline, the bracket-depth JSON
   parser, the Convex write-through, and the raw Anthropic SSE layer.
4. *Cost/observability* → per-role model routing, a hard tool-call cap, a job-store for
   crash-resume, and `$ai_generation` cost tracking re-instrumented in the Python service.

This reads as substance because the framework is the least interesting sentence and the evals,
groundedness, caught hallucination, cost number, and explicit architectural "no" carry it — which
is precisely the 2026 signal for both AI/LLM-engineer and forward-deployed-engineer roles.

---

## Sources (selected)

- Anthropic — *Building Effective Agents*; *How we built our multi-agent research system*
- Cognition — *Don't Build Multi-Agents*
- CrewAI docs — Flows, Agents, Tools, Guardrails, Enterprise/AMP; CrewAI GitHub
- LangGraph vs CrewAI production comparisons (2026); CrewAI-in-production lessons (2026)
- 2026 hiring write-ups for AI/LLM engineers and forward-deployed engineers (Anthropic / OpenAI /
  Palantir-style roles)

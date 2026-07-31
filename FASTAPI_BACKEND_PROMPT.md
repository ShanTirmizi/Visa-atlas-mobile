# Prompt — Build a FastAPI backend for Visa Atlas

> Paste this entire file as your prompt in a fresh session, in a NEW empty repo (e.g. `visa-atlas-api/`), with the existing `visa-atlas-mobile` repo available to read for reference.

---

## Goal

Build a **production-grade FastAPI (Python) backend** for the Visa Atlas travel app that
**re-implements its API and all AI/LLM logic in Python**, while **keeping Convex as the
database**. It must be **standalone, fully tested, and deployable**. Do **NOT** modify the
mobile app or the Convex schema — this is a parallel backend to be wired up later.

The point of this project is twofold: (1) a clean Python backend I can wire into the app,
and (2) a portfolio-grade FastAPI service that shows production AI engineering — so quality,
tests, and an **eval harness** matter as much as the features.

## Architecture

- **FastAPI owns:** the HTTP API, request/response models, auth, business logic, **all AI/LLM
  orchestration** (Anthropic), external integrations (web search, geocoding, routing, image
  providers), rate limiting, and evals.
- **Convex stays as the database**, reached via the **official Convex Python client**
  (`pip install convex`; `ConvexClient(CONVEX_URL)`). Read/write by calling the existing Convex
  **queries/mutations** (e.g. `client.query("trips:getTrip", {...})`,
  `client.mutation("tripGeneration:patchTripSection", {...})`). Convex has **no raw-table API**, so
  everything goes through functions. **Where a thin CRUD function you need doesn't exist yet, do
  NOT invent table access — list it in `CONVEX_FUNCTIONS_NEEDED.md`** (I'll add it Convex-side).
- **Auth:** replicate Convex's server-side model. Validate the **Convex Auth** JWT/session the
  mobile client holds (Apple native, Google, or Password), resolve it to the user's `_id`, and
  enforce the same ownership/permission checks before any data access — including the
  `tripCollaborators` role ladder (`viewer < editor < owner`) and the public **capability-token**
  share path (the only unauthenticated exception). For local dev/tests, also support a dev bearer
  token mapping to a fixed test `userId`, but keep real JWT verification as the default.

## Engineering standard (non-negotiable)

- **Python 3.12, FastAPI, uvicorn, fully async.** Pydantic v2 + `pydantic-settings` for config
  (12-factor; every secret via env; never hardcode keys).
- **Anthropic via the official async SDK** (`anthropic.AsyncAnthropic`). Preserve the exact model
  (`claude-sonnet-4-6`), prompt structure, **prompt caching** (`cache_control: {"type": "ephemeral"}`
  on the shared system prompt), per-section `max_tokens`, tool definitions, and streaming behavior
  described below. Port the real prompt builders and parsers from `convex/` — do not stub them.
- **httpx.AsyncClient** (one shared, lifespan-managed client) for Photon/OSRM/image/Convex-HTTP.
- **Layout:** `app/main.py` (app factory + lifespan), `app/core/` (config, logging, security,
  errors, ratelimit), `app/api/routers/` (one router per domain), `app/services/` (LLM
  orchestration, the Convex client wrapper, geo, images), `app/schemas/` (Pydantic models),
  `app/llm/` (prompt builders, JSON parsers, tool defs), `app/evals/`, `tests/`. Plus
  `pyproject.toml`, `Dockerfile`, `railway.toml`, `.env.example`, `README.md`.
- **Auth as a dependency** (`get_current_user`) → resolved `userId`; every protected route depends
  on it; enforce ownership/role in the service layer.
- **Rate limiting:** replicate the per-user fixed-window limits per endpoint (listed below). Small
  reusable limiter (in-memory for dev, behind a Redis-ready interface).
- **Errors:** typed exceptions + handlers returning RFC-9457 `application/problem+json`; never leak
  internals; log the real cause; generic user-facing copy.
- **Observability:** structured JSON logging with request IDs; log model, latency, and token usage
  for every LLM call.
- **Streaming + reactive writes (critical):** the mobile app reads generation progress
  **reactively from Convex docs**, not over HTTP. So for trip generation/day-planner you must write
  progress **into Convex** (status, per-day itinerary patches, `failedSections`/`retryingSections`,
  `lastStreamAt`) **as you stream**, exactly like the current backend. You MAY also expose an SSE
  endpoint for a future web client, but the Convex writes are what the app depends on.
- **Convex write fidelity:** replicate the coercion the current code does before every write
  (`coerceToString`, `stripCodeFences`, `extractFirstJsonObject`, `normalizeDiningGuide`, etc.) —
  Convex's validators are strict and reject malformed writes. Keep large content **JSON-stringified**
  inside string fields (the app parses it that way). Never expose OAuth tokens (token-stripped
  projections only).
- **Quality gates:** `ruff` (lint+format), `mypy --strict`, `pytest` + `pytest-asyncio` +
  `httpx.ASGITransport` for API tests, and `respx`/`pytest-httpx` to **mock every external HTTP call**
  (Anthropic, Photon, OSRM, images, Convex) — tests must never hit real APIs or spend money.
  `pre-commit` config. **GitHub Actions CI** running ruff + mypy + pytest + an eval dry-run.
- **Eval harness (`app/evals/`, first-class deliverable):** for each AI endpoint, a golden set of
  representative inputs + structural assertions + an **LLM-as-judge** scorer, runnable via
  `python -m app.evals run`, printing a pass-rate, wired into CI (behind a key/flag). See "Eval
  focus" below for what to grade.
- **Deploy:** `Dockerfile` (uvicorn/gunicorn), `railway.toml`, a `/healthz` route, `.env.example`
  documenting every var, and a `README.md` with run/test/deploy steps + a Mermaid architecture
  diagram and a "how to wire the mobile app to this later" section.

## Definition of done (verify before you finish)

- Installs and boots; `/healthz` 200; `/docs` lists every endpoint.
- `ruff check`, `mypy`, `pytest` all green; every external call mocked in tests.
- `python -m app.evals run` runs (mocked dry-run if no key) and prints a pass-rate.
- `CONVEX_FUNCTIONS_NEEDED.md` lists any thin Convex query/mutation to add.
- README explains later wiring (you do NOT wire the app).

---

## Visa Atlas specifics

Read `visa-atlas-mobile/convex/` for exact prompts, parsers, validators, and JSON shapes and port
them faithfully. Model: `claude-sonnet-4-6`. Convex URL via `CONVEX_URL` (the deployment's
`.convex.cloud`). Env: `ANTHROPIC_API_KEY`, `CONVEX_URL`, `CONVEX_AUTH_*` (for JWT verification),
`GOOGLE_PLACES_KEY` (images), plus a dev token.

**Build in this order — AI first, fully (no stubs):**

1. **Trip generation — `POST /trips/generate` (the crown jewel).** Re-implement
   `tripGeneration.generateTrip → runGenerationStream`: validate + rate-limit (**5/hr**), create the
   `generating` trip stub + owner `tripCollaborators` row via Convex, then run **~5 PARALLEL Anthropic
   streaming calls** (itinerary day-by-day, visa bundle, budget bundle, highlights, optional
   country-tips) with **prompt caching** on the shared `buildSystemPrompt` (NYT-Travel editorial
   voice). Port the **bracket-depth streaming JSON parser** that emits each itinerary day as its
   closing brace streams in, per-section `max_tokens`, the stall/total **watchdogs** and **settle**
   discipline, and the `failedSections`/`retryingSections` markers. **Write all progress into the
   Convex `trips` doc** as you stream. Then `retrySection` (10/hr), `tweakDay` (relaxed|rainy|
   swap-evening, 15/hr), `generateDiningGuide`, `backfillDayStops` — reuse the same builders/streams.
2. **Day planner — `POST /day-plans`.** Re-implement `dayPlanner.runDayPlan` (3-stage, **8/hr**):
   (1) a web-grounded Anthropic call using the **native web_search tool**
   (`web_search_20250305`, `max_uses: 6`, `user_location` ≈ GB), looping on `pause_turn` up to 4
   turns and extracting the final JSON; (2) **geocode** every stop via Photon (`photon.komoot.io`,
   drop/disambiguate so no hallucinated place reaches the map); (3) **route** via OSRM
   (`router.project-osrm.org`) + per-mode time estimates. Write status + result into the Convex
   `dayPlans` doc.
3. **The six "aiProxy" endpoints — move the real Anthropic logic IN-HOUSE** (it currently lives
   off-repo on a Vercel app, behind a shared secret): `POST /compare` (country comparison, **20/hr**),
   `POST /surprise` (destination pick, **10/hr**), `POST /visa-guide` (visa application guide gen,
   **5/hr**), `POST /visa-chat` (guide Q&A, **30/hr**), `POST /scan-booking` (Claude **vision** OCR of
   a booking screenshot → structured booking, **10/hr**), `POST /trip-chat` (itinerary-editing copilot
   that can return a full or by-day itinerary update, **30/hr**). The exact request/response JSON
   shapes are in `convex/aiProxy.ts` and the client call sites — preserve them. The Vercel-side prompts
   are off-repo: reconstruct faithful prompts that produce the exact response shapes the client
   expects, and note this in the README.
4. **Trip refinement — `POST /trips/refine`** (`startAnalysis → runAnalysis`, **10/hr**): one
   non-streaming Anthropic call deciding **0–3 clarifying questions** (`choice|text`, with `options` +
   `summarizePattern`), `max_tokens: 1024`, 30s timeout + 1 retry; settle the `refinementSessions` doc.
5. **Country tips** generation (the country-tips branch of generation) + the `countryTips` cache read.
6. **Image enrichment** (`/trip-images` hero/day/activity, `/stop-photos` Google Places) — non-LLM,
   for parity; needs `GOOGLE_PLACES_KEY`.
7. **Non-AI CRUD / collab / bookings / email-sync / notifications** — if Convex keeps serving these
   to the app directly, FastAPI need only own the AI; otherwise port them last as thin routes over the
   Convex Python client, preserving `requireAuth` / `checkTripPermission` semantics and the
   capability-token share path.

**Eval focus:** itinerary validity (day count == duration; every stop has a real named place/area;
no banned filler words), visa-guide groundedness, scan-booking field-extraction accuracy on a small
labelled set, and day-plan stop **geocode success rate**.

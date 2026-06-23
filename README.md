# Visa Atlas

A premium mobile travel companion that turns visa requirements, country research, and trip planning into a single polished experience. Explore an interactive world map, check visa rules for your passport, generate full AI itineraries, plan day trips, and collaborate on trips with friends.

Built with Expo (React Native) and a [Convex](https://convex.dev) realtime backend.

## Features

- **Atlas map** — an interactive MapLibre world map for exploring destinations and visa status at a glance.
- **Visa requirements** — passport-aware visa rules, country tips, and detailed visa guides.
- **Country compare** — put destinations side by side before you commit.
- **AI trip generation** — generate complete, structured itineraries (flights, lodging, dining, activities) with streaming responses.
- **Day planner** — input-driven, web-grounded day plans: pick a start point, transport mode, reach, and vibe, and get a geocoded, routed day.
- **Trips** — manage upcoming and past trips, bookings, and logistics with rich detail screens.
- **Visa chat** — ask questions about visas and travel and get grounded answers.
- **Collaboration** — invite collaborators, share trips via revocable links, and vote on plans together.
- **Accounts** — email/OTP and Apple sign-in, push notifications, and per-user visa profiles.

## Tech stack

- **App:** Expo `~54`, React Native `0.81`, React `19`, Expo Router, TypeScript
- **Backend:** Convex (queries, mutations, actions, scheduler, auth)
- **Maps:** MapLibre React Native, TopoJSON / world-atlas
- **UI/motion:** Reanimated 4, Gesture Handler, gorhom Bottom Sheet 5, `react-native-keyboard-controller`, Expo Blur, Lucide / Expo Vector Icons
- **AI:** Anthropic (Claude) via a Convex action proxy with streaming
- **Auth & email:** `@convex-dev/auth`, Apple Authentication, Resend (OTP / transactional email)
- **Testing:** Jest + `jest-expo` + React Native Testing Library

## Project structure

```
app/            Expo Router routes
  (tabs)/       Atlas map, Compare, Guides, Trips
  trip/         Trip detail, itinerary, logistics
  day-planner/  Day-trip planner flow
  visa-chat/    Visa Q&A chat
  country/      Country detail pages
  guide/        Visa guides
  onboarding/   First-run onboarding
  more/         Settings, legal (terms, privacy)
components/     Reusable UI (see components/ui for shared primitives)
constants/      Theme tokens, feature flags
contexts/       App-wide React context providers
convex/         Backend: schema, queries, mutations, actions, auth
data/           Static datasets (visa rules, country data)
types/          Shared TypeScript contracts
utils/          Helpers (geocoding, flight time, animations, etc.)
hooks/          Custom React hooks
```

## Getting started

### Prerequisites

- **Node 22** (see `.nvmrc`) — the Convex CLI requires Node ≥ 20
- Xcode (for iOS) and/or Android Studio (for Android)
- A [Convex](https://convex.dev) account

### Install

```bash
nvm use            # Node 22
npm install        # .npmrc sets legacy-peer-deps=true
```

### Environment

Create a `.env.local` with your Convex deployment values:

```
EXPO_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

Backend secrets (Anthropic, Resend, Apple, Google APIs, etc.) are configured in the Convex dashboard, not in the app `.env`.

### Run the backend

```bash
npx convex dev     # pushes functions and watches for changes
```

### Run the app

```bash
npm run ios        # iOS simulator / device
npm run android    # Android
npm run web        # web (limited — maps and native modules differ)
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run ios` | Build and run on iOS |
| `npm run android` | Build and run on Android |
| `npm run web` | Run in the browser |
| `npm test` | Run the Jest test suite |
| `npm run lint` | Lint with `eslint-config-expo` |

## Deploying Convex changes

After editing anything under `convex/`, push to the dev backend so the running app picks it up:

```bash
npx convex dev --once
```

A single push exits immediately; a no-op deploy means your change wasn't picked up.

## License

Private. All rights reserved.

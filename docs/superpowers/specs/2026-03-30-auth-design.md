# Authentication Design

> Add user authentication to Visa Atlas using Convex Auth with Google, Apple, and Email/Password providers. Auth-gate the entire app so users must sign in before accessing any features.

## Overview

Currently Visa Atlas has no user concept — all data (trips, bookings, visa guides) is unscoped. This feature adds authentication so each user's data is tied to their account, enabling multi-device sync and per-user data isolation.

## Auth Provider: Convex Auth

Use `@convex-dev/auth` which provides:
- Built-in session management and token refresh
- Auto-created `users`, `authAccounts`, `authSessions` tables
- Server-side `auth.getUserId()` for scoping queries
- Client-side `useConvexAuth()` hook for auth state
- `signIn()` and `signOut()` helpers

### Three sign-in methods:
1. **Google OAuth** — via `@auth/core` Google provider
2. **Apple OAuth** — via `@auth/core` Apple provider
3. **Email/Password** — via Convex Auth's built-in `Password` provider with email verification and password reset

## App Flow

1. App loads → `useConvexAuth()` checks session state
2. If `isLoading` → show splash/loading screen (app logo + spinner)
3. If not authenticated → show Sign In screen (full screen, replaces tab navigator)
4. If authenticated → show normal tab navigator

### Sign In Screen (social-first layout):
- App logo + "Visa Atlas" branding at top
- Large "Continue with Google" button (Google branded)
- Large "Continue with Apple" button (black/white)
- Divider: "or"
- Smaller "Sign in with Email" link → opens email form

### Email Form:
- Toggle between "Sign In" and "Create Account"
- **Sign In**: email + password fields + "Forgot Password?" link
- **Create Account**: email + password + confirm password fields
- **Forgot Password**: email field + "Send Reset Link" button
- Validation: email format, password minimum length, confirm match

### After successful auth:
- Session persisted — user stays logged in across app restarts
- On first login, trigger data migration (Phase B — not in this phase)

## Phase A Scope (this spec)

Phase A covers auth setup and sign-in only:
- Install and configure Convex Auth
- Configure Google, Apple, and Password providers
- Create the Sign In screen
- Create the Email form screen
- Add auth gate to root layout
- Add sign-out button to More tab

Phase A does NOT include:
- userId on data tables (Phase B)
- userPreferences table (Phase B)
- VisaProvider refactor (Phase B)
- Query scoping by userId (Phase B)
- Data migration on first login (Phase B)

## Phase B Scope (future spec)

- Add `userId: v.optional(v.string())` to trips, bookings, visaGuides, emailAccounts
- Create `userPreferences` table (heldVisas, favorites, visited, expiryDates, themeMode)
- First-login migration: read AsyncStorage → write to Convex userPreferences, claim unclaimed rows
- Refactor VisaProvider to read/write Convex instead of AsyncStorage
- Scope all queries/mutations by `auth.getUserId()`
- Add `by_user` indexes to all tables
- AsyncStorage becomes offline cache only

## UI Design

### Sign In Screen:
- Full screen, matches app theme (warm peach background in light, midnight in dark)
- Centered vertically
- App icon or logo at top
- "Welcome to Visa Atlas" heading (FontFamily.display)
- "Plan smarter. Travel further." subtitle (FontFamily.serif)
- Google button: white bg, Google logo, "Continue with Google" text
- Apple button: black bg, Apple logo, "Continue with Apple" text
- Divider with "or" text
- "Sign in with Email" text link (FontFamily.condensedSemibold)

### Email Form:
- Slides up from sign-in screen or navigates to new screen
- Segmented toggle: "Sign In" | "Create Account"
- Input fields with existing app styling (theme-aware)
- Submit button colored with colors.primary
- "Forgot Password?" link below sign-in form
- Back arrow to return to social login screen

### More Tab — Sign Out:
- Add "Sign Out" row at the bottom of the settings section
- Red/danger background, consistent with existing "Clear Data" button style
- Shows user email or name if available
- Alert confirmation before signing out

## Environment Variables Required

### Google OAuth:
- `GOOGLE_CLIENT_ID` — Google Cloud Console OAuth client ID (Web type for the Convex auth flow)

### Apple OAuth:
- `APPLE_CLIENT_ID` — Apple Services ID
- `APPLE_TEAM_ID` — Apple Developer Team ID
- `APPLE_KEY_ID` — Apple Sign-In private key ID
- `APPLE_PRIVATE_KEY` — Apple Sign-In private key (PEM)

### Email (Resend for transactional email):
- `RESEND_API_KEY` — for sending verification and password reset emails
- `AUTH_EMAIL_FROM` — sender address (e.g. "Visa Atlas <noreply@visaatlas.app>")

These go in the Convex dashboard environment variables, not in .env.local.

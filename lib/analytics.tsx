// lib/analytics.tsx
//
// PostHog product analytics for Visa Atlas — the single client-side surface.
//
// Why this file is the contract:
//  - <AnalyticsProvider> is the ONE place PostHog is configured (host, autocapture,
//    session replay). Mounted once in app/_layout.tsx, inside ConvexProvider so the
//    identify effect can read the Convex user. If no key is configured it renders
//    children untouched — local dev without a key never breaks.
//  - ANALYTICS is the canonical event-name registry. PostHog matches the literal
//    string, so names are FROZEN here and never generated dynamically (pass variants
//    as properties). Convention: present-tense `category:object_action` snake_case,
//    per PostHog's 2025+ best-practice (posthog.com/docs/product-analytics/best-practices).
//  - useAnalytics() is the null-safe accessor every screen uses. PostHog can be
//    undefined for a frame before the provider settles, so every call guards.
//
// Session replay is intentionally OFF: this app holds passport / visa / travel data,
// and replay (even screenshot-masked) is the wrong default for that. The config is
// wired so it's a one-line flip if we ever want it, with text + image masking on.

import React from 'react';
import { PostHogProvider, usePostHog } from 'posthog-react-native';

/** US cloud ingestion host. Matches the project at us.posthog.com/project/484302. */
export const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Public project API key (phc_...). Write-only, safe to ship in the client bundle
 * (PostHog's own guidance). Env var wins; the committed default keeps the repo
 * self-contained. Same value the Convex backend uses as POSTHOG_API_KEY.
 */
const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ??
  'phc_oNY9JDfxf8AfThtsb9e2qjFxH3FAefFkeo5vwRQJGrzU';

/**
 * Canonical event registry. Add new events HERE, never inline a string at a call
 * site — that's how event taxonomies rot. Grouped by funnel stage / domain.
 */
export const ANALYTICS = {
  // ── Auth ────────────────────────────────────────────────────────────────
  authSignInStarted: 'auth:sign_in_started',
  /** Fire from BOTH client and server so the activation funnel never loses a signup. */
  userSignedUp: 'auth:user_signed_up',
  userSignedIn: 'auth:user_signed_in',
  userSignedOut: 'auth:user_signed_out',

  // ── Onboarding ──────────────────────────────────────────────────────────
  onboardingStarted: 'onboarding:started',
  onboardingCompleted: 'onboarding:completed',

  // ── Trips (the core activation loop) ─────────────────────────────────────
  tripGenerationStarted: 'trip:generation_started',
  tripViewed: 'trip:viewed',
  tripStarred: 'trip:starred',
  tripShared: 'trip:shared',
  tripDeleted: 'trip:deleted',
  dayTweaked: 'trip:day_tweaked',

  // ── Day planner ──────────────────────────────────────────────────────────
  dayPlanStarted: 'day_plan:started',

  // ── Chat / copilot ───────────────────────────────────────────────────────
  chatMessageSent: 'chat:message_sent',

  // ── Visa / explore (feature adoption) ────────────────────────────────────
  visaGuideViewed: 'visa:guide_viewed',
  countryViewed: 'country:viewed',
  countryCompared: 'country:compared',
  countryFavorited: 'country:favorited',
  bookingAdded: 'booking:added',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS)[keyof typeof ANALYTICS];

/** Callers pass plain objects; we cast to PostHog's JSON-typed shape at the boundary. */
type Props = Record<string, unknown>;
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
const asEventProps = (p?: Props) => p as Record<string, JsonValue> | undefined;

/**
 * Wrap the app once. Configures autocapture (touches + lifecycle) and manual
 * screen tracking (captureScreens:false — expo-router screens are captured by
 * hand in app/_layout.tsx, since PostHog's screen autocapture targets
 * react-navigation, not file-based routing). Session replay stays off.
 *
 * Without a configured key it's a transparent pass-through.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{
        host: POSTHOG_HOST,
        // Don't ship dev-build noise into the product project.
        disabled: __DEV__,
        // Privacy-first: replay off. To enable later, set true + keep masking on.
        enableSessionReplay: false,
        sessionReplayConfig: {
          maskAllTextInputs: true,
          maskAllImages: true,
        },
      }}
      autocapture={{
        captureTouches: true,
        // App lifecycle events (open/background) are captured by the top-level
        // captureAppLifecycleEvents option, which is on by default.
        captureScreens: false, // manual in app/_layout.tsx (expo-router)
      }}
    >
      {children}
    </PostHogProvider>
  );
}

export interface Analytics {
  /** Capture a product event. No-op until PostHog has mounted. */
  track: (event: AnalyticsEvent, properties?: Props) => void;
  /** Manual screen view (expo-router driver lives in app/_layout.tsx). */
  screen: (name: string, properties?: Props) => void;
  /** Tie events to a stable Convex user id + set person properties. */
  identify: (distinctId: string, properties?: Props) => void;
  /** Clear identity on sign-out so the next session starts anonymous. */
  reset: () => void;
  /** User-facing analytics opt-out (Settings toggle). */
  optIn: () => void;
  optOut: () => void;
  isOptedOut: () => boolean;
}

/**
 * The accessor every screen uses. Safe before the provider settles and safe when
 * no key is configured — every method is a guarded no-op in that window.
 */
export function useAnalytics(): Analytics {
  const posthog = usePostHog();

  return {
    track: (event, properties) => {
      try {
        posthog?.capture(event, asEventProps(properties));
      } catch {
        /* analytics must never break a user flow */
      }
    },
    screen: (name, properties) => {
      try {
        posthog?.screen(name, asEventProps(properties));
      } catch {
        /* noop */
      }
    },
    identify: (distinctId, properties) => {
      try {
        posthog?.identify(distinctId, asEventProps(properties));
      } catch {
        /* noop */
      }
    },
    reset: () => {
      try {
        posthog?.reset();
      } catch {
        /* noop */
      }
    },
    optIn: () => {
      try {
        posthog?.optIn();
      } catch {
        /* noop */
      }
    },
    optOut: () => {
      try {
        posthog?.optOut();
      } catch {
        /* noop */
      }
    },
    isOptedOut: () => {
      try {
        return posthog?.optedOut ?? false;
      } catch {
        return false;
      }
    },
  };
}

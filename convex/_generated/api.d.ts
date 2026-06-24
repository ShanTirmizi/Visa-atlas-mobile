/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as AppleNative from "../AppleNative.js";
import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as account from "../account.js";
import type * as aiProxy from "../aiProxy.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as countryTips from "../countryTips.js";
import type * as dayPlanner from "../dayPlanner.js";
import type * as emailAccounts from "../emailAccounts.js";
import type * as emailSync from "../emailSync.js";
import type * as emailVerification from "../emailVerification.js";
import type * as http from "../http.js";
import type * as lib_anthropicStream from "../lib/anthropicStream.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_dayPlanLLM from "../lib/dayPlanLLM.js";
import type * as lib_dayTripShape from "../lib/dayTripShape.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_posthog from "../lib/posthog.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_sectionFieldMap from "../lib/sectionFieldMap.js";
import type * as lib_sharePayload from "../lib/sharePayload.js";
import type * as lib_tripCascade from "../lib/tripCascade.js";
import type * as moderation from "../moderation.js";
import type * as notifications from "../notifications.js";
import type * as tripCollaborators from "../tripCollaborators.js";
import type * as tripGeneration from "../tripGeneration.js";
import type * as tripInvites from "../tripInvites.js";
import type * as tripPresence from "../tripPresence.js";
import type * as tripRefinement from "../tripRefinement.js";
import type * as tripShares from "../tripShares.js";
import type * as tripVotes from "../tripVotes.js";
import type * as trips from "../trips.js";
import type * as userProfiles from "../userProfiles.js";
import type * as visaGuides from "../visaGuides.js";
import type * as visaProfiles from "../visaProfiles.js";
import type * as wipeTestData from "../wipeTestData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  AppleNative: typeof AppleNative;
  ResendOTP: typeof ResendOTP;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  account: typeof account;
  aiProxy: typeof aiProxy;
  auth: typeof auth;
  bookings: typeof bookings;
  countryTips: typeof countryTips;
  dayPlanner: typeof dayPlanner;
  emailAccounts: typeof emailAccounts;
  emailSync: typeof emailSync;
  emailVerification: typeof emailVerification;
  http: typeof http;
  "lib/anthropicStream": typeof lib_anthropicStream;
  "lib/auth": typeof lib_auth;
  "lib/dayPlanLLM": typeof lib_dayPlanLLM;
  "lib/dayTripShape": typeof lib_dayTripShape;
  "lib/geo": typeof lib_geo;
  "lib/posthog": typeof lib_posthog;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/sectionFieldMap": typeof lib_sectionFieldMap;
  "lib/sharePayload": typeof lib_sharePayload;
  "lib/tripCascade": typeof lib_tripCascade;
  moderation: typeof moderation;
  notifications: typeof notifications;
  tripCollaborators: typeof tripCollaborators;
  tripGeneration: typeof tripGeneration;
  tripInvites: typeof tripInvites;
  tripPresence: typeof tripPresence;
  tripRefinement: typeof tripRefinement;
  tripShares: typeof tripShares;
  tripVotes: typeof tripVotes;
  trips: typeof trips;
  userProfiles: typeof userProfiles;
  visaGuides: typeof visaGuides;
  visaProfiles: typeof visaProfiles;
  wipeTestData: typeof wipeTestData;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

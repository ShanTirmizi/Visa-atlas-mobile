/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as emailAccounts from "../emailAccounts.js";
import type * as emailSync from "../emailSync.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as tripCollaborators from "../tripCollaborators.js";
import type * as tripInvites from "../tripInvites.js";
import type * as tripPresence from "../tripPresence.js";
import type * as tripVotes from "../tripVotes.js";
import type * as trips from "../trips.js";
import type * as visaGuides from "../visaGuides.js";
import type * as wipeTestData from "../wipeTestData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  account: typeof account;
  auth: typeof auth;
  bookings: typeof bookings;
  emailAccounts: typeof emailAccounts;
  emailSync: typeof emailSync;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  tripCollaborators: typeof tripCollaborators;
  tripInvites: typeof tripInvites;
  tripPresence: typeof tripPresence;
  tripVotes: typeof tripVotes;
  trips: typeof trips;
  visaGuides: typeof visaGuides;
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

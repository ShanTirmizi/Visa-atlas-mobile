// Generic over the id type so branded ids (e.g. Convex's Id<'trips'>) flow
// through findMatchingTrip untouched — callers get back the same id type
// they passed in, no casts needed.
type Trip<TId extends string = string> = {
  _id: TId;
  countryCode: string;
  startDate?: string;
  endDate?: string;
  duration: number;
  isMultiCountry?: boolean;
  legs?: string; // JSON array of leg objects with countryCode
};

type MatchResult<TId extends string = string> = {
  tripId: TId;
  confidence: 'high' | 'medium' | 'low';
};

const BUFFER_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Extracts all country codes associated with a trip.
 * For multi-country trips, parses the legs JSON to get additional country codes.
 */
function getTripCountries(trip: Trip): string[] {
  const countries = [trip.countryCode];

  if (trip.isMultiCountry && trip.legs) {
    try {
      const legs = JSON.parse(trip.legs) as { countryCode?: string }[];
      for (const leg of legs) {
        if (leg.countryCode) {
          countries.push(leg.countryCode);
        }
      }
    } catch {
      // Gracefully handle JSON parse errors
    }
  }

  return countries;
}

/**
 * Finds the best matching trip for a booking based on country code and date overlap.
 * Returns a MatchResult with the trip ID and confidence level, or null if no match.
 */
export function findMatchingTrip<TId extends string = string>(
  countryCode: string | undefined | null,
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  trips: Trip<TId>[]
): MatchResult<TId> | null {
  if (!countryCode || !trips || trips.length === 0) {
    return null;
  }

  let bestScore = 0;
  let bestTripId: TId | null = null;

  for (const trip of trips) {
    if (!trip.startDate) {
      continue;
    }

    const tripStart = new Date(trip.startDate).getTime();
    const tripEnd = trip.endDate
      ? new Date(trip.endDate).getTime()
      : tripStart + trip.duration * BUFFER_MS; // duration in days

    const bookingStart = startDate
      ? new Date(startDate).getTime()
      : 0;
    const bookingEnd = endDate
      ? new Date(endDate).getTime()
      : bookingStart || 0;

    // Check date overlap with 1-day buffer on each side
    const hasOverlap =
      bookingStart <= tripEnd + BUFFER_MS &&
      bookingEnd >= tripStart - BUFFER_MS;

    if (!hasOverlap) {
      continue;
    }

    const tripCountries = getTripCountries(trip);
    const hasCountryMatch = tripCountries.includes(countryCode);

    let score = 0;
    if (hasCountryMatch) {
      // Exact country match + date overlap
      score = 3;
    } else if (!trip.isMultiCountry) {
      // Date overlap on a single-country trip without country match
      score = 2;
    } else {
      // Date overlap on a multi-country trip without country match
      score = 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTripId = trip._id;
    }
  }

  if (!bestTripId) {
    return null;
  }

  let confidence: 'high' | 'medium' | 'low';
  if (bestScore >= 3) {
    confidence = 'high';
  } else if (bestScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    tripId: bestTripId,
    confidence,
  };
}

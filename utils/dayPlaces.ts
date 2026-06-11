// Pure helpers for the day-detail mini-map strip.
//
// The itinerary only stores place NAMES (LLM output like "Tsukiji Outer
// Market") — no coordinates, and we deliberately don't geocode them
// client-side. These helpers extract the day's named stops and resolve
// the trip's destination country to its capital coordinates (the only
// real coordinates we have, from data/countryCoordinates.ts) so the map
// can honestly show destination context without inventing pin positions.

import { visaData } from '@/data/visaData';
import { countryCoordinates } from '@/data/countryCoordinates';
import { countryMeta } from '@/data/countryMeta';

/** The three optional named-place slots on an itinerary day. */
export interface DayPlaceSlots {
  morningPlace?: string;
  afternoonPlace?: string;
  eveningPlace?: string;
}

export type DaySlot = 'Morning' | 'Afternoon' | 'Evening';

export interface DayPlace {
  slot: DaySlot;
  name: string;
}

/** Extracts the day's non-empty named places in chronological order. */
export function getDayPlaces(day: DayPlaceSlots): DayPlace[] {
  const slots: Array<[DaySlot, string | undefined]> = [
    ['Morning', day.morningPlace],
    ['Afternoon', day.afternoonPlace],
    ['Evening', day.eveningPlace],
  ];
  const places: DayPlace[] = [];
  for (const [slot, raw] of slots) {
    const name = (raw ?? '').trim();
    if (name.length > 0) places.push({ slot, name });
  }
  return places;
}

export interface DestinationGeo {
  /** Capital-city coordinate in MapLibre order: [lng, lat]. */
  center: [number, number];
  /** Capital city name — used to honestly label what the camera shows. */
  capital: string;
  /** ISO 3166-1 alpha-3 code of the resolved country. */
  countryCode: string;
}

// Lazy name → country lookup. Trip docs store the same display names as
// data/visaData.ts (the planner picks destinations from that list), so an
// exact case-insensitive match is reliable; unknown names return null and
// the caller degrades gracefully (rows without the map).
let nameLookup: Map<string, string> | null = null;
function getNameLookup(): Map<string, string> {
  if (nameLookup === null) {
    nameLookup = new Map();
    for (const country of visaData) {
      nameLookup.set(country.name.trim().toLowerCase(), country.code);
    }
  }
  return nameLookup;
}

/** Resolves a destination country name to its capital's coordinates.
 *  Returns null when the name can't be matched or has no coordinates —
 *  callers should then skip the map and keep the useful parts. */
export function resolveDestinationGeo(
  countryName: string | undefined,
): DestinationGeo | null {
  const needle = (countryName ?? '').trim().toLowerCase();
  if (needle.length === 0) return null;

  const code = getNameLookup().get(needle);
  if (!code) return null;

  const coord = countryCoordinates[code];
  if (!coord) return null;

  return {
    center: [coord.lng, coord.lat],
    capital: countryMeta[code]?.capital ?? countryName!.trim(),
    countryCode: code,
  };
}

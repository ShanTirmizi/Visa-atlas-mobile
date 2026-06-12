// utils/photoAlbum.ts
//
// Assembles the ordered, captioned photo album the full-screen PhotoViewer
// pages through. One album per day (day hero → morning → afternoon →
// evening, each slot's anchor image followed by its stops' Google Places
// photos), plus a trip-level album for the overview hero. Pure functions —
// every entry point (deck card pill, day-detail hero, slot thumbs, stop
// strips) opens the SAME album so swiping always covers the whole day.

import {
  type ItineraryDay,
  type StopPhotoSet,
  type StopSlot,
  hasStructuredStops,
  photosForStop,
  stopsForSlot,
} from '@/types/itinerary';

export interface AlbumPhoto {
  url: string;
  thumb?: string;
  /** Place / context name — the lightbox caption title. */
  title?: string;
  /** Mono kicker above the title, e.g. "DAY 4 · MORNING". */
  kicker?: string;
  credit?: string;
  creditUrl?: string;
  /** Slot the photo belongs to (day albums only) — lets slot-header thumbs
   *  deep-link to their section of the album. */
  slot?: StopSlot;
}

/** Loose shape shared by dayImages / activityImages / heroImage parses. */
export type AlbumImageSource = {
  url: string;
  thumb?: string;
  credit?: string;
  creditUrl?: string;
} | null;

const SLOTS: StopSlot[] = ['morning', 'afternoon', 'evening'];

const SLOT_LABEL: Record<StopSlot, string> = {
  morning: 'MORNING',
  afternoon: 'AFTERNOON',
  evening: 'EVENING',
};

const SLOT_PLACE: Record<StopSlot, 'morningPlace' | 'afternoonPlace' | 'eveningPlace'> = {
  morning: 'morningPlace',
  afternoon: 'afternoonPlace',
  evening: 'eveningPlace',
};

/**
 * The full photo album for one itinerary day, in timeline order:
 * scenic day hero first, then per slot the anchor activity image followed
 * by each stop's Places photos. De-duped by url; the slot anchor is
 * skipped when the same place carries its own Places set (its first photo
 * IS that shot at higher resolution).
 */
export function buildDayAlbum(opts: {
  day: ItineraryDay;
  /** Authoritative 1-based day number (`day.day`) — also the stopPhotos key. */
  dayNumber: number;
  dayImage?: AlbumImageSource;
  slotImages?: Partial<Record<StopSlot, AlbumImageSource>>;
  stopPhotos?: StopPhotoSet[];
}): AlbumPhoto[] {
  const { day, dayNumber, dayImage, slotImages = {}, stopPhotos = [] } = opts;

  const album: AlbumPhoto[] = [];
  const seenUrls = new Set<string>();
  const push = (photo: AlbumPhoto) => {
    if (!photo.url || seenUrls.has(photo.url)) return;
    seenUrls.add(photo.url);
    album.push(photo);
  };

  const dayKicker = `DAY ${dayNumber}`;
  if (dayImage?.url) {
    push({
      url: dayImage.url,
      thumb: dayImage.thumb,
      title: day.title?.trim() || `Day ${dayNumber}`,
      kicker: dayKicker,
      credit: dayImage.credit,
      creditUrl: dayImage.creditUrl,
    });
  }

  const structured = hasStructuredStops(day);
  for (const slot of SLOTS) {
    const kicker = `${dayKicker} · ${SLOT_LABEL[slot]}`;
    const anchorPlace = (day[SLOT_PLACE[slot]] ?? '').trim();
    const slotStops = structured ? stopsForSlot(day, slot) : [];
    // Legacy days (no structured stops) treat the slot anchor place as the
    // slot's only "stop" — the server fetches its photos under that name.
    const placeNames =
      slotStops.length > 0 ? slotStops.map((s) => s.name) : anchorPlace ? [anchorPlace] : [];

    const anchorImage = slotImages[slot];
    const anchorHasOwnSet =
      anchorPlace.length > 0 && photosForStop(stopPhotos, dayNumber, anchorPlace).length > 0;
    if (anchorImage?.url && !anchorHasOwnSet) {
      push({
        url: anchorImage.url,
        thumb: anchorImage.thumb,
        title: anchorPlace || day.title?.trim() || `Day ${dayNumber}`,
        kicker,
        credit: anchorImage.credit,
        creditUrl: anchorImage.creditUrl,
        slot,
      });
    }

    for (const name of placeNames) {
      for (const photo of photosForStop(stopPhotos, dayNumber, name)) {
        push({
          url: photo.url,
          thumb: photo.thumb,
          title: name,
          kicker,
          credit: photo.credit,
          creditUrl: photo.creditUrl,
          slot,
        });
      }
    }
  }

  return album;
}

/**
 * Trip-level album for the overview hero: destination hero shot, then each
 * day's scenic image captioned with that day's title.
 */
export function buildTripAlbum(opts: {
  heroImage?: AlbumImageSource;
  destination?: string;
  dayImages?: AlbumImageSource[];
  days?: ItineraryDay[];
}): AlbumPhoto[] {
  const { heroImage, destination, dayImages = [], days = [] } = opts;

  const album: AlbumPhoto[] = [];
  const seenUrls = new Set<string>();
  const push = (photo: AlbumPhoto) => {
    if (!photo.url || seenUrls.has(photo.url)) return;
    seenUrls.add(photo.url);
    album.push(photo);
  };

  if (heroImage?.url) {
    push({
      url: heroImage.url,
      thumb: heroImage.thumb,
      title: destination,
      kicker: 'THE TRIP',
      credit: heroImage.credit,
      creditUrl: heroImage.creditUrl,
    });
  }

  dayImages.forEach((img, idx) => {
    if (!img?.url) return;
    // dayImages is indexed by STORED day offset; match titles through the
    // authoritative 1-based day.day, not array position.
    const day = days.find((d) => (d?.day ?? 0) === idx + 1);
    push({
      url: img.url,
      thumb: img.thumb,
      title: day?.title?.trim() || `Day ${idx + 1}`,
      kicker: `DAY ${idx + 1}`,
      credit: img.credit,
      creditUrl: img.creditUrl,
    });
  });

  return album;
}

/** Album index of the first photo in a slot — slot-header thumbs open the
 *  day album scrolled to their own section. Falls back to the top. */
export function firstIndexForSlot(album: AlbumPhoto[], slot: StopSlot): number {
  const idx = album.findIndex((p) => p.slot === slot);
  return idx >= 0 ? idx : 0;
}

/** Album index of a tapped photo, matched by url or thumb. Falls back to
 *  the top rather than refusing to open. */
export function indexOfAlbumPhoto(album: AlbumPhoto[], urlOrThumb: string): number {
  const idx = album.findIndex((p) => p.url === urlOrThumb || p.thumb === urlOrThumb);
  return idx >= 0 ? idx : 0;
}

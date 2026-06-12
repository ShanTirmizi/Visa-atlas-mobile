// Tests for the pure album-assembly helpers in utils/photoAlbum.ts — the
// data contract behind the full-screen PhotoViewer. Every photo entry
// point (deck-card pill, day-detail hero/chip, slot thumbs, stop strips)
// opens an album these functions build, so ordering, captioning, and
// de-duplication are spec here, not presentation detail.
import {
  buildDayAlbum,
  buildTripAlbum,
  firstIndexForSlot,
  indexOfAlbumPhoto,
} from '../photoAlbum';
import type { ItineraryDay, StopPhotoSet } from '../../types/itinerary';

const baseDay: ItineraryDay = {
  day: 4,
  title: 'Old Town wander',
  morning: 'Morning prose',
  morningPlace: 'Senso-ji Temple',
  afternoon: 'Afternoon prose',
  afternoonPlace: 'Nakamise Street',
  evening: 'Evening prose',
  eveningPlace: 'Tokyo Skytree',
  stops: [
    { slot: 'morning', name: 'Senso-ji Temple', note: 'Go early.' },
    { slot: 'morning', name: 'Asakusa Shrine', note: 'Quieter neighbour.' },
    { slot: 'evening', name: 'Tokyo Skytree', note: 'Sunset slot.' },
  ],
};

const stopPhotos: StopPhotoSet[] = [
  {
    day: 4,
    stop: 'Senso-ji Temple',
    photos: [
      { url: 'https://g/senso-1', thumb: 'https://g/senso-1', credit: 'A' },
      { url: 'https://g/senso-2', thumb: 'https://g/senso-2', credit: 'B' },
    ],
  },
  {
    day: 4,
    stop: 'Asakusa Shrine',
    photos: [{ url: 'https://g/asakusa-1', credit: 'C', creditUrl: 'https://c' }],
  },
  // Different day — must never leak into day 4's album.
  {
    day: 5,
    stop: 'Senso-ji Temple',
    photos: [{ url: 'https://g/wrong-day' }],
  },
];

const dayImage = { url: 'https://px/day4', thumb: 'https://px/day4-t', credit: 'Pexels P' };
const morningImage = { url: 'https://g/anchor-morning', thumb: 'https://g/anchor-morning-t', credit: 'G' };
const eveningImage = { url: 'https://g/anchor-evening', thumb: 'https://g/anchor-evening-t', credit: 'G' };

describe('buildDayAlbum — ordering, captions, dedupe', () => {
  it('orders day hero → slot photos in timeline order, with kickers', () => {
    const album = buildDayAlbum({
      day: baseDay,
      dayNumber: 4,
      dayImage,
      slotImages: { morning: morningImage, evening: eveningImage },
      stopPhotos,
    });

    expect(album.map((p) => p.url)).toEqual([
      'https://px/day4', // scenic day hero leads
      'https://g/senso-1', // morning stop 1 (anchor skipped — same place has its own set)
      'https://g/senso-2',
      'https://g/asakusa-1', // morning stop 2
      'https://g/anchor-evening', // evening anchor kept (Skytree has no set)
    ]);
    expect(album[0].kicker).toBe('DAY 4');
    expect(album[1].kicker).toBe('DAY 4 · MORNING');
    expect(album[1].title).toBe('Senso-ji Temple');
    expect(album[4].kicker).toBe('DAY 4 · EVENING');
  });

  it('skips the slot anchor image when the anchor place carries its own set', () => {
    const album = buildDayAlbum({
      day: baseDay,
      dayNumber: 4,
      slotImages: { morning: morningImage },
      stopPhotos,
    });
    // The morning anchor (Senso-ji) has its own 2-photo set, so the lower-res
    // anchor shot must not appear next to the same photo at 1200px.
    expect(album.some((p) => p.url === 'https://g/anchor-morning')).toBe(false);
  });

  it('matches stop photos case/whitespace-insensitively and never across days', () => {
    const day: ItineraryDay = {
      ...baseDay,
      stops: [{ slot: 'morning', name: '  SENSO-JI  temple ', note: 'n' }],
    };
    const album = buildDayAlbum({ day, dayNumber: 4, stopPhotos });
    expect(album.map((p) => p.url)).toEqual(['https://g/senso-1', 'https://g/senso-2']);
    expect(album.some((p) => p.url === 'https://g/wrong-day')).toBe(false);
  });

  it('legacy days (no stops) fall back to slot anchor places as pseudo-stops', () => {
    const legacyDay: ItineraryDay = { ...baseDay, stops: undefined };
    const album = buildDayAlbum({ day: legacyDay, dayNumber: 4, stopPhotos });
    // morningPlace = Senso-ji Temple → its set resolves by place name.
    expect(album.map((p) => p.url)).toContain('https://g/senso-1');
  });

  it('de-dupes by url and tolerates a fully-absent photo world', () => {
    const dupSets: StopPhotoSet[] = [
      { day: 4, stop: 'Senso-ji Temple', photos: [{ url: 'https://px/day4' }] },
    ];
    const album = buildDayAlbum({
      day: baseDay,
      dayNumber: 4,
      dayImage,
      stopPhotos: dupSets,
    });
    expect(album.filter((p) => p.url === 'https://px/day4')).toHaveLength(1);

    expect(buildDayAlbum({ day: baseDay, dayNumber: 4 })).toEqual([]);
  });
});

describe('buildTripAlbum — hero + day images by authoritative day number', () => {
  it('captions day images via day.day, not array position', () => {
    const album = buildTripAlbum({
      heroImage: { url: 'https://px/hero', credit: 'H' },
      destination: 'Japan',
      dayImages: [{ url: 'https://px/d1' }, null, { url: 'https://px/d3' }],
      // Day 2 was a filtered null hole — day.day stays authoritative.
      days: [
        { ...baseDay, day: 1, title: 'Arrival' },
        { ...baseDay, day: 3, title: 'Mountains' },
      ],
    });
    expect(album.map((p) => p.url)).toEqual([
      'https://px/hero',
      'https://px/d1',
      'https://px/d3',
    ]);
    expect(album[0].kicker).toBe('THE TRIP');
    expect(album[0].title).toBe('Japan');
    expect(album[2].kicker).toBe('DAY 3');
    expect(album[2].title).toBe('Mountains');
  });
});

describe('viewer deep-link helpers', () => {
  const album = buildDayAlbum({
    day: baseDay,
    dayNumber: 4,
    dayImage,
    slotImages: { morning: morningImage, evening: eveningImage },
    stopPhotos,
  });

  it('firstIndexForSlot lands on the slot section, falling back to 0', () => {
    expect(firstIndexForSlot(album, 'morning')).toBe(1);
    expect(firstIndexForSlot(album, 'evening')).toBe(4);
    expect(firstIndexForSlot(album, 'afternoon')).toBe(0); // no afternoon photos
  });

  it('indexOfAlbumPhoto matches by url or thumb, falling back to 0', () => {
    expect(indexOfAlbumPhoto(album, 'https://g/senso-2')).toBe(2);
    expect(indexOfAlbumPhoto(album, 'https://px/day4-t')).toBe(0); // thumb match
    expect(indexOfAlbumPhoto(album, 'https://nope')).toBe(0);
  });
});

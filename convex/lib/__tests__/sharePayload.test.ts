import { buildSharedTripPayload } from "../sharePayload";

const baseTrip = {
  _id: "t1", _creationTime: 1, userId: "u1",
  countryCode: "JPN", countryName: "Japan", region: "Asia", capital: "Tokyo",
  currency: "JPY", language: "Japanese", timezone: "JST", iataCode: "TYO",
  status: "planned", duration: 3, costLevel: 3, dailyBudget: "£150",
  flightHours: 13, visaCategory: "evisa", visaNotes: "SECRET-VISA-NOTE",
  visaCost: "£30", startDate: "2026-07-01", endDate: "2026-07-04",
  itinerary: JSON.stringify([{ day: 1, title: "Arrival", morning: "m", afternoon: "a", evening: "e", stops: [{ slot: "morning", name: "Senso-ji", note: "go" }] }]),
  budgetBreakdown: JSON.stringify({ totalTrip: "SECRET-BUDGET" }),
  packingSuggestions: "{}", visaChecklist: "[]", highlights: "[]",
  accommodationTips: "{}",
  heroImage: JSON.stringify({ url: "https://img/h.jpg", credit: "Ann", creditUrl: "https://u" }),
  dayImages: JSON.stringify([{ url: "https://img/d1.jpg", thumb: "https://img/d1t.jpg", credit: "Bob", creditUrl: "https://u2" }]),
  diningGuide: JSON.stringify({ intro: "Eat well.", mustTry: [{ dish: "Ramen", note: "n" }], spots: [{ name: "Ichiran", cuisine: "Ramen", price: "$", area: "Shibuya", knownFor: "k", why: "w", meals: ["dinner"] }] }),
  localGuide: JSON.stringify({ tipping: "None", tapWater: "safe", plugType: "A", scamWarnings: ["x"], localCustoms: ["y"], apps: [{ name: "Suica", purpose: "transit" }], cashOrCard: "card", connectivity: "eSIM", dressCode: "casual" }),
  localEssentials: JSON.stringify({ emergencyNumber: "110", policeNumber: "110", ambulanceNumber: "119" }),
  userNotes: "SECRET-NOTES", refinementAnswers: ["SECRET-ANSWER"],
  checklistProgress: ["SECRET-TICK"],
} as never;

describe("buildSharedTripPayload", () => {
  it("includes itinerary, dining, images, meta", () => {
    const p = buildSharedTripPayload(baseTrip);
    expect(p.countryName).toBe("Japan");
    expect(p.duration).toBe(3);
    expect(p.startDate).toBe("2026-07-01");
    expect(p.itinerary).toHaveLength(1);
    expect(p.itinerary[0].stops?.[0].name).toBe("Senso-ji");
    expect(p.diningGuide?.spots[0].name).toBe("Ichiran");
    expect(p.heroImage?.url).toBe("https://img/h.jpg");
    expect(p.heroImage?.credit).toBe("Ann");
    expect(p.dayImages?.[0].thumb).toBe("https://img/d1t.jpg");
    expect(p.localGuide?.tipping).toBe("None");
    expect(p.localEssentials?.emergencyNumber).toBe("110");
  });

  it("redacts private fields entirely (no key present)", () => {
    const p = buildSharedTripPayload(baseTrip) as unknown as Record<string, unknown>;
    const json = JSON.stringify(p);
    expect(json).not.toContain("SECRET");
    for (const k of ["userId", "userNotes", "refinementAnswers", "visaCategory", "visaNotes", "visaCost", "budgetBreakdown", "dailyBudget", "checklistProgress", "visaChecklist"]) {
      expect(k in p).toBe(false);
    }
  });

  it("strips unknown nested keys injected into days, stops, and dining spots", () => {
    // Days/stops/spots are client-writable JSON (trips.updateTripField) —
    // an editor-injected key must never reach the public payload.
    const t = baseTrip as unknown as Record<string, unknown>;
    const days = JSON.parse(t.itinerary as string) as Record<string, unknown>[];
    days[0].secretKey = "SECRET-DAY";
    (days[0].stops as Record<string, unknown>[])[0].secretStop = "SECRET-STOP";
    const dining = JSON.parse(t.diningGuide as string) as { spots: Record<string, unknown>[] };
    dining.spots[0].secretSpot = "SECRET-SPOT";
    const poisoned = { ...t, itinerary: JSON.stringify(days), diningGuide: JSON.stringify(dining) } as never;
    const p = buildSharedTripPayload(poisoned);
    expect(JSON.stringify(p)).not.toContain("SECRET");
    // The legit nested content still survives the rebuild.
    expect(p.itinerary[0].title).toBe("Arrival");
    expect(p.itinerary[0].stops?.[0].name).toBe("Senso-ji");
    expect(p.diningGuide?.spots[0].name).toBe("Ichiran");
  });

  it("rejects non-https image urls and unknown image keys", () => {
    const t = baseTrip as unknown as Record<string, unknown>;
    const poisoned = {
      ...t,
      heroImage: JSON.stringify({ url: "javascript:alert(1)" }),
      activityImages: JSON.stringify([
        { url: "https://img/a1.jpg", source: "unsplash" },
        { url: "http://img/a2.jpg" },
      ]),
    } as never;
    const p = buildSharedTripPayload(poisoned);
    expect(p.heroImage).toBeNull();
    expect(p.activityImages).toHaveLength(1);
    expect(p.activityImages?.[0].url).toBe("https://img/a1.jpg");
    // `source` is not a SharedImage key — rebuilt entries must not carry it.
    expect("source" in (p.activityImages?.[0] ?? {})).toBe(false);
  });

  it("tolerates legacy trips: missing dining/images/stops, malformed JSON", () => {
    const legacy = { ...(baseTrip as unknown as Record<string, unknown>), diningGuide: undefined, heroImage: undefined, dayImages: "not-json", localGuide: undefined, localEssentials: undefined, itinerary: JSON.stringify([{ day: 1, title: "Old", morning: "m", afternoon: "a", evening: "e" }]) } as never;
    const p = buildSharedTripPayload(legacy);
    expect(p.diningGuide).toBeNull();
    expect(p.heroImage).toBeNull();
    expect(p.dayImages).toBeNull();
    expect(p.stopPhotos).toBeNull();
    expect(p.itinerary[0].title).toBe("Old");
  });

  it("projects stopPhotos: valid sets survive, junk and non-https are dropped", () => {
    const t = baseTrip as unknown as Record<string, unknown>;
    const withPhotos = {
      ...t,
      stopPhotos: JSON.stringify([
        {
          day: 1,
          stop: "Senso-ji",
          photos: [
            { url: "https://g/p1", thumb: "https://g/p1", credit: "Ann", creditUrl: "https://c1", source: "google", secretPhotoKey: "SECRET-PHOTO" },
            { url: "javascript:alert(1)" },
          ],
        },
        // Invalid shapes: bad day, missing stop, photo-less — all dropped.
        { day: 0, stop: "Bad day", photos: [{ url: "https://g/x" }] },
        { day: 2, photos: [{ url: "https://g/y" }] },
        { day: 2, stop: "No photos", photos: [{ url: "http://insecure" }] },
        "junk",
      ]),
    } as never;
    const p = buildSharedTripPayload(withPhotos);
    expect(p.stopPhotos).toHaveLength(1);
    expect(p.stopPhotos?.[0]).toEqual({
      day: 1,
      stop: "Senso-ji",
      photos: [{ url: "https://g/p1", thumb: "https://g/p1", credit: "Ann", creditUrl: "https://c1" }],
    });
    // Unknown nested keys (source, injected junk) never cross the boundary.
    expect(JSON.stringify(p)).not.toContain("SECRET-PHOTO");
    expect(JSON.stringify(p)).not.toContain("source");
  });

  it("caps stopPhotos at 80 sets × 4 photos", () => {
    const t = baseTrip as unknown as Record<string, unknown>;
    const big = Array.from({ length: 90 }, (_, i) => ({
      day: 1,
      stop: `Stop ${i}`,
      photos: Array.from({ length: 6 }, (_, j) => ({ url: `https://g/${i}-${j}` })),
    }));
    const p = buildSharedTripPayload({ ...t, stopPhotos: JSON.stringify(big) } as never);
    expect(p.stopPhotos).toHaveLength(80);
    expect(p.stopPhotos?.[0].photos).toHaveLength(4);
  });
});

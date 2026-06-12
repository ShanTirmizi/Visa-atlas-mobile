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

  it("tolerates legacy trips: missing dining/images/stops, malformed JSON", () => {
    const legacy = { ...(baseTrip as unknown as Record<string, unknown>), diningGuide: undefined, heroImage: undefined, dayImages: "not-json", localGuide: undefined, localEssentials: undefined, itinerary: JSON.stringify([{ day: 1, title: "Old", morning: "m", afternoon: "a", evening: "e" }]) } as never;
    const p = buildSharedTripPayload(legacy);
    expect(p.diningGuide).toBeNull();
    expect(p.heroImage).toBeNull();
    expect(p.dayImages).toBeNull();
    expect(p.itinerary[0].title).toBe("Old");
  });
});

/**
 * Rotating placeholder examples for the "Anything else?" field on the trip
 * planner sheet. Cycled every ~3500ms via cross-fade when the field is empty
 * + unfocused (see TripPlannerNotesField).
 *
 * Each entry is a concrete, evocative example that hints at the breadth of
 * what users can write — scope (cities), pace, interests, must-sees.
 */
export const PLANNER_PROMPTS = [
  'Just Berlin and Munich, slow pace',
  'Lots of street food, skip the museums',
  'Family-friendly, lots of nature',
  'Skip the cities, beach time',
  'Must include the Tiergarten',
  'Slow mornings, late dinners',
] as const;

export type PlannerPrompt = (typeof PLANNER_PROMPTS)[number];

# CLAUDE.md

## Quality Philosophy

- **Always choose the premium approach.** Never recommend a simpler option just because the better one is "high effort" — Claude is doing the implementation, not a human team, so complexity is not a cost. If the best solution requires a new library, a full rewrite, or a complex architecture, do it.
- **The app must feel premium.** Every screen, animation, and interaction should feel polished and intentional. Think award-winning travel app, not MVP prototype. When in doubt, look at how Airbnb, Apple Maps, or Revolut would do it.
- **No cutting corners on UI/UX.** Don't ship "good enough" — ship "this feels great." If a feature needs 500 lines to feel right, write 500 lines. If a library swap makes a feature dramatically better, swap the library.

## TypeScript Guidelines

- Never use `any`. Use `unknown` when the type is not known, then narrow with type guards.
- Prefer explicit type annotations over implicit `any` from untyped libraries.
- Use Convex's `Id<"tableName">` and `Doc<"tableName">` types for document references.

## Styling Guidelines

- Never use hardcoded `rgba()` values. Use theme color tokens from `constants/theme.ts` instead.
- If a needed color token doesn't exist, add it to the `LightColors` and `DarkColors` objects in `constants/theme.ts`.
- All colors must come from `useTheme().colors` — no inline hex or rgba values except `#FFFFFF` for white text on colored backgrounds.

## Convex Security Guidelines

- Every public Convex query, mutation, and action MUST call `requireAuth(ctx)` or `checkTripPermission(ctx, ...)` at the top of its handler. No exceptions.
- After getting the userId from `requireAuth`, always verify ownership before reading or modifying a document (e.g., `if (doc.userId !== userId) throw new Error("...")`).
- Never accept a userId as a function argument for authorization. Always derive it server-side via `requireAuth`.

## UI Conventions (follow existing patterns)

- **Component reuse**: Always check `components/ui/` for existing reusable components before creating inline implementations. If a UI pattern is used in 2+ places, extract it into a shared component in `components/ui/`. Never duplicate component logic across screens. Key shared components:
  - `BackButton` — `components/ui/BackButton.tsx` for the standard white 40x40 back navigation button. Never create inline `backBtn` styles — always use this component.
  - `SegmentedControl` — `components/ui/SegmentedControl.tsx` for ALL tab-switching UI (e.g., My Trips/Bookings, Overview/Itinerary/Logistics, Editor/Viewer). Never build inline tab pickers — always use this component.
- **Bottom sheets**: Use `enableDynamicSizing={true}` with `maxDynamicContentSize` set to `Dimensions.get('window').height - safeAreaInsets.top - 10`. This auto-fits content and caps just below the Dynamic Island / status bar (industry standard: Apple Maps, Uber, Airbnb). Never use fixed percentage snap points.
- **Bottom sheet backgrounds**: Use the relevant booking type color for booking sheets, `colors.background` for generic sheets.
- **Always check existing codebase patterns** before introducing new UI conventions. If a pattern exists (back button style, card radius, shadow), follow it exactly.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

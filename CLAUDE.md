# CLAUDE.md

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

- **Back button**: White square, 40x40, `borderRadius: Radius.sm`, `backgroundColor: '#FFFFFF'`, dark arrow icon. See `app/trip/[id].tsx` backBtn style. Always follow this pattern.
- **Bottom sheets**: Use `enableDynamicSizing={true}` with `maxDynamicContentSize` set to `Dimensions.get('window').height - safeAreaInsets.top - 10`. This auto-fits content and caps just below the Dynamic Island / status bar (industry standard: Apple Maps, Uber, Airbnb). Never use fixed percentage snap points.
- **Bottom sheet backgrounds**: Use the relevant booking type color for booking sheets, `colors.background` for generic sheets.
- **Always check existing codebase patterns** before introducing new UI conventions. If a pattern exists (back button style, card radius, shadow), follow it exactly.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

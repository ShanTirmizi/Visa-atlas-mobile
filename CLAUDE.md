# CLAUDE.md

## TypeScript Guidelines

- Never use `any`. Use `unknown` when the type is not known, then narrow with type guards.
- Prefer explicit type annotations over implicit `any` from untyped libraries.
- Use Convex's `Id<"tableName">` and `Doc<"tableName">` types for document references.

## Styling Guidelines

- Never use hardcoded `rgba()` values. Use theme color tokens from `constants/theme.ts` instead.
- If a needed color token doesn't exist, add it to the `LightColors` and `DarkColors` objects in `constants/theme.ts`.
- All colors must come from `useTheme().colors` — no inline hex or rgba values except `#FFFFFF` for white text on colored backgrounds.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

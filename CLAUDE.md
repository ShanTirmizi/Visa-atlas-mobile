# CLAUDE.md

## Research before writing — non-negotiable

**Before fixing a bug or building a new feature, look at what the best in the industry are doing first.** Don't invent an algorithm or invent a UX pattern. The premium apps (Apple Mail / Notes / Maps / Settings, Linear, Arc, Notion, Robinhood, Revolut, Airbnb, Stripe, iMessage) have already solved nearly every common interaction. Find the established pattern, copy it, *then* code.

- **Recency matters.** 2025–2026 references take precedence. iOS 18+ patterns over iOS 14 patterns. React Native 0.74+ over older. `react-native-keyboard-controller` (2024+) over the legacy `react-native-keyboard-aware-scroll-view`. gorhom v5 over v4. Don't pull patterns from 5-year-old Stack Overflow answers.
- **Name the reference in the code comment** when the choice isn't obvious. Future-me reading `// matches Apple Mail compose: scroll BY delta, not TO position` knows where to look if it ever needs to change.
- **Explicitly: do not invent custom scroll/keyboard math** when a library or platform API already handles it. Use `react-native-keyboard-controller`'s `useReanimatedKeyboardAnimation` / `KeyboardAwareScrollView`, or RN's `automaticallyAdjustKeyboardInsets`, before writing your own.
- **If it feels hacky, it's wrong.** Magic numbers like `setTimeout(280)` or `fieldY - 60` are red flags that the canonical pattern wasn't researched. Stop, find how Linear / Apple Mail does it, redo it properly.

This rule is failure-mode-driven: shipping a "fix" that contradicts how every other premium app does the same thing is worse than no fix.

## Quality Philosophy

- **Always choose the premium approach.** Never recommend a simpler option just because the better one is "high effort" — Claude is doing the implementation, not a human team, so complexity is not a cost. If the best solution requires a new library, a full rewrite, or a complex architecture, do it.
- **The app must feel premium.** Every screen, animation, and interaction should feel polished and intentional. Think award-winning travel app, not MVP prototype. When in doubt, look at how Airbnb, Apple Maps, Apple Mail, App Store, Linear, Arc, or Revolut would do it.
- **No cutting corners on UI/UX.** Don't ship "good enough" — ship "this feels great." If a feature needs 500 lines to feel right, write 500 lines. If a library swap makes a feature dramatically better, swap the library.
- **Default to the best-in-class version of every interaction.** When you implement something common (toggle, scroll header, tab swap, bottom sheet, drop shadow, status pill, etc.), the *first* version you ship should be the premium one — not a basic version that I'll iterate on. If there's a "cheap" implementation and a "best-of-class" one, default to best-of-class without being asked. Examples below.

### Premium reflexes — what "best-of-class" looks like for common patterns

When you encounter any of these patterns, ship the **right** version on the first try:

- **Tab content swap** — directional fade-slide (incoming content fades from `opacity: 0` → `1` while sliding ~16-18px from the side of the tap), `Easing.out(Easing.cubic)`, ~280ms. Use `tabSlideIn` from `utils/tabAnimation.ts`. Never just snap content.
- **Top safe-area / scroll header** — Apple Mail / App Store / Settings pattern. **MANDATORY on every screen** — the only exception is the Atlas map (`app/(tabs)/explore.tsx`), where the live map is the experience. Render `<TopSafeAreaBlur />` (no props needed; it reads safe-area insets internally) as the **last child** of your root container so it sits on top of the scroll view. By default the blur is **always visible**: a theme-aware ultra-thin-material BlurView (masked solid `colors.background` strip on Android) that MaskedView-fades out over an 18px gradient at the bottom — there's no hard edge. Optionally pass `scrollY` (a Reanimated `SharedValue` driven by an `Animated.ScrollView` `onScroll` handler) to get the Apple Mail scroll fade-in: blur is 0 at rest and fully in by ~24px of scroll, animated on the UI thread via the blur's `intensity` prop (never layer opacity — `UIVisualEffectView` ignores/breaks under alpha < 1). If your screen has a fixed header below the safe area that should also tuck under the blur, pass `extra={headerHeight}`. Without `<TopSafeAreaBlur />`, scrolled content drifts behind the Dynamic Island / camera cutout unmasked and looks broken — this is one of the most common and most visible quality bugs. **Never** ship a solid SafeAreaView for premium screens, **never** ship a hard-edged blur, and **never** make the blur's visibility depend on an optional prop callers don't pass.
- **Toggles** — animated iOS-style switch (sliding thumb + cross-fading track) via Reanimated `withSpring`, not a "Yes/No" text pill. See `AnimatedSwitch` in `SurpriseMeSheet.tsx` for the reference shape.
- **Drop shadows on rounded cards** — iOS clips shadows when you use `overflow: 'hidden'` (sets `masksToBounds = true`). Always split into outer `<View>` (carries shadow + matching `borderRadius`, no `overflow: 'hidden'`) and inner `<Pressable>` (clips the photo via `overflow: 'hidden'`). Soft warm-toned shadows (`shadowColor: '#1F1A14'`), generous blur radius (~30+).
- **Bottom sheets that should stop below the Dynamic Island** — use `topInset={insets.top + 10}` on `<BottomSheet>`. This is the prop that *clamps* the sheet's top position. Numeric snap heights don't clamp — they only set how tall the sheet is. Use percentages for snap points; let `topInset` do the clamping.
- **Status / category pills** — soft pill: same-token text on a matching `*Bg` background. The bg tint + coloured text carry the status; **never add a leading coloured dot** (it reads as AI-generated). Not solid coloured pills with white text. See `STATUS_CONFIG` pattern in `app/guide/[id].tsx`.
- **Day / row / page navigation in headers** — single integrated pill with chevrons + label (e.g. `← Day 4 of 10 →`), Apple Books / Calendar pattern. Disabled-state edges fade to ~35% opacity. Not separate floating arrows.
- **Filter chips / segmented controls** — the active state has a coral squiggle underline (`Squiggle` component) that's centered via `position: absolute, left: 0, right: 0, alignItems: 'center'`. Never use `left: '50%' + marginLeft` math — it's fragile to pill width.
- **Floating tab bar** — measured-at-layout-time tab width via `onLayout`, not fixed pixel `TAB_WIDTH`. The indicator and tabs adapt to any iPhone width. Container has 22px horizontal margin and `bottom: max(insets.bottom * 0.85, 22)`.
- **Heart / favorite toggles** — must persist. For country-level: use `useVisa().toggleFavorite(code)` (AsyncStorage-backed). For trip-level: server-side mutation patching a `starred` boolean on the Convex doc. Never local `useState`.
- **Editorial titles** — italic Fraunces with a coral period: `Good {italic word}<coral>.</coral>`. Mono kicker above. Coral squiggle below for hero headlines.
- **Auth-flow & legal screens** (sign-in, sign-up, forgot-password, terms, privacy-policy) — share the textured "paper" background so legal screens feel anchored to the auth flow they're surfaced from. Render `<Guilloche variant="wavy" color={colors.ink} opacity={0.04} />` as the **first child** of the root view (positioned absolute, paints behind content). Plain `colors.background` is wrong here — these screens need the wavy texture to feel cohesive with sign-in.
- **Search inputs** — never `editable={false}` stubs. If a search bar is on screen, it filters something live. Add an `X` clear button when the query is non-empty.

### Things that are NOT acceptable to ship

- **Dead UI** — `onPress={() => {}}`, ChevronRight icons next to non-tappable rows, search inputs with `editable={false}`, buttons that don't do anything yet. If a feature isn't ready, hide the entry point. Don't ship a button that does nothing.
- **Hardcoded hex colours in components** — use `colors.*` from `useTheme()`. The only exception is `'#FFFFFF'` for white text on coloured backgrounds.
- **Local `useState` for things that should persist** — favorites, starred status, completion state, settings. Persist via Convex or AsyncStorage.
- **"Coming soon" copy or stubs** — either build it or don't surface it.
- **Different accent colours per booking type / per visa category in form chrome** — the entire form chrome (icons, buttons, headers) uses coral. Booking type only shows up in the icon and the kicker label, not the whole sheet bg.
- **Screens without `<TopSafeAreaBlur />`** — every screen except the Atlas map MUST mount it at the root. Without it, scrolled content drifts behind the Dynamic Island unmasked and looks broken. Apply this to ALL screens: tabs, modals, detail pages, settings, legal — every one.
- **Square-with-rounded-corners back buttons** — `borderRadius: Radius.sm` on a 40×40 view is *not* circular, it's a rounded square. Always use `<BackButton />` from `components/ui/BackButton.tsx`, which uses `CircleBtn` (`borderRadius: size/2`). Never write inline `<TouchableOpacity>` back buttons.
- **Generic `'fade'` animations** for screen transitions when `'slide_from_right'` is the iOS-native expectation. The default Stack animation is `slide_from_right`; use `fade` only for `(tabs)` and onboarding.

### When making a UI decision

1. Look at how Apple's first-party apps handle the same pattern (Mail, App Store, Maps, Settings, Calendar, Books).
2. Look at how Linear, Arc, Airbnb, Revolut handle it.
3. If our existing codebase has a pattern for it, follow that pattern exactly — don't reinvent.
4. If you're about to ship a "basic" version, stop. Ship the premium version on the first pass.
5. When in doubt, briefly explain the trade-off ("the basic version is X, the premium pattern is Y, doing Y") rather than silently picking the basic one.

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

## Deploying Convex changes (do this automatically)

After **any** edit to a file under `convex/` — schema, query, mutation, action, http route, allow-list, etc. — push to the dev backend so the running app picks it up. The client will throw `Could not find public function for '...'` or `Cannot update field: ...` until this runs. The user's TestFlight / dev client is **not** auto-syncing the Convex deploy; you have to push it.

```bash
PATH="/Users/shahnawaztirmizi/.nvm/versions/node/v22.22.0/bin:$PATH" npx convex dev --once
```

Why the explicit PATH: Convex CLI 1.34+ uses RegExp `v` flag, which needs Node ≥ 20. The shell defaults to Node 18.17.1 here and crashes with `Invalid flags supplied to RegExp constructor 'v'`. The user has Node 22.22.0 installed via nvm — point at it directly rather than relying on `nvm use`, which doesn't propagate into non-interactive shells.

`--once` does a single push and exits; safe to run from a tool call. A regular `npx convex dev` would block waiting for file watches.

Confirm the push actually landed before telling the user "fixed". Look for a line like `✔ Added function userProfiles:getCurrentProfile` or `Added table indexes`. If you only see `Convex functions ready!` with no diff, the deploy was a no-op and your local change wasn't picked up — re-check the file path and try again.

## UI Conventions (follow existing patterns)

- **Component reuse**: Always check `components/ui/` for existing reusable components before creating inline implementations. If a UI pattern is used in 2+ places, extract it into a shared component in `components/ui/`. Never duplicate component logic across screens. Key shared components:
  - `BackButton` — `components/ui/BackButton.tsx`. **Always circular** (the underlying `CircleBtn` uses `borderRadius: size/2`, default size 38). Never reinvent with a `TouchableOpacity` + `borderRadius: Radius.sm` — that's a rounded *square*, not a circle, and it reads as off-brand. Always render `<BackButton />`.
  - `SegmentedControl` — `components/ui/SegmentedControl.tsx` for ALL tab-switching UI (e.g., My Trips/Bookings, Overview/Itinerary/Logistics, Editor/Viewer). Never build inline tab pickers — always use this component.
- **Bottom sheets**: Use `enableDynamicSizing={true}` with `maxDynamicContentSize` set to `Dimensions.get('window').height - safeAreaInsets.top - 10`. This auto-fits content and caps just below the Dynamic Island / status bar (industry standard: Apple Maps, Uber, Airbnb). Never use fixed percentage snap points.
- **Bottom sheet backgrounds**: Use the relevant booking type color for booking sheets, `colors.background` for generic sheets.
- **Always check existing codebase patterns** before introducing new UI conventions. If a pattern exists (back button style, card radius, shadow), follow it exactly.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

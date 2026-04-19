// Visa Atlas — Mono Design System
// Monochrome widget aesthetic. Photography and visa-category pills are the only chroma.

// ──────────────────────────────────────────────
// Mono palette — ship direction
// ──────────────────────────────────────────────
export const LightColors = {
  // Backgrounds
  background: '#F2F2F0',
  backgroundDeep: '#E8E8E6',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceMuted: '#EDEDEB',

  // Ink scale (text, strokes, primary fills)
  ink: '#0E0E0E',
  inkSoft: '#2A2A2A',
  inkMute: '#6B6B6B',
  inkFaint: '#9E9E9E',

  // Hairlines
  line: 'rgba(0,0,0,0.06)',
  lineSoft: 'rgba(0,0,0,0.04)',

  // Primary / accent — both resolve to ink in Mono
  primary: '#0E0E0E',
  primaryDim: '#2A2A2A',
  primaryGlow: 'rgba(0,0,0,0.08)',
  primaryBg: 'rgba(0,0,0,0.05)',

  secondary: '#0E0E0E',
  secondaryDim: '#2A2A2A',
  secondaryGlow: 'rgba(0,0,0,0.06)',
  secondaryBg: 'rgba(0,0,0,0.05)',

  accent: '#0E0E0E',
  accentDim: '#2A2A2A',
  accentGlow: 'rgba(0,0,0,0.06)',
  accentBg: 'rgba(0,0,0,0.05)',

  gold: '#8A6B1E',
  goldSoft: 'rgba(138,107,30,0.12)',

  // Semantic
  danger: '#A83A5E',
  dangerDim: '#8A2E4C',
  dangerBg: 'rgba(168,58,94,0.12)',
  warning: '#B8862B',
  warningBg: 'rgba(184,134,43,0.14)',
  success: '#2E8B63',
  info: '#0E0E0E',

  // Visa categories (load-bearing colour — only chroma in the UI)
  visaFree: '#2E8B63',
  visaFreeBg: 'rgba(46,139,99,0.12)',
  visaOnArrival: '#B8862B',
  visaOnArrivalBg: 'rgba(184,134,43,0.14)',
  evisa: '#C2562A',
  evisaBg: 'rgba(194,86,42,0.12)',
  visaRequired: '#A83A5E',
  visaRequiredBg: 'rgba(168,58,94,0.12)',

  // Visa category "card" tokens — retained for existing call sites that render
  // full-bleed solid-category cards; in Mono these match the pill colours.
  visaFreeCard: '#2E8B63',
  visaOnArrivalCard: '#B8862B',
  evisaCard: '#C2562A',
  visaRequiredCard: '#A83A5E',
  categoryCardText: '#FFFFFF',
  categoryCardTextSub: 'rgba(255,255,255,0.80)',

  // Text tokens (legacy names preserved)
  foreground: '#0E0E0E',
  textSecondary: '#2A2A2A',
  textMuted: '#6B6B6B',

  // Borders
  border: 'rgba(0,0,0,0.06)',
  borderSubtle: 'rgba(0,0,0,0.04)',
  borderStrong: 'rgba(0,0,0,0.10)',

  // Glass (floating overlays on photography)
  glass: 'rgba(255,255,255,0.22)',
  glassBorder: 'rgba(255,255,255,0.28)',

  // Misc
  overlay: 'rgba(0,0,0,0.30)',
  shimmer: 'rgba(0,0,0,0.04)',

  // Button text on primary (ink) bg
  primaryButtonText: '#FFFFFF',

  // Solid-card tokens (white text over coloured / photo bg)
  solidText: '#FFFFFF',
  solidTextSub: 'rgba(255,255,255,0.80)',
  solidTextMuted: 'rgba(255,255,255,0.60)',
  solidOverlay: 'rgba(255,255,255,0.20)',
  solidOverlayMd: 'rgba(255,255,255,0.25)',
  solidBorder: 'rgba(255,255,255,0.15)',

  // Dark text on light photo overlays (legacy, preserved)
  textOnLight: '#0E0E0E',
} as const;

// DarkColors kept as a structural mirror so ThemeProvider still compiles.
// Dark mode is out of scope for this redesign; these values are placeholders
// that should never ship to users (ThemeProvider defaults to light).
export const DarkColors = { ...LightColors } as const;

export type ThemeColors = { [K in keyof typeof LightColors]: string };
export type ThemeMode = 'light' | 'dark';

export const Colors = LightColors;

// ──────────────────────────────────────────────
// Visa category helpers
// ──────────────────────────────────────────────
export function getVisaCategoryColor(
  category: string,
  colors: ThemeColors,
): string {
  const c = (category || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return colors.visaFree;
  if (c.includes('arrival')) return colors.visaOnArrival;
  if (c.includes('evisa') || c === 'evisa') return colors.evisa;
  if (c.includes('required')) return colors.visaRequired;
  return colors.ink;
}

export function getVisaCategoryBgColor(
  category: string,
  colors: ThemeColors,
): string {
  const c = (category || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return colors.visaFreeBg;
  if (c.includes('arrival')) return colors.visaOnArrivalBg;
  if (c.includes('evisa') || c === 'evisa') return colors.evisaBg;
  if (c.includes('required')) return colors.visaRequiredBg;
  return colors.shimmer;
}

// ──────────────────────────────────────────────
// Font Family — Inter (UI + display) + JetBrains Mono (kickers)
// ──────────────────────────────────────────────
export const FontFamily = {
  // Display and UI both resolve to Inter per spec (no separate display face).
  display: 'Inter_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Mono — kickers, timestamps, step counters
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  // Legacy keys kept pointing at Inter so downstream code keeps compiling.
  serif: 'Inter_400Regular',
  serifMedium: 'Inter_500Medium',
  serifSemibold: 'Inter_600SemiBold',
  serifBold: 'Inter_700Bold',
  condensed: 'Inter_400Regular',
  condensedMedium: 'Inter_500Medium',
  condensedSemibold: 'Inter_600SemiBold',
  condensedBold: 'Inter_700Bold',
} as const;

// ──────────────────────────────────────────────
// Spacing (spec-aligned; same numeric scale retained for compat)
// ──────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  '2xl': 36,
  '3xl': 48,
  '4xl': 64,
  '5xl': 80,
} as const;

// ──────────────────────────────────────────────
// Font sizes (spec-aligned)
// ──────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

// ──────────────────────────────────────────────
// Border radius (spec: 20/22/26/28/999)
// ──────────────────────────────────────────────
export const Radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 22,
  '2xl': 28,
  full: 9999,
} as const;

export const BentoRadius = 22;
export const BentoGap = 10;

// ──────────────────────────────────────────────
// Shadows (spec-aligned, black-tone)
// ──────────────────────────────────────────────
export const Shadows = {
  // Large hero cards — "0 14px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)"
  cardRaised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  // Medium cards — "0 12px 26px rgba(0,0,0,0.10)"
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 26,
    elevation: 5,
  },
  // Subtle — 2px lift
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  // CircleBtn glass pill — "0 4px 14px rgba(0,0,0,0.10)"
  circle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 3,
  },
  // DarkOrb FAB — "0 10px 24px rgba(0,0,0,0.22)"
  orb: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  // Floating tab bar — "0 14px 40px rgba(0,0,0,0.28)"
  tabBar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 40,
    elevation: 12,
  },
  // Preserved signatures for compat
  glow: (_color: string, _intensity = 0.25) => ({
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  }),
  neonGlow: (_color: string) => ({
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  }),
} as const;

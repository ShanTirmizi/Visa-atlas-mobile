// Visa Atlas — Signature v2 Design System
// Editorial paper aesthetic. Italic Fraunces display + coral signature accent
// + teal primary. Photography and visa-category pills carry their own chroma.

// ──────────────────────────────────────────────
// Signature v2 palette — ship direction
// ──────────────────────────────────────────────
export const LightColors = {
  // Backgrounds — warm paper
  background: '#FBFAF7',
  backgroundDeep: '#F2EFE9',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceMuted: '#EDEDEB',

  // Ink scale (text, strokes, primary fills)
  ink: '#0E0F0F',
  inkSoft: '#3A3B3B',
  inkMute: '#7C7D7D',
  inkFaint: '#B7B8B8',

  // Hairlines
  line: 'rgba(14,15,15,0.06)',
  lineSoft: 'rgba(14,15,15,0.04)',
  lineMid: 'rgba(14,15,15,0.10)',

  // Primary — deep teal (active dock pill, primary CTAs)
  primary: '#0A4A44',
  primaryDim: '#073833',
  primaryGlow: 'rgba(10,74,68,0.18)',
  primaryBg: 'rgba(10,74,68,0.06)',
  primarySoft: '#C8DED8',

  // Secondary — coral (the brand signature: countdown, periods, squiggles, stamps)
  secondary: '#E89B7A',
  secondaryDim: '#C4684A',
  secondaryGlow: 'rgba(232,155,122,0.40)',
  secondaryBg: 'rgba(232,155,122,0.12)',
  secondarySoft: '#FAE2D4',

  // Convenience aliases used by the design — coral and teal called by name
  teal: '#0A4A44',
  tealDeep: '#073833',
  tealSoft: '#C8DED8',
  tealBg: 'rgba(10,74,68,0.06)',
  tealGlow: 'rgba(10,74,68,0.18)',
  coral: '#E89B7A',
  coralDeep: '#C4684A',
  coralSoft: '#FAE2D4',
  coralBg: 'rgba(232,155,122,0.12)',
  coralGlow: 'rgba(232,155,122,0.40)',

  // Accent retained for legacy call sites — resolves to coral
  accent: '#E89B7A',
  accentDim: '#C4684A',
  accentGlow: 'rgba(232,155,122,0.18)',
  accentBg: 'rgba(232,155,122,0.12)',

  gold: '#8A6B1E',
  goldSoft: 'rgba(138,107,30,0.12)',

  // Semantic
  danger: '#A83A5E',
  dangerDim: '#8A2E4C',
  dangerBg: 'rgba(168,58,94,0.12)',
  warning: '#B8862B',
  warningBg: 'rgba(184,134,43,0.14)',
  success: '#2E8B63',
  info: '#0A4A44',
  rose: '#A83A5E',

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
  border: 'rgba(14,15,15,0.06)',
  borderSubtle: 'rgba(14,15,15,0.04)',
  borderStrong: 'rgba(14,15,15,0.10)',

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
  solidOverlayFaint: 'rgba(255,255,255,0.06)',
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

// Visa hero card gradients & inks — only used by <VisaHeroCard />
export const visaCategoryColors = {
  free: {
    bgFrom: '#114039',
    bgTo: '#0B342D',
    accent: '#E89B7A',
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.82)',
    inkUnderline: '#FFFFFF',
    divider: 'rgba(255,255,255,0.16)',
    guillocheOpacity: 0.13,
    stampRotation: -3,
  },
  arrival: {
    bgFrom: '#C7872F',
    bgTo: '#9B5F1A',
    accent: '#FBE9C8',
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.85)',
    inkUnderline: '#FFFFFF',
    divider: 'rgba(255,255,255,0.20)',
    guillocheOpacity: 0.16,
    stampRotation: 4,
  },
  evisa: {
    bgFrom: '#ECA486',
    bgTo: '#C97557',
    accent: '#3D1810',
    ink: '#3D1810',
    inkSoft: 'rgba(61,24,16,0.78)',
    inkUnderline: '#3D1810',
    divider: 'rgba(61,24,16,0.18)',
    guillocheOpacity: 0.14,
    stampRotation: -3,
  },
  required: {
    bgFrom: '#1F1F1F',
    bgTo: '#0E0F0F',
    accent: '#E89B7A',
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.78)',
    inkUnderline: '#FFFFFF',
    divider: 'rgba(255,255,255,0.14)',
    guillocheOpacity: 0.10,
    stampRotation: -3,
  },
} as const;

export type VisaHeroCategory = keyof typeof visaCategoryColors;

// ──────────────────────────────────────────────
// Booking sheet gradients & inks
// (only used by <BookingDetailSheet />)
// ──────────────────────────────────────────────
export const bookingTypeColors = {
  restaurant: {
    bgFrom: '#7E2A2A',
    bgTo:   '#5C1F1F',
    accent: '#FBE9C8',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.78)',
    divider: 'rgba(255,255,255,0.16)',
    guillocheOpacity: 0.10,
    secondary: 'rgba(0,0,0,0.18)',
  },
  insurance: {
    bgFrom: '#1F2746',
    bgTo:   '#161D38',
    accent: '#F4CB6F',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.78)',
    divider: 'rgba(255,255,255,0.14)',
    guillocheOpacity: 0.09,
    secondary: 'rgba(0,0,0,0.20)',
  },
  car: {
    bgFrom: '#2E4A40',
    bgTo:   '#1F362E',
    accent: '#F4CB6F',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.80)',
    divider: 'rgba(255,255,255,0.16)',
    guillocheOpacity: 0.10,
    secondary: 'rgba(0,0,0,0.18)',
  },
  experience: {
    bgFrom: '#A05A2C',
    bgTo:   '#7E4421',
    accent: '#FBE9C8',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.82)',
    divider: 'rgba(255,255,255,0.16)',
    guillocheOpacity: 0.12,
    secondary: 'rgba(0,0,0,0.16)',
  },
  hotel: {
    bgFrom: '#3F2F62',
    bgTo:   '#2E2249',
    accent: '#D4C5F0',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.78)',
    divider: 'rgba(255,255,255,0.14)',
    guillocheOpacity: 0.10,
    secondary: 'rgba(0,0,0,0.20)',
  },
  flight: {
    bgFrom: '#1F2746',
    bgTo:   '#161D38',
    accent: '#F4CB6F',
    ink:    '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.82)',
    divider: 'rgba(255,255,255,0.14)',
    guillocheOpacity: 0.09,
    secondary: 'rgba(0,0,0,0.22)',
  },
} as const;

export type BookingHeroType = keyof typeof bookingTypeColors;

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
// Font Family — Inter (UI) + Fraunces (display, italic) + JetBrains Mono (kickers)
// ──────────────────────────────────────────────
export const FontFamily = {
  // Display — Fraunces serif (italic + roman), the brand signature face.
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_500Medium_Italic',
  displaySemibold: 'Fraunces_600SemiBold',
  displaySemiboldItalic: 'Fraunces_600SemiBold_Italic',
  displayBold: 'Fraunces_700Bold',
  // UI — Inter
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Mono — kickers, timestamps, step counters
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  // Legacy keys — kept pointing at Fraunces so downstream "serif" naming reads correctly.
  serif: 'Fraunces_500Medium',
  serifMedium: 'Fraunces_500Medium',
  serifSemibold: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
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
  // Warm-toned variant of `card` — for elements sitting in/near the warm
  // hero cards. Uses #1F1A14 ink instead of pure black per CLAUDE.md.
  cardWarm: {
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
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

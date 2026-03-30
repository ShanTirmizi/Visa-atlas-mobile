// Visa Atlas — Design System with Light/Dark Mode

// ──────────────────────────────────────────────
// Light Theme — "Retro Travel Poster"
// Warm cream background with teal, amber, and
// red-orange accents evoking vintage luggage tags
// ──────────────────────────────────────────────
export const LightColors = {
  // Backgrounds — warm cream
  background: '#FDF5E6',
  surface: '#F0E8D8',
  card: '#F8F0E2',

  // Primary — vintage teal
  primary: '#1B6B6D',
  primaryDim: '#155657',
  primaryGlow: 'rgba(27, 107, 109, 0.25)',
  primaryBg: 'rgba(27, 107, 109, 0.12)',

  // Secondary — warm amber
  secondary: '#E5A74E',
  secondaryDim: '#C8903A',
  secondaryGlow: 'rgba(229, 167, 78, 0.25)',
  secondaryBg: 'rgba(229, 167, 78, 0.12)',

  // Accent — bold red-orange
  accent: '#D94F30',
  accentDim: '#B84028',
  accentGlow: 'rgba(217, 79, 48, 0.25)',
  accentBg: 'rgba(217, 79, 48, 0.12)',

  // Danger — deep burgundy
  danger: '#8B4049',
  dangerDim: '#6E333A',
  dangerBg: 'rgba(139, 64, 73, 0.12)',

  // Text — warm browns
  foreground: '#3D2B1F',
  textSecondary: '#6B5B4E',
  textMuted: '#A8977F',

  // Visa category colors
  visaFree: '#1B6B6D',
  visaOnArrival: '#E5A74E',
  evisa: '#D94F30',
  visaRequired: '#8B4049',

  // Visa category backgrounds
  visaFreeBg: 'rgba(27, 107, 109, 0.12)',
  visaOnArrivalBg: 'rgba(229, 167, 78, 0.12)',
  evisaBg: 'rgba(217, 79, 48, 0.12)',
  visaRequiredBg: 'rgba(139, 64, 73, 0.12)',

  // Status
  success: '#1B6B6D',
  warning: '#E5A74E',
  info: '#4A90A4',

  // Borders — subtle, shadows do the heavy lifting
  border: 'rgba(61, 43, 31, 0.12)',
  borderSubtle: 'rgba(61, 43, 31, 0.06)',
  borderStrong: 'rgba(61, 43, 31, 0.20)',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.40)',
  glass: 'rgba(253, 245, 230, 0.95)',
  shimmer: 'rgba(61, 43, 31, 0.06)',

  // Button text on primary bg
  primaryButtonText: '#FFFFFF',
} as const;

// ──────────────────────────────────────────────
// Dark Theme — "Deep Ocean"
// The original Visa Atlas web app palette
// Rich dark teal with warm golden accents
// ──────────────────────────────────────────────
export const DarkColors = {
  // Backgrounds — deep ocean teal
  background: '#1a3340',
  surface: '#234350',
  card: '#1f3a49',

  // Primary — bright teal
  primary: '#2a9d8f',
  primaryDim: '#228177',
  primaryGlow: 'rgba(42, 157, 143, 0.35)',
  primaryBg: 'rgba(42, 157, 143, 0.15)',

  // Secondary — warm gold
  secondary: '#e9c46a',
  secondaryDim: '#d4af56',
  secondaryGlow: 'rgba(233, 196, 106, 0.30)',
  secondaryBg: 'rgba(233, 196, 106, 0.12)',

  // Accent — sandy orange
  accent: '#f4a261',
  accentDim: '#e08e4d',
  accentGlow: 'rgba(244, 162, 97, 0.30)',
  accentBg: 'rgba(244, 162, 97, 0.12)',

  // Danger — terracotta
  danger: '#e76f51',
  dangerDim: '#d35d3f',
  dangerBg: 'rgba(231, 111, 81, 0.15)',

  // Text — warm off-whites
  foreground: '#f5f0e8',
  textSecondary: '#c4d5dc',
  textMuted: '#8ba8b5',

  // Visa category colors
  visaFree: '#2a9d8f',
  visaOnArrival: '#e9c46a',
  evisa: '#f4a261',
  visaRequired: '#e76f51',

  // Visa category backgrounds
  visaFreeBg: 'rgba(42, 157, 143, 0.20)',
  visaOnArrivalBg: 'rgba(233, 196, 106, 0.20)',
  evisaBg: 'rgba(244, 162, 97, 0.20)',
  visaRequiredBg: 'rgba(231, 111, 81, 0.20)',

  // Status
  success: '#2a9d8f',
  warning: '#e9c46a',
  info: '#64b5c6',

  // Borders — subtle light edges
  border: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.65)',
  glass: 'rgba(26, 51, 64, 0.92)',
  shimmer: 'rgba(255, 255, 255, 0.06)',

  // Button text on primary bg
  primaryButtonText: '#FFFFFF',
} as const;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
/** Widened so both palettes satisfy the same shape */
export type ThemeColors = { [K in keyof typeof DarkColors]: string };
export type ThemeMode = 'light' | 'dark';

// Default export (dark) for backward compat
export const Colors = DarkColors;

// ──────────────────────────────────────────────
// Visa category color helpers
// ──────────────────────────────────────────────
export function getVisaCategoryColor(
  category: string,
  colors: ThemeColors,
): string {
  switch (category) {
    case 'visa_free':
      return colors.visaFree;
    case 'visa_on_arrival':
      return colors.visaOnArrival;
    case 'e_visa':
      return colors.evisa;
    case 'visa_required':
      return colors.visaRequired;
    default:
      return colors.textMuted;
  }
}

export function getVisaCategoryBgColor(
  category: string,
  colors: ThemeColors,
): string {
  switch (category) {
    case 'visa_free':
      return colors.visaFreeBg;
    case 'visa_on_arrival':
      return colors.visaOnArrivalBg;
    case 'e_visa':
      return colors.evisaBg;
    case 'visa_required':
      return colors.visaRequiredBg;
    default:
      return colors.shimmer;
  }
}

// ──────────────────────────────────────────────
// Font Family — Travel poster typography
// ──────────────────────────────────────────────
export const FontFamily = {
  // Display — bold, condensed, vintage feel
  display: 'BebasNeue_400Regular',
  // Body — elegant serif for readability
  serif: 'Lora_400Regular',
  serifMedium: 'Lora_500Medium',
  serifSemibold: 'Lora_600SemiBold',
  serifBold: 'Lora_700Bold',
  // UI — condensed sans for labels, badges, buttons
  condensed: 'BarlowCondensed_400Regular',
  condensedMedium: 'BarlowCondensed_500Medium',
  condensedSemibold: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
} as const;

// ──────────────────────────────────────────────
// Spacing
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
// Font Sizes
// ──────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
  '5xl': 64,
} as const;

// ──────────────────────────────────────────────
// Border Radius
// ──────────────────────────────────────────────
export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

// ──────────────────────────────────────────────
// Shadow presets
// ──────────────────────────────────────────────
export const Shadows = {
  card: {
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardRaised: {
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: (color: string, intensity = 0.25) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: intensity,
    shadowRadius: 16,
    elevation: 5,
  }),
  subtle: {
    shadowColor: '#3D2B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
} as const;

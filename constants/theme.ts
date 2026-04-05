// Visa Atlas — Design System with Light/Dark Mode
// Aligned with HabitQuest brand DNA for cohesive identity

// ──────────────────────────────────────────────
// Light Theme — "Warm Travel"
// Shares HabitQuest's warm peach foundation
// with travel-specific teal/green accents
// ──────────────────────────────────────────────
export const LightColors = {
  // Backgrounds — warm peach (matches HabitQuest)
  background: '#F5D9C0',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  surfaceLight: '#F9E8D6',

  // Primary — bold teal (HabitQuest categoryLife family)
  primary: '#2AAAA0',
  primaryDim: '#229088',
  primaryGlow: 'rgba(42, 170, 160, 0.25)',
  primaryBg: 'rgba(42, 170, 160, 0.12)',

  // Secondary — emerald green (HabitQuest secondary)
  secondary: '#2EAA6E',
  secondaryDim: '#25905C',
  secondaryGlow: 'rgba(46, 170, 110, 0.20)',
  secondaryBg: 'rgba(46, 170, 110, 0.12)',

  // Accent — hero orange (HabitQuest primary)
  accent: '#EB6D3A',
  accentDim: '#D45E30',
  accentGlow: 'rgba(235, 109, 58, 0.25)',
  accentBg: 'rgba(235, 109, 58, 0.12)',

  // Danger — warm red (HabitQuest danger)
  danger: '#E05545',
  dangerDim: '#C43A2E',
  dangerBg: 'rgba(224, 85, 69, 0.12)',

  // Warning — golden amber (HabitQuest accent)
  warning: '#E5A832',
  warningBg: 'rgba(229, 168, 50, 0.12)',

  // Text — warm browns (matching HabitQuest)
  foreground: '#1C1816',
  textSecondary: '#6B6058',
  textMuted: '#A09890',

  // Visa category colors — vibrant & fun
  visaFree: '#2EAA6E',
  visaOnArrival: '#E5A832',
  evisa: '#EB6D3A',
  visaRequired: '#D95E8A',

  // Visa category backgrounds
  visaFreeBg: 'rgba(46, 170, 110, 0.14)',
  visaOnArrivalBg: 'rgba(229, 168, 50, 0.14)',
  evisaBg: 'rgba(235, 109, 58, 0.14)',
  visaRequiredBg: 'rgba(217, 94, 138, 0.14)',

  // Visa category card colors (punchy, saturated — like HabitQuest category cards)
  visaFreeCard: '#2AB872',
  visaOnArrivalCard: '#E29628',
  evisaCard: '#D45E30',
  visaRequiredCard: '#D44E82',
  categoryCardText: '#FFFFFF',
  categoryCardTextSub: 'rgba(255, 255, 255, 0.80)',

  // Status
  success: '#2EAA6E',
  info: '#2AAAA0',

  // Borders — subtle, shadows do the heavy lifting in light mode
  border: 'rgba(0, 0, 0, 0.04)',
  borderSubtle: 'rgba(0, 0, 0, 0.03)',
  borderStrong: 'rgba(0, 0, 0, 0.08)',

  // Glass — for floating elements
  glass: 'rgba(255, 255, 255, 0.98)',
  glassBorder: 'rgba(0, 0, 0, 0.03)',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.30)',
  shimmer: 'rgba(0, 0, 0, 0.04)',

  // Button text on primary bg
  primaryButtonText: '#FFFFFF',

  // Solid card tokens — for white text on solid-colored card backgrounds
  solidText: '#FFFFFF',
  solidTextSub: 'rgba(255,255,255,0.70)',
  solidTextMuted: 'rgba(255,255,255,0.60)',
  solidOverlay: 'rgba(255,255,255,0.20)',
  solidOverlayMd: 'rgba(255,255,255,0.25)',
  solidBorder: 'rgba(255,255,255,0.15)',
} as const;

// ──────────────────────────────────────────────
// Dark Theme — "Midnight" (matches HabitQuest dark)
// Deep midnight blue with neon accents
// ──────────────────────────────────────────────
export const DarkColors = {
  // Backgrounds — midnight (HabitQuest dark)
  background: '#060810',
  surface: '#0D1117',
  card: '#161B22',
  surfaceLight: '#1C2333',

  // Primary — neon cyan (HabitQuest dark secondary)
  primary: '#00E5CC',
  primaryDim: '#00B8A3',
  primaryGlow: 'rgba(0, 229, 204, 0.35)',
  primaryBg: 'rgba(0, 229, 204, 0.10)',

  // Secondary — neon green
  secondary: '#00E676',
  secondaryDim: '#00C864',
  secondaryGlow: 'rgba(0, 230, 118, 0.30)',
  secondaryBg: 'rgba(0, 230, 118, 0.10)',

  // Accent — electric orange (HabitQuest dark primary)
  accent: '#FF6B2C',
  accentDim: '#CC5520',
  accentGlow: 'rgba(255, 107, 44, 0.40)',
  accentBg: 'rgba(255, 107, 44, 0.12)',

  // Danger — neon red
  danger: '#FF5252',
  dangerDim: '#D44040',
  dangerBg: 'rgba(255, 82, 82, 0.15)',

  // Warning — bright gold (HabitQuest dark accent)
  warning: '#FFB800',
  warningBg: 'rgba(255, 184, 0, 0.10)',

  // Text — off-whites
  foreground: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#6B7280',

  // Visa category colors — neon
  visaFree: '#00E676',
  visaOnArrival: '#FFD740',
  evisa: '#FF6B2C',
  visaRequired: '#FF5252',

  // Visa category backgrounds
  visaFreeBg: 'rgba(0, 230, 118, 0.12)',
  visaOnArrivalBg: 'rgba(255, 215, 64, 0.12)',
  evisaBg: 'rgba(255, 107, 44, 0.12)',
  visaRequiredBg: 'rgba(255, 82, 82, 0.12)',

  // Visa category card colors (neon glow)
  visaFreeCard: '#00C864',
  visaOnArrivalCard: '#D4A800',
  evisaCard: '#CC5520',
  visaRequiredCard: '#D44040',
  categoryCardText: '#FFFFFF',
  categoryCardTextSub: 'rgba(255, 255, 255, 0.70)',

  // Status
  success: '#00E676',
  info: '#00E5CC',

  // Borders — subtle light edges
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',

  // Glass
  glass: 'rgba(13, 17, 23, 0.95)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.65)',
  shimmer: 'rgba(255, 255, 255, 0.04)',

  // Button text on primary bg
  primaryButtonText: '#060810',

  // Solid card tokens — for white text on solid-colored card backgrounds
  solidText: '#FFFFFF',
  solidTextSub: 'rgba(255,255,255,0.70)',
  solidTextMuted: 'rgba(255,255,255,0.60)',
  solidOverlay: 'rgba(255,255,255,0.20)',
  solidOverlayMd: 'rgba(255,255,255,0.25)',
  solidBorder: 'rgba(255,255,255,0.15)',
} as const;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
/** Widened so both palettes satisfy the same shape */
export type ThemeColors = { [K in keyof typeof LightColors]: string };
export type ThemeMode = 'light' | 'dark';

// Default export (light) — warm is the default
export const Colors = LightColors;

// ──────────────────────────────────────────────
// Visa category color helpers
// ──────────────────────────────────────────────
export function getVisaCategoryColor(
  category: string,
  colors: ThemeColors,
): string {
  const c = (category || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return colors.visaFreeCard;
  if (c.includes('arrival')) return colors.visaOnArrivalCard;
  if (c.includes('evisa') || c === 'evisa') return colors.evisaCard;
  if (c.includes('required')) return colors.visaRequiredCard;
  return colors.primary;
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
// Font Family — Shared brand identity with HabitQuest
// Sora for UI, Bebas Neue for travel display headers
// ──────────────────────────────────────────────
export const FontFamily = {
  // Display — bold travel poster headers
  display: 'BebasNeue_400Regular',
  // Base UI — Sora geometric (shared with HabitQuest)
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  // Keep serif for long-form content (itinerary descriptions)
  serif: 'Lora_400Regular',
  serifMedium: 'Lora_500Medium',
  serifSemibold: 'Lora_600SemiBold',
  serifBold: 'Lora_700Bold',
  // Condensed for badges, labels, uppercase text
  condensed: 'BarlowCondensed_400Regular',
  condensedMedium: 'BarlowCondensed_500Medium',
  condensedSemibold: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
} as const;

// ──────────────────────────────────────────────
// Spacing (shared with HabitQuest)
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
// Font Sizes (shared with HabitQuest)
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
// Border Radius (shared with HabitQuest)
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

// Bento grid radius (shared with HabitQuest)
export const BentoRadius = 20;
export const BentoGap = 14;

// ──────────────────────────────────────────────
// Shadow presets (warm tones — shared with HabitQuest)
// ──────────────────────────────────────────────
export const Shadows = {
  card: {
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  cardRaised: {
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
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
  neonGlow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 8,
  }),
  subtle: {
    shadowColor: '#8B8178',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
} as const;

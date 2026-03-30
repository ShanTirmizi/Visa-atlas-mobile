import { type ThemeColors } from './theme';

// ──────────────────────────────────────────────
// Visa category definitions
// ──────────────────────────────────────────────

export type VisaCategory =
  | 'visa_free'
  | 'visa_on_arrival'
  | 'e_visa'
  | 'visa_required';

export interface VisaCategoryConfig {
  key: VisaCategory;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const VISA_CATEGORIES: VisaCategoryConfig[] = [
  {
    key: 'visa_free',
    label: 'Visa Free',
    shortLabel: 'Free',
    icon: 'checkmark-circle',
    description: 'No visa required for entry',
  },
  {
    key: 'visa_on_arrival',
    label: 'Visa on Arrival',
    shortLabel: 'On Arrival',
    icon: 'airplane',
    description: 'Visa issued at the port of entry',
  },
  {
    key: 'e_visa',
    label: 'E-Visa',
    shortLabel: 'E-Visa',
    icon: 'document-text',
    description: 'Electronic visa application required',
  },
  {
    key: 'visa_required',
    label: 'Visa Required',
    shortLabel: 'Required',
    icon: 'alert-circle',
    description: 'Embassy/consulate visa application required',
  },
];

/**
 * Get the color for a visa category from the current theme.
 */
export function getVisaCategoryColor(
  category: VisaCategory | string,
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

/**
 * Get the background color for a visa category badge from the current theme.
 */
export function getVisaCategoryBgColor(
  category: VisaCategory | string,
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

/**
 * Get the human-readable label for a visa category key.
 */
export function getVisaCategoryLabel(category: VisaCategory | string): string {
  const config = VISA_CATEGORIES.find((c) => c.key === category);
  return config?.label ?? 'Unknown';
}

/**
 * Get the short label for a visa category key.
 */
export function getVisaCategoryShortLabel(
  category: VisaCategory | string,
): string {
  const config = VISA_CATEGORIES.find((c) => c.key === category);
  return config?.shortLabel ?? '?';
}

/**
 * Get the icon name for a visa category key.
 */
export function getVisaCategoryIcon(category: VisaCategory | string): string {
  const config = VISA_CATEGORIES.find((c) => c.key === category);
  return config?.icon ?? 'help-circle';
}

// ──────────────────────────────────────────────
// Badge color configs (for static usage)
// ──────────────────────────────────────────────

export interface BadgeConfig {
  key: VisaCategory;
  label: string;
  getColor: (colors: ThemeColors) => string;
  getBgColor: (colors: ThemeColors) => string;
}

export const BADGE_CONFIGS: BadgeConfig[] = VISA_CATEGORIES.map((cat) => ({
  key: cat.key,
  label: cat.label,
  getColor: (colors: ThemeColors) => getVisaCategoryColor(cat.key, colors),
  getBgColor: (colors: ThemeColors) => getVisaCategoryBgColor(cat.key, colors),
}));

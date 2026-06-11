import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, DollarSign } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import type { ThemeColors } from '@/constants/theme';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
  BentoRadius,
} from '@/constants/theme';
import type { CountryVisa, VisaCategory, HeldVisaType } from '@/data/visaData';
import { resolveCountry } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { getFlightHours } from '@/utils/flightTime';
import { toAlpha2 } from '@/utils/countryCode';

// Convert ISO 3166-1 alpha-3 code to flag emoji via regional indicator symbols
function isoToFlag(code: string): string {
  const alpha2 = toAlpha2(code);
  if (!alpha2 || alpha2.length !== 2) return '';
  return alpha2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// Get SOLID card background color — punchy like HabitQuest category cards
function getCardBgColor(category: VisaCategory, colors: ThemeColors): string {
  switch (category) {
    case 'visa-free':
      return colors.visaFreeCard;
    case 'visa-on-arrival':
      return colors.visaOnArrivalCard;
    case 'evisa':
      return colors.evisaCard;
    case 'visa-required':
      return colors.visaRequiredCard;
    case 'home':
      return colors.primary;
    default:
      return colors.primary;
  }
}

function getCostIndicator(costLevel: 1 | 2 | 3): string {
  return '$'.repeat(costLevel);
}

export interface CountryCardProps {
  country: CountryVisa;
  heldVisas: Set<HeldVisaType>;
  isFavorite: boolean;
  isVisited: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

function CountryCardComponent({
  country,
  heldVisas,
  isFavorite,
  onPress,
  onToggleFavorite,
}: CountryCardProps) {
  const { colors } = useTheme();
  const { residence } = useVisa();

  const resolved = useMemo(
    () => resolveCountry(country, heldVisas),
    [country, heldVisas],
  );

  const meta = countryMeta[country.code];
  const travel = travelData[country.code];
  const flag = isoToFlag(country.code);
  const cardBg = getCardBgColor(resolved.category, colors);
  const flightHours = getFlightHours(residence ?? 'GBR', country.code);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: cardBg }, Shadows.card]}
    >
      {/* Content */}
      <View style={styles.content}>
        {/* Top row: flag + name + visa label */}
        <View style={styles.mainRow}>
          <Text style={styles.flag}>{flag}</Text>
          <View style={styles.nameColumn}>
            <Text style={styles.name} numberOfLines={1}>
              {country.name}
            </Text>
            {meta && (
              <Text style={styles.region} numberOfLines={1}>
                {meta.region}
              </Text>
            )}
          </View>
        </View>

        {/* Bottom row: visa label + cost + flight hours */}
        <View style={styles.metaRow}>
          <View style={styles.visaLabel}>
            <Text style={styles.visaLabelText}>
              {resolved.category === 'visa-free' ? 'Visa Free' :
               resolved.category === 'visa-on-arrival' ? 'On Arrival' :
               resolved.category === 'evisa' ? 'eVisa' :
               resolved.category === 'visa-required' ? 'Required' :
               resolved.category === 'home' ? 'Home' : ''}
            </Text>
          </View>

          <View style={styles.indicators}>
            {travel && (
              <>
                <View style={styles.indicator}>
                  <DollarSign size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.indicatorText}>
                    {getCostIndicator(travel.costLevel)}
                  </Text>
                </View>
                <View style={styles.indicator}>
                  <Clock size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.indicatorText}>
                    {flightHours != null ? `${flightHours}h` : '—'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Favorite star */}
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.favoriteButton}
      >
        <Star
          size={18}
          color={isFavorite ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
          fill={isFavorite ? '#FFFFFF' : 'transparent'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const CountryCard = memo(CountryCardComponent);
export default CountryCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BentoRadius,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm + 2,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  flag: {
    fontSize: 28,
    marginRight: Spacing.sm + 2,
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  region: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.70)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visaLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  visaLabelText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  indicatorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.80)',
  },
  favoriteButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});

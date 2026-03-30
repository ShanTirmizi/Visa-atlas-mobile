import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Clock, DollarSign } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import type { ThemeColors } from '@/constants/theme';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
} from '@/constants/theme';
import type { CountryVisa, VisaCategory, HeldVisaType } from '@/data/visaData';
import { resolveCountry } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import VisaBadge from './VisaBadge';

// Convert ISO 3166-1 alpha-3 code to flag emoji via regional indicator symbols
function isoToFlag(code: string): string {
  // Map alpha-3 to alpha-2 for the flag
  const alpha2 = alpha3ToAlpha2(code);
  if (!alpha2) return '';
  return alpha2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// Minimal alpha-3 to alpha-2 mapping for common codes
// We only need the first two letters for most, but some differ
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', AND: 'AD', AGO: 'AO',
  ATG: 'AG', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT',
  AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD', BRB: 'BB',
  BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ', BTN: 'BT',
  BOL: 'BO', BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN',
  BGR: 'BG', BFA: 'BF', BDI: 'BI', KHM: 'KH', CMR: 'CM',
  CAN: 'CA', CPV: 'CV', CAF: 'CF', TCD: 'TD', CHL: 'CL',
  CHN: 'CN', COL: 'CO', COM: 'KM', COG: 'CG', COD: 'CD',
  CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU', CYP: 'CY',
  CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER',
  EST: 'EE', SWZ: 'SZ', ETH: 'ET', FJI: 'FJ', FIN: 'FI',
  FRA: 'FR', GAB: 'GA', GMB: 'GM', GEO: 'GE', DEU: 'DE',
  GHA: 'GH', GRC: 'GR', GRD: 'GD', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HUN: 'HU',
  ISL: 'IS', IND: 'IN', IDN: 'ID', IRN: 'IR', IRQ: 'IQ',
  IRL: 'IE', ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP',
  JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', PRK: 'KP',
  KOR: 'KR', KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV',
  LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI',
  LTU: 'LT', LUX: 'LU', MDG: 'MG', MWI: 'MW', MYS: 'MY',
  MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MRT: 'MR',
  MUS: 'MU', MEX: 'MX', FSM: 'FM', MDA: 'MD', MCO: 'MC',
  MNG: 'MN', MNE: 'ME', MAR: 'MA', MOZ: 'MZ', MMR: 'MM',
  NAM: 'NA', NRU: 'NR', NPL: 'NP', NLD: 'NL', NZL: 'NZ',
  NIC: 'NI', NER: 'NE', NGA: 'NG', MKD: 'MK', NOR: 'NO',
  OMN: 'OM', PAK: 'PK', PLW: 'PW', PAN: 'PA', PNG: 'PG',
  PRY: 'PY', PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT',
  QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', KNA: 'KN',
  LCA: 'LC', VCT: 'VC', WSM: 'WS', SMR: 'SM', STP: 'ST',
  SAU: 'SA', SEN: 'SN', SRB: 'RS', SYC: 'SC', SLE: 'SL',
  SGP: 'SG', SVK: 'SK', SVN: 'SI', SLB: 'SB', SOM: 'SO',
  ZAF: 'ZA', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR',
  SWE: 'SE', CHE: 'CH', SYR: 'SY', TWN: 'TW', TJK: 'TJ',
  TZA: 'TZ', THA: 'TH', TLS: 'TL', TGO: 'TG', TON: 'TO',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', TUV: 'TV',
  UGA: 'UG', UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US',
  URY: 'UY', UZB: 'UZ', VUT: 'VU', VEN: 'VE', VNM: 'VN',
  YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW', PSE: 'PS', XKX: 'XK',
};

function alpha3ToAlpha2(alpha3: string): string | undefined {
  return ALPHA3_TO_ALPHA2[alpha3.toUpperCase()];
}

function getCategoryColor(
  category: VisaCategory,
  colors: ThemeColors,
): string {
  switch (category) {
    case 'visa-free':
      return colors.visaFree;
    case 'visa-on-arrival':
      return colors.visaOnArrival;
    case 'evisa':
      return colors.evisa;
    case 'visa-required':
      return colors.visaRequired;
    case 'home':
      return colors.primary;
    default:
      return colors.textMuted;
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

  const resolved = useMemo(
    () => resolveCountry(country, heldVisas),
    [country, heldVisas],
  );

  const meta = countryMeta[country.code];
  const travel = travelData[country.code];
  const flag = isoToFlag(country.code);
  const stripeColor = getCategoryColor(resolved.category, colors);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {/* Left color stripe */}
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: flag + name + region */}
        <View style={styles.mainRow}>
          <Text style={styles.flag}>{flag}</Text>
          <View style={styles.nameColumn}>
            <Text
              style={[styles.name, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {country.name}
            </Text>
            {meta && (
              <Text
                style={[styles.region, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {meta.region}
              </Text>
            )}
          </View>
        </View>

        {/* Bottom row: badge + cost + flight hours */}
        <View style={styles.metaRow}>
          <VisaBadge category={resolved.category} />

          <View style={styles.indicators}>
            {travel && (
              <>
                <View style={styles.indicator}>
                  <DollarSign size={12} color={colors.textMuted} />
                  <Text
                    style={[
                      styles.indicatorText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {getCostIndicator(travel.costLevel)}
                  </Text>
                </View>

                <View style={styles.indicator}>
                  <Clock size={12} color={colors.textMuted} />
                  <Text
                    style={[
                      styles.indicatorText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {travel.flightHoursFromLondon}h
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
          color={isFavorite ? colors.secondary : colors.textMuted}
          fill={isFavorite ? colors.secondary : 'transparent'}
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.subtle,
  },
  stripe: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  flag: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  nameColumn: {
    flex: 1,
  },
  name: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    letterSpacing: 0.3,
  },
  region: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
  },
  favoriteButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});

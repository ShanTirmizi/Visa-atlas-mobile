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
  BentoRadius,
} from '@/constants/theme';
import type { CountryVisa, VisaCategory, HeldVisaType } from '@/data/visaData';
import { resolveCountry } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';

// Convert ISO 3166-1 alpha-3 code to flag emoji via regional indicator symbols
function isoToFlag(code: string): string {
  const alpha2 = alpha3ToAlpha2(code);
  if (!alpha2) return '';
  return alpha2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

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

  const resolved = useMemo(
    () => resolveCountry(country, heldVisas),
    [country, heldVisas],
  );

  const meta = countryMeta[country.code];
  const travel = travelData[country.code];
  const flag = isoToFlag(country.code);
  const cardBg = getCardBgColor(resolved.category, colors);

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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import type { VisaCategory } from '@/data/visaData';

// Converts alpha-3 to alpha-2 — duplicated here to avoid cross-file
// import ordering issues; this is a small pure map.
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',SWZ:'SZ',ETH:'ET',FJI:'FJ',FIN:'FI',
  FRA:'FR',GAB:'GA',GMB:'GM',GEO:'GE',DEU:'DE',GHA:'GH',GRC:'GR',GRD:'GD',GTM:'GT',GIN:'GN',
  GNB:'GW',GUY:'GY',HTI:'HT',HND:'HN',HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRN:'IR',IRQ:'IQ',
  IRL:'IE',ISR:'IL',ITA:'IT',JAM:'JM',JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KIR:'KI',PRK:'KP',
  KOR:'KR',KWT:'KW',KGZ:'KG',LAO:'LA',LVA:'LV',LBN:'LB',LSO:'LS',LBR:'LR',LBY:'LY',LIE:'LI',
  LTU:'LT',LUX:'LU',MDG:'MG',MWI:'MW',MYS:'MY',MDV:'MV',MLI:'ML',MLT:'MT',MHL:'MH',MRT:'MR',
  MUS:'MU',MEX:'MX',FSM:'FM',MDA:'MD',MCO:'MC',MNG:'MN',MNE:'ME',MAR:'MA',MOZ:'MZ',MMR:'MM',
  NAM:'NA',NRU:'NR',NPL:'NP',NLD:'NL',NZL:'NZ',NIC:'NI',NER:'NE',NGA:'NG',MKD:'MK',NOR:'NO',
  OMN:'OM',PAK:'PK',PLW:'PW',PAN:'PA',PNG:'PG',PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',
  QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',KNA:'KN',LCA:'LC',VCT:'VC',WSM:'WS',SMR:'SM',STP:'ST',
  SAU:'SA',SEN:'SN',SRB:'RS',SYC:'SC',SLE:'SL',SGP:'SG',SVK:'SK',SVN:'SI',SLB:'SB',SOM:'SO',
  ZAF:'ZA',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',TJK:'TJ',
  TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',TUV:'TV',
  UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',VNM:'VN',
  YEM:'YE',ZMB:'ZM',ZWE:'ZW',PSE:'PS',XKX:'XK',
};

export function toAlpha2(code: string): string {
  return ALPHA3_TO_ALPHA2[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
}

export interface CompareCountryCardV2Props {
  countryName: string;
  countryCode: string;   // alpha-3
  visaCategory: Cat;
  flightHours: number | null;
  dailyBudget: string;
  bestTime: string;
  isWinner: boolean;
}

export function CompareCountryCardV2({
  countryName,
  countryCode,
  visaCategory,
  flightHours,
  dailyBudget,
  bestTime,
  isWinner,
}: CompareCountryCardV2Props) {
  const { colors } = useTheme();
  const a2 = toAlpha2(countryCode);
  const flightStr = flightHours != null ? `${flightHours}h` : '—';

  const meta: Array<{ label: string; value: string }> = [
    { label: 'FLIGHT', value: flightStr },
    { label: 'BUDGET', value: dailyBudget },
    { label: 'BEST',   value: bestTime },
  ];

  return (
    // Outer wrapper carries shadow without clipping overflow (TOP PICK badge peeks above)
    <View
      style={[
        styles.outerWrap,
        isWinner && {
          shadowColor: '#1F1A14',
          shadowOpacity: 0.13,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      ]}
    >
      {/* TOP PICK badge — only for winner, rotated -8° peeking above top-left */}
      {isWinner && (
        <View style={styles.topPickWrapper} pointerEvents="none">
          <View
            style={[
              styles.topPickBadge,
              { backgroundColor: colors.coral },
            ]}
          >
            {/* Inner white-thread border */}
            <View style={styles.topPickInner}>
              <Text style={styles.topPickText}>TOP PICK</Text>
            </View>
          </View>
        </View>
      )}

      {/* Card body */}
      <View
        style={[
          styles.card,
          {
            borderWidth: isWinner ? 1.5 : 1,
            borderColor: isWinner ? colors.coral : colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {/* Flag + name + visa pill */}
        <View style={styles.flagSection}>
          <Flag code={a2} size={60} />
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 20,
              fontWeight: '500',
              color: colors.ink,
              marginTop: 10,
              textAlign: 'center',
              letterSpacing: -20 * 0.018,
              lineHeight: 24,
            }}
            numberOfLines={2}
          >
            {countryName}
          </Text>
          <VisaBadge cat={visaCategory} size="sm" style={{ marginTop: 6, alignSelf: 'center' }} />
        </View>

        {/* Meta strip — hairlines between rows */}
        <View style={[styles.metaStrip, { borderTopColor: colors.line }]}>
          {meta.map(({ label, value }, i) => (
            <View
              key={label}
              style={[
                styles.metaRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.line,
                },
              ]}
            >
              <Text
                style={[
                  styles.metaLabel,
                  { color: colors.inkMute },
                ]}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 13,
                  fontWeight: '500',
                  color: colors.ink,
                  letterSpacing: -13 * 0.01,
                }}
                numberOfLines={1}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    flex: 1,
    // Allows badge to overflow above card without being clipped
    overflow: 'visible',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  flagSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  metaStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  metaLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.18,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // TOP PICK badge
  topPickWrapper: {
    position: 'absolute',
    top: -10,
    left: 12,
    zIndex: 10,
    transform: [{ rotate: '-8deg' }],
  },
  topPickBadge: {
    borderRadius: 6,
    padding: 1,
  },
  topPickInner: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topPickText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Flag } from '@/components/ui/Flag';

// Converts alpha-3 to alpha-2 for Flag component
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

function toA2(code: string): string {
  return ALPHA3_TO_ALPHA2[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
}

/** A compact dual-flag disc showing two flags clipped side by side */
function DualFlag({ codeA, codeB, size = 32 }: { codeA: string; codeB: string; size?: number }) {
  const half = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        flexDirection: 'row',
      }}
    >
      {/* Left half — country A */}
      <View style={{ width: half, height: size, overflow: 'hidden' }}>
        <Flag code={toA2(codeA)} size={size} />
      </View>
      {/* Right half — country B, shifted left by half so the right portion shows */}
      <View style={{ width: half, height: size, overflow: 'hidden' }}>
        <View style={{ marginLeft: -half }}>
          <Flag code={toA2(codeB)} size={size} />
        </View>
      </View>
    </View>
  );
}

interface FaceoffRowProps {
  codeA: string;
  nameA: string;
  codeB: string;
  nameB: string;
  onOpen: () => void;
  hasDivider?: boolean;
}

export function FaceoffRow({
  codeA,
  nameA,
  codeB,
  nameB,
  onOpen,
  hasDivider = false,
}: FaceoffRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Compare ${nameA} vs ${nameB}`}
      style={({ pressed }) => [
        styles.container,
        hasDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
        },
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {/* Left dual flag disc */}
      <DualFlag codeA={codeA} codeB={codeB} size={32} />

      {/* Country name row — italic Fraunces */}
      <View style={styles.labelBox}>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 15,
            fontWeight: '500',
            color: colors.ink,
            letterSpacing: -15 * 0.012,
          }}
          numberOfLines={1}
        >
          {nameA}{' '}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              color: colors.coral,
            }}
          >
            vs
          </Text>{' '}
          {nameB}
        </Text>
      </View>

      {/* Right dual flag disc (visual rhythm mirror) */}
      <DualFlag codeA={codeA} codeB={codeB} size={28} />

      {/* OPEN pill */}
      <Pressable
        onPress={onOpen}
        style={[
          styles.openPill,
          { backgroundColor: colors.surfaceMuted },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${nameA} vs ${nameB} comparison`}
      >
        <Text
          style={[
            styles.openPillText,
            { color: colors.inkSoft },
          ]}
        >
          OPEN
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  labelBox: {
    flex: 1,
    overflow: 'hidden',
  },
  openPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  openPillText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    letterSpacing: 10 * 0.22,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});

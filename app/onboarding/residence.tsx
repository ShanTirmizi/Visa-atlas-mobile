/**
 * Onboarding — Residence Picker (spec screen 01)
 * Step 1 of 3.
 *
 * Data source : passportCountries (Alpha-3 codes) from @/data/passportCountries
 * Context     : useVisa() — setResidence(selected)
 * Navigation  : router.push('/onboarding/visas')
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { Flag } from '@/components/ui/Flag';
import { Type } from '@/constants/typography';

// ── Alpha-3 → Alpha-2 for the Flag component ──────────────────────────────
const A3_TO_A2: Record<string, string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',ETH:'ET',SWZ:'SZ',FJI:'FJ',FIN:'FI',
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
  ZAF:'ZA',SSD:'SS',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',
  TJK:'TJ',TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',
  TUV:'TV',UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',
  VNM:'VN',YEM:'YE',ZMB:'ZM',ZWE:'ZW',
};

/** Convert an Alpha-3 passport code to the Alpha-2 code used by the Flag component. */
function toA2(a3: string): string {
  return A3_TO_A2[a3] ?? '';
}

// ── Country row ────────────────────────────────────────────────────────────
interface CountryRowProps {
  item: PassportCountry;
  isSelected: boolean;
  onPress: (code: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function CountryRow({ item, isSelected, onPress, colors }: CountryRowProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(item.code)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={[
        styles.row,
        isSelected && { backgroundColor: colors.coralBg, borderRadius: 14 },
      ]}
    >
      <Flag code={toA2(item.code)} size={24} />
      <Text
        style={{
          fontFamily: 'Fraunces_500Medium_Italic',
          fontStyle: 'italic',
          fontSize: 16,
          letterSpacing: -16 * 0.012,
          color: colors.ink,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <View
        style={[
          styles.radioIndicator,
          isSelected
            ? { backgroundColor: colors.coral, borderColor: colors.coral }
            : { backgroundColor: 'transparent', borderColor: colors.line },
        ]}
      >
        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function ResidencePickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passportCountries;
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback((code: string) => {
    setSelected((prev) => (prev === code ? null : code));
  }, []);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    visa.setResidence(selected);
    router.push('/onboarding/visas' as import('expo-router').Href);
  }, [selected, visa, router]);

  const renderItem = useCallback(
    ({ item }: { item: PassportCountry }) => (
      <CountryRow
        item={item}
        isSelected={selected === item.code}
        onPress={toggleCountry}
        colors={colors}
      />
    ),
    [selected, colors, toggleCountry],
  );

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={3}
      title="Where do you live?"
      body="Residence shapes which embassy you apply through and which fast-track lanes are open to you. We'll keep this in mind."
      ctaLabel={selected ? 'Continue' : 'Pick where you live'}
      onCta={handleContinue}
      ctaDisabled={!selected}
    >
      {/* ── Spec card: surface bg, radius 20, 1px border, padding 6 ── */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Search input inside the card */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search countries..."
          placeholderTextColor={colors.inkFaint}
          autoCorrect={false}
          autoCapitalize="words"
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surfaceMuted,
              color: colors.ink,
              fontFamily: 'Inter_400Regular',
            },
          ]}
        />

        {/* Country list — rendered inline (not FlatList) for ScrollView nesting */}
        {filtered.slice(0, 50).map((item) => (
          <CountryRow
            key={item.code}
            item={item}
            isSelected={selected === item.code}
            onPress={toggleCountry}
            colors={colors}
          />
        ))}

        {filtered.length === 0 && (
          <Text style={[Type.body14, { color: colors.inkMute, textAlign: 'center', paddingVertical: 16 }]}>
            No countries found
          </Text>
        )}
      </View>
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden',
  },
  searchInput: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

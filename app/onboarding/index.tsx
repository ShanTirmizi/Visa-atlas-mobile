/**
 * Onboarding — Passport Picker (step 1 of 3)
 *
 * Data source : passportCountries (Alpha-3 codes) from @/data/passportCountries
 * Context     : useVisa() — setPassports(selected)
 * Navigation  : router.push('/onboarding/residence')
 *
 * Business logic preserved verbatim. Only the visual shell is replaced with
 * OnboardingScaffold.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { Flag } from '@/components/ui/Flag';
import { Type } from '@/constants/typography';

// ── Alpha-3 → Alpha-2 for Flag primitive ─────────────────────────────────
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
function toA2(a3: string): string { return A3_TO_A2[a3] ?? ''; }

const MAX_PASSPORTS = 3;

// ── Country row ───────────────────────────────────────────────────────────
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
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      style={styles.row}
    >
      <Flag code={toA2(item.code)} size={22} />
      <Text
        style={[Type.title14, { color: colors.ink, flex: 1 }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <View
        style={[
          styles.radioIndicator,
          isSelected
            ? { backgroundColor: colors.ink, borderColor: colors.ink }
            : { backgroundColor: 'transparent', borderColor: colors.surfaceMuted },
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
export default function PassportPickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passportCountries;
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback(
    (code: string) => {
      setSelected((prev) => {
        if (prev.includes(code)) return prev.filter((c) => c !== code);
        if (multiMode) {
          if (prev.length >= MAX_PASSPORTS) return prev;
          return [...prev, code];
        }
        return [code]; // single-select
      });
    },
    [multiMode],
  );

  const removeChip = useCallback((code: string) => {
    setSelected((prev) => prev.filter((c) => c !== code));
  }, []);

  const toggleMultiMode = useCallback(() => {
    setMultiMode((prev) => {
      if (!prev) return true;
      setSelected((sel) => (sel.length > 0 ? [sel[0]] : []));
      return false;
    });
  }, []);

  const handleContinue = useCallback(() => {
    visa.setPassports(selected);
    router.push('/onboarding/residence' as import('expo-router').Href);
  }, [selected, visa, router]);

  const getCountryName = useCallback(
    (code: string) => passportCountries.find((c) => c.code === code)?.name ?? code,
    [],
  );

  const canContinue = selected.length >= 1;

  return (
    <OnboardingScaffold
      step={1}
      totalSteps={3}
      heroTone="sunset"
      title="Where are you from?"
      body="We'll show you which countries you can visit visa-free."
      ctaLabel="Continue"
      onCta={handleContinue}
    >
      {/* ── Multi-passport toggle ── */}
      <TouchableOpacity
        onPress={toggleMultiMode}
        activeOpacity={0.7}
        style={[
          styles.multiPill,
          {
            backgroundColor: multiMode ? colors.inkFaint : colors.surfaceMuted,
            borderColor: multiMode ? colors.ink : colors.line,
          },
        ]}
      >
        <Text
          style={[
            Type.meta12,
            { color: multiMode ? colors.ink : colors.inkMute },
          ]}
        >
          {multiMode ? 'Single passport' : 'I have multiple passports'}
        </Text>
      </TouchableOpacity>

      {/* ── Selected chips (multi-mode only) ── */}
      {multiMode && selected.length > 0 && (
        <View style={styles.chipRow}>
          {selected.map((code) => (
            <View
              key={code}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.line },
              ]}
            >
              <Flag code={toA2(code)} size={16} />
              <Text style={[Type.meta12, { color: colors.ink }]}>
                {getCountryName(code)}
              </Text>
              <TouchableOpacity
                onPress={() => removeChip(code)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <X size={12} color={colors.inkMute} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── Country list card ── */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
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

        {filtered.slice(0, 50).map((item) => (
          <CountryRow
            key={item.code}
            item={item}
            isSelected={selected.includes(item.code)}
            onPress={toggleCountry}
            colors={colors}
          />
        ))}

        {filtered.length === 0 && (
          <Text
            style={[
              Type.body14,
              { color: colors.inkMute, textAlign: 'center', paddingVertical: 16 },
            ]}
          >
            No countries found
          </Text>
        )}
      </View>

      {/* CTA disabled hint */}
      {!canContinue && (
        <Text style={[Type.meta12, { color: colors.inkFaint, textAlign: 'center', marginTop: 8 }]}>
          Select at least one passport to continue
        </Text>
      )}
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  multiPill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
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

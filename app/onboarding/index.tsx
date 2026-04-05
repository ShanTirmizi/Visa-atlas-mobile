import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';

// ── Alpha-3 to flag emoji ────────────────────────────────────────────
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

function getFlag(alpha3: string): string {
  const a2 = A3_TO_A2[alpha3];
  if (!a2) return '';
  return String.fromCodePoint(
    ...a2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const MAX_PASSPORTS = 3;

export default function PassportPickerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return passportCountries;
    const q = search.trim().toLowerCase();
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback((code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (multiMode) {
        if (prev.length >= MAX_PASSPORTS) return prev;
        return [...prev, code];
      }
      // Single-select mode — replace
      return [code];
    });
  }, [multiMode]);

  const removeChip = useCallback((code: string) => {
    setSelected((prev) => prev.filter((c) => c !== code));
  }, []);

  const toggleMultiMode = useCallback(() => {
    setMultiMode((prev) => {
      if (!prev) return true;
      // Turning off multi — keep only first selected
      setSelected((sel) => (sel.length > 0 ? [sel[0]] : []));
      return false;
    });
  }, []);

  const handleContinue = useCallback(() => {
    visa.setPassports(selected);
    router.push('/onboarding/visas');
  }, [selected, visa, router]);

  const getCountryName = useCallback((code: string) => {
    return passportCountries.find((c) => c.code === code)?.name ?? code;
  }, []);

  const renderItem = useCallback(({ item }: { item: PassportCountry }) => {
    const isSelected = selected.includes(item.code);
    return (
      <TouchableOpacity
        onPress={() => toggleCountry(item.code)}
        activeOpacity={0.7}
        style={[
          styles.row,
          {
            backgroundColor: isSelected ? colors.accent : colors.card,
            borderColor: isSelected ? colors.accent : colors.border,
          },
        ]}
      >
        <Text style={styles.flag}>{getFlag(item.code)}</Text>
        <Text
          style={[
            styles.countryName,
            { color: isSelected ? '#FFFFFF' : colors.foreground },
          ]}
        >
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkWrap}>
            <Check size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selected, colors, toggleCountry]);

  const canContinue = selected.length >= 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Where are you from?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We'll show you which countries you can visit
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search countries..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.card,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>

      {/* Selected chips (multi-mode) */}
      {multiMode && selected.length > 0 && (
        <View style={styles.chipRow}>
          {selected.map((code) => (
            <View
              key={code}
              style={[styles.chip, { backgroundColor: colors.accentBg, borderColor: colors.accent }]}
            >
              <Text style={styles.chipFlag}>{getFlag(code)}</Text>
              <Text style={[styles.chipText, { color: colors.accent }]}>
                {getCountryName(code)}
              </Text>
              <TouchableOpacity onPress={() => removeChip(code)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <X size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
      />

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        {/* Multi-passport toggle */}
        <TouchableOpacity
          onPress={toggleMultiMode}
          activeOpacity={0.7}
          style={[
            styles.multiPill,
            {
              backgroundColor: multiMode ? colors.accentBg : colors.card,
              borderColor: multiMode ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.multiPillText,
              { color: multiMode ? colors.accent : colors.textSecondary },
            ]}
          >
            I have multiple passports
          </Text>
        </TouchableOpacity>

        {/* Continue button */}
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.7}
          disabled={!canContinue}
          style={[
            styles.continueBtn,
            {
              backgroundColor: canContinue ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.continueBtnText, { opacity: canContinue ? 1 : 0.5 }]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  searchWrap: {
    marginBottom: Spacing.md,
  },
  searchInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipFlag: {
    fontSize: 16,
  },
  chipText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
  },
  listContent: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    flex: 1,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  multiPill: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  multiPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
  },
  continueBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

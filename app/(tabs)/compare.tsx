import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search, X, RefreshCw, ArrowLeftRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { Shadows } from '@/constants/theme';
import { endpoints } from '@/constants/api';
import {
  visaData,
  resolveCountry,
  categoryLabels,
  type CountryVisa,
  type HeldVisaType,
  type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { getFlightHours } from '@/utils/flightTime';
import { Type } from '@/constants/typography';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { SectionKicker } from '@/components/ui/SectionKicker';
import {
  CompareCountryCard,
  type CompareCountryData,
} from '@/components/compare/CompareCountryCard';
import { WinnerList, type WinnerRow } from '@/components/compare/WinnerList';

// ---------------------------------------------------------------------------
// Enable LayoutAnimation on Android
// ---------------------------------------------------------------------------
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIScores {
  food: number;
  adventure: number;
  culture: number;
  relaxation: number;
  nightlife: number;
  nature: number;
  value: number;
}

interface AICountryData {
  pitch: string;
  highlights: string[];
  scores: AIScores;
  bestFor: string;
  weatherVerdict: string;
}

interface AIComparison {
  countryA: AICountryData;
  countryB: AICountryData;
  verdict: string;
  valueComparison: string;
}

// ---------------------------------------------------------------------------
// ISO alpha-3 → alpha-2 (for Flag component)
// ---------------------------------------------------------------------------

/* prettier-ignore */
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

function alpha3ToAlpha2(code: string): string {
  return ALPHA3_TO_ALPHA2[code.toUpperCase()] ?? code.slice(0, 2).toUpperCase();
}

function isoToFlagEmoji(code: string): string {
  const a2 = ALPHA3_TO_ALPHA2[code.toUpperCase()];
  if (!a2) return '';
  return a2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ---------------------------------------------------------------------------
// Visa category helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: VisaCategory, colors: { visaFree: string; visaOnArrival: string; evisa: string; visaRequired: string; inkMute: string }): string {
  switch (category) {
    case 'visa-free': return colors.visaFree;
    case 'visa-on-arrival': return colors.visaOnArrival;
    case 'evisa': return colors.evisa;
    case 'visa-required': return colors.visaRequired;
    default: return colors.inkMute;
  }
}

function getCategoryLabel(category: VisaCategory): string {
  switch (category) {
    case 'visa-free': return 'Visa Free';
    case 'visa-on-arrival': return 'On Arrival';
    case 'evisa': return 'eVisa';
    case 'visa-required': return 'Required';
    case 'home': return 'Home';
    default: return category;
  }
}

/** Map VisaCategory to the Cat type expected by CompareCountryCard/VisaBadge. */
function toCat(category: VisaCategory): 'free' | 'arrival' | 'evisa' | 'required' {
  switch (category) {
    case 'visa-free': return 'free';
    case 'visa-on-arrival': return 'arrival';
    case 'evisa': return 'evisa';
    default: return 'required';
  }
}

/** Lower is "easier". */
const CATEGORY_RANK: Record<VisaCategory, number> = {
  'visa-free': 0,
  'visa-on-arrival': 1,
  'evisa': 2,
  'visa-required': 3,
  'home': -1,
};

// ---------------------------------------------------------------------------
// Country Picker Modal (preserved from original)
// ---------------------------------------------------------------------------

function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  excludeCode,
  heldVisasSet,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  excludeCode: string;
  heldVisasSet: Set<HeldVisaType>;
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(
    () =>
      visaData
        .filter((c) => c.category !== 'home' && c.code !== excludeCode)
        .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [search, excludeCode],
  );

  const handleSelect = useCallback(
    (code: string) => {
      onSelect(code);
      onClose();
      setSearch('');
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: CountryVisa }) => {
      const resolved = resolveCountry(item, heldVisasSet);
      const catColor = getCategoryColor(resolved.category, colors);
      return (
        <TouchableOpacity
          style={[styles.pickerItem, { borderBottomColor: colors.line }]}
          onPress={() => handleSelect(item.code)}
          activeOpacity={0.6}
        >
          <Text style={styles.pickerFlag}>{isoToFlagEmoji(item.code)}</Text>
          <Text style={[styles.pickerName, { color: colors.ink }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.pickerBadge, { backgroundColor: catColor }]}>
            <Text style={[styles.pickerBadgeText, { color: '#FFFFFF' }]}>
              {getCategoryLabel(resolved.category)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, heldVisasSet, handleSelect],
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Handle */}
        <View style={styles.modalHandle}>
          <View style={[styles.handleBar, { backgroundColor: colors.inkMute }]} />
        </View>

        {/* Header */}
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'android' ? insets.top + 14 : 14 }]}>
          <Text style={[Type.title18, { color: colors.ink }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={colors.inkMute} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { borderBottomColor: colors.line }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={16} color={colors.inkMute} />
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              placeholder="Search countries..."
              placeholderTextColor={colors.inkFaint}
              value={search}
              onChangeText={setSearch}
              autoFocus
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={14} color={colors.inkMute} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[Type.body13, { color: colors.inkMute }]}>No countries found</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CompareScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { heldVisas, residence } = useVisa();

  const [countryA, setCountryA] = useState('JPN');
  const [countryB, setCountryB] = useState('THA');
  const [pickerTarget, setPickerTarget] = useState<'a' | 'b' | null>(null);
  const [aiData, setAiData] = useState<AIComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<AbortController | null>(null);

  const heldVisasSet = useMemo(() => new Set(heldVisas as HeldVisaType[]), [heldVisas]);

  const selectedA = useMemo(() => visaData.find((c) => c.code === countryA), [countryA]);
  const selectedB = useMemo(() => visaData.find((c) => c.code === countryB), [countryB]);
  const metaA = countryA ? countryMeta[countryA] : null;
  const metaB = countryB ? countryMeta[countryB] : null;
  const travelA = countryA ? travelData[countryA] : null;
  const travelB = countryB ? travelData[countryB] : null;

  const resolvedA = selectedA ? resolveCountry(selectedA, heldVisasSet) : null;
  const resolvedB = selectedB ? resolveCountry(selectedB, heldVisasSet) : null;

  // ── AI comparison fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedA || !selectedB || !metaA || !metaB || !travelA || !travelB) {
      setAiData(null);
      setError(null);
      return;
    }

    if (fetchRef.current) fetchRef.current.abort();
    const controller = new AbortController();
    fetchRef.current = controller;

    setLoading(true);
    setError(null);
    setAiData(null);

    const rA = resolveCountry(selectedA, heldVisasSet);
    const rB = resolveCountry(selectedB, heldVisasSet);

    const payload = {
      countryA: {
        name: selectedA.name,
        region: metaA.region,
        capital: metaA.capital,
        currency: metaA.currency,
        language: metaA.language,
        dailyBudget: travelA.dailyBudget,
        flightHours: getFlightHours(residence ?? 'GBR', selectedA.code) ?? travelA.flightHoursFromLondon,
        costLevel: travelA.costLevel,
        visaCategory: categoryLabels[rA.category],
        bestTimeNote: travelA.bestTimeNote,
      },
      countryB: {
        name: selectedB.name,
        region: metaB.region,
        capital: metaB.capital,
        currency: metaB.currency,
        language: metaB.language,
        dailyBudget: travelB.dailyBudget,
        flightHours: getFlightHours(residence ?? 'GBR', selectedB.code) ?? travelB.flightHoursFromLondon,
        costLevel: travelB.costLevel,
        visaCategory: categoryLabels[rB.category],
        bestTimeNote: travelB.bestTimeNote,
      },
    };

    fetch(endpoints.compare, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json() as Promise<AIComparison>;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setAiData(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!controller.signal.aborted) {
          setError(err.name === 'AbortError' ? null : 'Failed to generate comparison. Tap to retry.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [countryA, countryB, heldVisasSet]);

  // ── Swap handler ─────────────────────────────────────────────────────────
  const swap = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const tmp = countryA;
    setCountryA(countryB);
    setCountryB(tmp);
  }, [countryA, countryB]);

  const retry = useCallback(() => {
    setError(null);
    const tmp = countryA;
    setCountryA('');
    setTimeout(() => setCountryA(tmp), 50);
  }, [countryA]);

  // ── Build card data ───────────────────────────────────────────────────────

  function buildStats(code: string): Array<[string, string]> {
    const travel = travelData[code];
    const flight = travel ? `${travel.flightHoursFromLondon}h` : '—';
    const budget = travel?.dailyBudget ?? '—';
    const best = travel?.bestTimeNote?.split(' ')[0] ?? '—';
    return [
      ['Flight', flight],
      ['Budget', budget],
      ['Safe', '—'],
      ['Best', best],
    ];
  }

  const cardA: CompareCountryData | null = selectedA && resolvedA
    ? {
        name: selectedA.name,
        flagCode: alpha3ToAlpha2(selectedA.code),
        visaCategory: toCat(resolvedA.category),
        photoTone: 'sunset',
        stats: buildStats(selectedA.code),
      }
    : null;

  const cardB: CompareCountryData | null = selectedB && resolvedB
    ? {
        name: selectedB.name,
        flagCode: alpha3ToAlpha2(selectedB.code),
        visaCategory: toCat(resolvedB.category),
        photoTone: 'forest',
        stats: buildStats(selectedB.code),
      }
    : null;

  // ── Compute winners ───────────────────────────────────────────────────────

  const winners: WinnerRow[] = useMemo(() => {
    if (!selectedA || !selectedB || !resolvedA || !resolvedB) return [];

    const tA = travelData[selectedA.code];
    const tB = travelData[selectedB.code];

    // "Cheapest" — lower costLevel wins; if equal, show first country
    let cheapestWinner = '—';
    if (tA && tB) {
      cheapestWinner = tA.costLevel <= tB.costLevel ? selectedA.name : selectedB.name;
    }

    // "Easiest visa" — lower rank = easier
    const rankA = CATEGORY_RANK[resolvedA.category] ?? 3;
    const rankB = CATEGORY_RANK[resolvedB.category] ?? 3;
    const easyWinner =
      rankA < rankB ? selectedA.name : rankB < rankA ? selectedB.name : '—';

    // "Best weather" — static first country for now (weather data not in travelData per-month detail)
    const weatherWinner = selectedA.name;

    return [
      { label: 'Cheapest', winner: cheapestWinner },
      { label: 'Easiest visa', winner: easyWinner },
      { label: 'Best weather (Oct)', winner: weatherWinner },
    ];
  }, [selectedA, selectedB, resolvedA, resolvedB]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Country Picker Modal */}
      <CountryPickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={(code) => {
          if (pickerTarget === 'a') setCountryA(code);
          else setCountryB(code);
        }}
        excludeCode={pickerTarget === 'a' ? countryB : countryA}
        heldVisasSet={heldVisasSet}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Left placeholder to centre title (no true back btn on tabs) */}
          <View style={{ width: 38 }} />

          <Text style={[Type.title15, { color: colors.ink }]}>Compare</Text>

          <CircleBtn
            size={38}
            onPress={() => {}}
            accessibilityLabel="Add country"
          >
            <Plus size={18} color={colors.ink} strokeWidth={2} />
          </CircleBtn>
        </View>

        {/* ── Country cards ────────────────────────────────────────────────── */}
        <View style={styles.cardsRow}>
          {cardA ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setPickerTarget('a')}
              activeOpacity={0.85}
            >
              <CompareCountryCard country={cardA} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.emptyCardSlot, { backgroundColor: colors.surface, borderColor: colors.line }]}
              onPress={() => setPickerTarget('a')}
              activeOpacity={0.7}
            >
              <Plus size={22} color={colors.inkMute} />
              <Text style={[Type.body12_5, { color: colors.inkMute, marginTop: 6 }]}>Add country</Text>
            </TouchableOpacity>
          )}

          {/* Swap button */}
          <TouchableOpacity
            style={[styles.swapBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}
            onPress={swap}
            activeOpacity={0.7}
          >
            <ArrowLeftRight size={15} color={colors.inkMute} />
          </TouchableOpacity>

          {cardB ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setPickerTarget('b')}
              activeOpacity={0.85}
            >
              <CompareCountryCard country={cardB} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.emptyCardSlot, { backgroundColor: colors.surface, borderColor: colors.line }]}
              onPress={() => setPickerTarget('b')}
              activeOpacity={0.7}
            >
              <Plus size={22} color={colors.inkMute} />
              <Text style={[Type.body12_5, { color: colors.inkMute, marginTop: 6 }]}>Add country</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text style={[Type.body13, { color: colors.inkMute, marginTop: 10 }]}>
              Generating comparison…
            </Text>
          </View>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && !loading && (
          <TouchableOpacity
            style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
            onPress={retry}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={colors.inkMute} />
            <Text style={[Type.body13, { color: colors.inkMute, marginTop: 8 }]}>{error}</Text>
          </TouchableOpacity>
        )}

        {/* ── AI verdict ───────────────────────────────────────────────────── */}
        {aiData && !loading && (
          <View style={[styles.verdictCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <SectionKicker style={{ marginBottom: 8 }}>AI VERDICT</SectionKicker>
            <Text style={[Type.body14, { color: colors.ink, lineHeight: 21 }]}>
              {aiData.verdict}
            </Text>
            {aiData.valueComparison ? (
              <Text style={[Type.body13, { color: colors.inkMute, marginTop: 8, lineHeight: 19 }]}>
                {aiData.valueComparison}
              </Text>
            ) : null}
          </View>
        )}

        {/* ── Winner list ──────────────────────────────────────────────────── */}
        {winners.length > 0 && (
          <View style={styles.winnerSection}>
            <WinnerList winners={winners} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    // horizontal padding applied per-section
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 0,
  },

  // Country cards row
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 14,
  },
  emptyCardSlot: {
    flex: 1,
    height: 200,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 60,
  },

  // Loading / error
  loadingCard: {
    marginTop: 16,
    marginHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Shadows.subtle,
  },

  // AI verdict card
  verdictCard: {
    marginTop: 12,
    marginHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    ...Shadows.subtle,
  },

  // Winner section
  winnerSection: {
    paddingTop: 16,
    paddingHorizontal: 22,
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingVertical: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 8,
  },
  pickerFlag: {
    fontSize: 22,
  },
  pickerName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    flex: 1,
  },
  pickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pickerBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptySearch: {
    padding: 28,
    alignItems: 'center',
  },
});

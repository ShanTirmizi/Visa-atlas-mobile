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
  Dimensions,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
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
import { Flag } from '@/components/ui/Flag';
import { VisaBadge } from '@/components/ui/Badge';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  value?: number;
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

const SCORE_CATEGORIES: { key: keyof AIScores; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food', emoji: '🍜' },
  { key: 'adventure', label: 'Adventure', emoji: '⛰️' },
  { key: 'culture', label: 'Culture', emoji: '🏛️' },
  { key: 'relaxation', label: 'Relaxation', emoji: '🏖️' },
  { key: 'nightlife', label: 'Nightlife', emoji: '🌙' },
  { key: 'nature', label: 'Nature', emoji: '🌲' },
];

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

function getCategoryColor(
  category: VisaCategory,
  colors: { visaFree: string; visaOnArrival: string; evisa: string; visaRequired: string; inkMute: string },
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
    default:
      return colors.inkMute;
  }
}

function getCategoryLabel(category: VisaCategory): string {
  switch (category) {
    case 'visa-free':
      return 'Visa Free';
    case 'visa-on-arrival':
      return 'On Arrival';
    case 'evisa':
      return 'eVisa';
    case 'visa-required':
      return 'Required';
    case 'home':
      return 'Home';
    default:
      return category;
  }
}

function toCat(category: VisaCategory): 'free' | 'arrival' | 'evisa' | 'required' {
  switch (category) {
    case 'visa-free':
      return 'free';
    case 'visa-on-arrival':
      return 'arrival';
    case 'evisa':
      return 'evisa';
    default:
      return 'required';
  }
}

const CATEGORY_RANK: Record<VisaCategory, number> = {
  'visa-free': 0,
  'visa-on-arrival': 1,
  evisa: 2,
  'visa-required': 3,
  home: -1,
};

// ---------------------------------------------------------------------------
// Score Bar — animated, Reanimated
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  emoji,
  scoreA,
  scoreB,
  nameA,
  nameB,
}: {
  label: string;
  emoji: string;
  scoreA: number;
  scoreB: number;
  nameA: string;
  nameB: string;
}) {
  const { colors } = useTheme();
  const aWins = scoreA >= scoreB;
  const bWins = scoreB >= scoreA;

  const progressA = useSharedValue(0);
  const progressB = useSharedValue(0);

  useEffect(() => {
    progressA.value = withTiming(scoreA / 10, { duration: 700, easing: Easing.out(Easing.quad) });
    progressB.value = withTiming(scoreB / 10, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [scoreA, scoreB]);

  // Available bar width: screen - paddings - number labels - center label
  const barMaxWidth = (SCREEN_WIDTH - 28 * 2 - 60 - 24) / 2;

  const styleA = useAnimatedStyle(() => ({
    width: interpolate(progressA.value, [0, 1], [0, barMaxWidth]),
    opacity: aWins ? 1 : 0.3,
  }));

  const styleB = useAnimatedStyle(() => ({
    width: interpolate(progressB.value, [0, 1], [0, barMaxWidth]),
    opacity: bWins ? 1 : 0.3,
  }));

  return (
    <View style={scoreStyles.row}>
      {/* A side — bar grows from right to left */}
      <View style={scoreStyles.sideA}>
        <Text style={[scoreStyles.num, { color: aWins ? colors.ink : colors.inkMute }]}>
          {scoreA}
        </Text>
        <View style={[scoreStyles.trackA, { backgroundColor: colors.line, width: barMaxWidth }]}>
          <Animated.View
            style={[
              scoreStyles.fillA,
              { backgroundColor: colors.ink, borderRadius: 3.5 },
              styleA,
            ]}
          />
        </View>
      </View>

      {/* Center label */}
      <View style={scoreStyles.labelBox}>
        <Text style={scoreStyles.emoji}>{emoji}</Text>
        <Text style={[scoreStyles.labelText, { color: colors.inkMute }]}>{label}</Text>
      </View>

      {/* B side — bar grows left to right */}
      <View style={scoreStyles.sideB}>
        <View style={[scoreStyles.trackB, { backgroundColor: colors.line, width: barMaxWidth }]}>
          <Animated.View
            style={[
              scoreStyles.fillB,
              { backgroundColor: colors.ink, borderRadius: 3.5 },
              styleB,
            ]}
          />
        </View>
        <Text style={[scoreStyles.num, { color: bWins ? colors.ink : colors.inkMute }]}>
          {scoreB}
        </Text>
      </View>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sideA: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  sideB: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackA: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  trackB: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  fillA: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  fillB: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  num: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    minWidth: 16,
    textAlign: 'center',
  },
  labelBox: {
    width: 60,
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 1,
  },
  emoji: {
    fontSize: 11,
  },
  labelText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 8.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Skeleton shimmer for loading state
// ---------------------------------------------------------------------------

function SkeletonBar({ widthPct }: { widthPct: number }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceMuted,
    flex: widthPct,
  }));

  return <Animated.View style={animStyle} />;
}

function LoadingState() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <SectionKicker style={{ marginBottom: 14 }}>GENERATING COMPARISON</SectionKicker>
      <Text style={[Type.body13, { color: colors.inkMute, marginBottom: 18 }]}>
        Analysing visa requirements, costs, and experiences…
      </Text>

      {/* Skeleton score rows */}
      {SCORE_CATEGORIES.map((cat) => (
        <View key={cat.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <SkeletonBar widthPct={4} />
          <View style={{ width: 60, alignItems: 'center' }}>
            <Text style={scoreStyles.emoji}>{cat.emoji}</Text>
          </View>
          <SkeletonBar widthPct={4} />
        </View>
      ))}

      {/* Skeleton verdict lines */}
      <View style={{ marginTop: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          <SkeletonBar widthPct={9} />
          <View style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <SkeletonBar widthPct={7} />
          <View style={{ flex: 3 }} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <SkeletonBar widthPct={8} />
          <View style={{ flex: 2 }} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Country Picker Modal
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Handle */}
        <View style={styles.modalHandle}>
          <View style={[styles.handleBar, { backgroundColor: colors.inkMute }]} />
        </View>

        {/* Header */}
        <View
          style={[
            styles.modalHeader,
            { paddingTop: Platform.OS === 'android' ? insets.top + 14 : 14 },
          ]}
        >
          <Text style={[Type.title18, { color: colors.ink }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={colors.inkMute} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { borderBottomColor: colors.line }]}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
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
// Empty slot tile (dashed "+Pick a country" card)
// ---------------------------------------------------------------------------

function EmptySlotTile({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.emptySlot,
        { backgroundColor: colors.surface, borderColor: colors.inkFaint },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.plusCircle, { borderColor: colors.inkMute }]}>
        <Plus size={20} color={colors.inkMute} strokeWidth={1.8} />
      </View>
      <Text style={[Type.body13, { color: colors.inkMute, marginTop: 10 }]}>Pick a country</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CompareScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { heldVisas, residence } = useVisa();

  // No defaults — clean empty state
  const [countryA, setCountryA] = useState('');
  const [countryB, setCountryB] = useState('');
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

  const bothSelected = !!selectedA && !!selectedB;

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
        flightHours:
          getFlightHours(residence ?? 'GBR', selectedA.code) ?? travelA.flightHoursFromLondon,
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
        flightHours:
          getFlightHours(residence ?? 'GBR', selectedB.code) ?? travelB.flightHoursFromLondon,
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
          setError(
            err.name === 'AbortError' ? null : 'Failed to generate comparison. Tap to retry.',
          );
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [countryA, countryB, heldVisasSet]);

  // ── Swap handler ─────────────────────────────────────────────────────────
  const swap = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCountryA(countryB);
    setCountryB(countryA);
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
    const flightH = getFlightHours(residence ?? 'GBR', code) ?? travel?.flightHoursFromLondon;
    const flight = flightH != null ? `${flightH}h` : '—';
    const budget = travel?.dailyBudget ?? '—';
    const best = travel?.bestTimeNote?.split(' ')[0] ?? '—';
    const costSymbol = travel?.costLevel === 1 ? '$' : travel?.costLevel === 2 ? '$$' : '$$$';
    return [
      ['Flight', flight],
      ['Budget', budget],
      ['Cost', costSymbol],
      ['Best', best],
    ];
  }

  const cardA: CompareCountryData | null =
    selectedA && resolvedA
      ? {
          name: selectedA.name,
          flagCode: alpha3ToAlpha2(selectedA.code),
          visaCategory: toCat(resolvedA.category),
          stats: buildStats(selectedA.code),
        }
      : null;

  const cardB: CompareCountryData | null =
    selectedB && resolvedB
      ? {
          name: selectedB.name,
          flagCode: alpha3ToAlpha2(selectedB.code),
          visaCategory: toCat(resolvedB.category),
          stats: buildStats(selectedB.code),
        }
      : null;

  // ── Compute winners ───────────────────────────────────────────────────────

  const winners: WinnerRow[] = useMemo(() => {
    if (!selectedA || !selectedB || !resolvedA || !resolvedB) return [];

    const tA = travelData[selectedA.code];
    const tB = travelData[selectedB.code];

    // Cheapest — lower costLevel wins
    let cheapestWinner = '—';
    if (tA && tB) {
      cheapestWinner = tA.costLevel <= tB.costLevel ? selectedA.name : selectedB.name;
    }

    // Easiest visa
    const rankA = CATEGORY_RANK[resolvedA.category] ?? 3;
    const rankB = CATEGORY_RANK[resolvedB.category] ?? 3;
    const easyWinner = rankA < rankB ? selectedA.name : rankB < rankA ? selectedB.name : '—';

    // Shortest flight
    const fA = getFlightHours(residence ?? 'GBR', selectedA.code) ?? tA?.flightHoursFromLondon ?? 99;
    const fB = getFlightHours(residence ?? 'GBR', selectedB.code) ?? tB?.flightHoursFromLondon ?? 99;
    const flightWinner = fA <= fB ? selectedA.name : selectedB.name;

    return [
      { label: 'Cheapest', winner: cheapestWinner },
      { label: 'Easiest visa', winner: easyWinner },
      { label: 'Shortest flight', winner: flightWinner },
    ];
  }, [selectedA, selectedB, resolvedA, resolvedB, residence]);

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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[Type.display26, { color: colors.ink }]}>Compare</Text>
            <Text style={[Type.body14, { color: colors.inkMute, marginTop: 4 }]}>
              Pick two destinations to compare visa, budget, weather and vibe.
            </Text>
          </View>
        </View>

        {/* ── Country cards row ────────────────────────────────────────────── */}
        <View style={styles.cardsRow}>
          {/* Slot A */}
          {cardA ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setPickerTarget('a')}
              activeOpacity={0.85}
            >
              <CompareCountryCard country={cardA} />
            </TouchableOpacity>
          ) : (
            <EmptySlotTile onPress={() => setPickerTarget('a')} />
          )}

          {/* Swap / divider column */}
          <View style={styles.midCol}>
            {(countryA && countryB) ? (
              <TouchableOpacity
                style={[styles.swapBtn, { backgroundColor: colors.surface, borderColor: colors.line }]}
                onPress={swap}
                activeOpacity={0.7}
              >
                <ArrowLeftRight size={14} color={colors.inkMute} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.midDivider, { backgroundColor: colors.line }]} />
            )}
          </View>

          {/* Slot B */}
          {cardB ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setPickerTarget('b')}
              activeOpacity={0.85}
            >
              <CompareCountryCard country={cardB} />
            </TouchableOpacity>
          ) : (
            <EmptySlotTile onPress={() => setPickerTarget('b')} />
          )}
        </View>

        {/* ── Empty state guidance (neither selected) ───────────────────────── */}
        {!countryA && !countryB && (
          <View style={[styles.emptyGuidance, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[Type.body14, { color: colors.inkMute, textAlign: 'center', lineHeight: 22 }]}>
              Tap a tile above to search for a country. Once both are selected, we'll generate an AI-powered comparison.
            </Text>
          </View>
        )}

        {/* ── Loading (shimmer skeletons) ────────────────────────────────── */}
        {bothSelected && loading && (
          <View style={styles.section}>
            <LoadingState />
          </View>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {bothSelected && error && !loading && (
          <TouchableOpacity
            style={[styles.card, styles.section, { backgroundColor: colors.surface, borderColor: colors.line }]}
            onPress={retry}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={colors.inkMute} />
            <Text style={[Type.body13, { color: colors.inkMute, marginTop: 8, textAlign: 'center' }]}>
              {error}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Full comparison results ────────────────────────────────────── */}
        {bothSelected && aiData && !loading && (
          <>
            {/* ─ Score Bars ─────────────────────────────────────────────── */}
            <View style={[styles.section]}>
              <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                CATEGORY SCORES
              </SectionKicker>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                {/* Score header row */}
                <View style={[styles.scoreHeader, { borderBottomColor: colors.line }]}>
                  <Text
                    style={[Type.title14, { color: colors.ink, flex: 1, textAlign: 'right', paddingRight: 8 }]}
                    numberOfLines={1}
                  >
                    {selectedA!.name}
                  </Text>
                  <View style={{ width: 60 }} />
                  <Text
                    style={[Type.title14, { color: colors.ink, flex: 1, paddingLeft: 8 }]}
                    numberOfLines={1}
                  >
                    {selectedB!.name}
                  </Text>
                </View>

                {SCORE_CATEGORIES.map((cat) => (
                  <ScoreBar
                    key={cat.key}
                    label={cat.label}
                    emoji={cat.emoji}
                    scoreA={aiData.countryA.scores[cat.key] ?? 5}
                    scoreB={aiData.countryB.scores[cat.key] ?? 5}
                    nameA={selectedA!.name}
                    nameB={selectedB!.name}
                  />
                ))}
              </View>
            </View>

            {/* ─ AI Verdict ─────────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                VERDICT
              </SectionKicker>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text style={[Type.body14, { color: colors.ink, lineHeight: 22 }]}>
                  {aiData.verdict}
                </Text>
                {aiData.valueComparison ? (
                  <Text
                    style={[
                      Type.body13,
                      {
                        color: colors.inkMute,
                        marginTop: 12,
                        lineHeight: 20,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: colors.line,
                      },
                    ]}
                  >
                    {aiData.valueComparison}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* ─ Highlights (2-column) ───────────────────────────────────── */}
            <View style={styles.section}>
              <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                HIGHLIGHTS
              </SectionKicker>
              <View style={styles.highlightsRow}>
                {/* Country A highlights */}
                <View style={[styles.highlightCol, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Flag code={alpha3ToAlpha2(selectedA!.code)} size={16} />
                    <Text style={[Type.title14, { color: colors.ink }]} numberOfLines={1}>
                      {selectedA!.name}
                    </Text>
                  </View>
                  {aiData.countryA.highlights.map((h, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: colors.ink }]} />
                      <Text style={[Type.body13, { color: colors.inkSoft, lineHeight: 18, flex: 1 }]}>
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Country B highlights */}
                <View style={[styles.highlightCol, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Flag code={alpha3ToAlpha2(selectedB!.code)} size={16} />
                    <Text style={[Type.title14, { color: colors.ink }]} numberOfLines={1}>
                      {selectedB!.name}
                    </Text>
                  </View>
                  {aiData.countryB.highlights.map((h, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: colors.ink }]} />
                      <Text style={[Type.body13, { color: colors.inkSoft, lineHeight: 18, flex: 1 }]}>
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* ─ Best For ─────────────────────────────────────────────────── */}
            <View style={styles.section}>
              <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                BEST FOR
              </SectionKicker>
              <View style={styles.highlightsRow}>
                <View
                  style={[
                    styles.bestForCard,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Text style={[Type.kicker, { color: colors.inkMute, marginBottom: 6 }]}>
                    {selectedA!.name}
                  </Text>
                  <Text style={[Type.body14, { color: colors.ink, lineHeight: 20 }]}>
                    {aiData.countryA.bestFor}
                  </Text>
                </View>
                <View
                  style={[
                    styles.bestForCard,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Text style={[Type.kicker, { color: colors.inkMute, marginBottom: 6 }]}>
                    {selectedB!.name}
                  </Text>
                  <Text style={[Type.body14, { color: colors.ink, lineHeight: 20 }]}>
                    {aiData.countryB.bestFor}
                  </Text>
                </View>
              </View>
            </View>

            {/* ─ Weather Verdict ──────────────────────────────────────────── */}
            {(aiData.countryA.weatherVerdict || aiData.countryB.weatherVerdict) && (
              <View style={styles.section}>
                <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                  WEATHER
                </SectionKicker>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  {aiData.countryA.weatherVerdict ? (
                    <View style={aiData.countryB.weatherVerdict ? { marginBottom: 12 } : {}}>
                      <Text style={[Type.meta10_5, { color: colors.inkMute, marginBottom: 4 }]}>
                        {selectedA!.name}
                      </Text>
                      <Text style={[Type.body13, { color: colors.inkSoft, lineHeight: 19 }]}>
                        {aiData.countryA.weatherVerdict}
                      </Text>
                    </View>
                  ) : null}
                  {aiData.countryA.weatherVerdict && aiData.countryB.weatherVerdict && (
                    <View style={[styles.sectionDivider, { backgroundColor: colors.line }]} />
                  )}
                  {aiData.countryB.weatherVerdict ? (
                    <View>
                      <Text style={[Type.meta10_5, { color: colors.inkMute, marginBottom: 4 }]}>
                        {selectedB!.name}
                      </Text>
                      <Text style={[Type.body13, { color: colors.inkSoft, lineHeight: 19 }]}>
                        {aiData.countryB.weatherVerdict}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* ─ Value Comparison ─────────────────────────────────────────── */}
            {aiData.valueComparison && (
              <View style={styles.section}>
                <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                  VALUE
                </SectionKicker>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={[Type.body14, { color: colors.ink, lineHeight: 22 }]}>
                    {aiData.valueComparison}
                  </Text>
                </View>
              </View>
            )}

            {/* ─ Winner by Category ───────────────────────────────────────── */}
            {winners.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: 28 }]}>
                <WinnerList winners={winners} />
              </View>
            )}

            {/* ─ Practical Details ────────────────────────────────────────── */}
            {metaA && metaB && travelA && travelB && (
              <View style={styles.section}>
                <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 28 }}>
                  PRACTICAL DETAILS
                </SectionKicker>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  {[
                    { label: 'Capital', a: metaA.capital, b: metaB.capital },
                    { label: 'Currency', a: metaA.currencyCode, b: metaB.currencyCode },
                    { label: 'Language', a: metaA.language, b: metaB.language },
                    { label: 'Timezone', a: metaA.timezone, b: metaB.timezone },
                    { label: 'Budget', a: travelA.dailyBudget, b: travelB.dailyBudget },
                    { label: 'Best Time', a: travelA.bestTimeNote, b: travelB.bestTimeNote },
                  ].map((row, i) => (
                    <View
                      key={row.label}
                      style={[
                        styles.detailRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                      ]}
                    >
                      <Text
                        style={[Type.body13, { color: colors.inkSoft, flex: 1, textAlign: 'right' }]}
                        numberOfLines={2}
                      >
                        {row.a}
                      </Text>
                      <View style={styles.detailLabelBox}>
                        <Text style={[Type.kicker, { color: colors.inkMute, textAlign: 'center' }]}>
                          {row.label}
                        </Text>
                      </View>
                      <Text
                        style={[Type.body13, { color: colors.inkSoft, flex: 1 }]}
                        numberOfLines={2}
                      >
                        {row.b}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─ Bottom action bar: swap + refresh ────────────────────────── */}
            <View style={[styles.actionBar, { paddingBottom: 8 }]}>
              <CircleBtn size={44} onPress={swap} accessibilityLabel="Swap countries">
                <ArrowLeftRight size={18} color={colors.ink} />
              </CircleBtn>
              <CircleBtn
                size={44}
                onPress={retry}
                accessibilityLabel="Regenerate comparison"
              >
                <RefreshCw size={18} color={colors.ink} />
              </CircleBtn>
            </View>
          </>
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
    // horizontal padding applied per section
  },

  // Header
  header: {
    paddingHorizontal: 28,
    marginBottom: 20,
  },

  // Country cards row
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 14,
    gap: 0,
    marginBottom: 16,
  },

  midCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midDivider: {
    width: 1,
    height: 40,
    borderRadius: 1,
  },
  swapBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty slot tile
  emptySlot: {
    flex: 1,
    minHeight: 180,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty guidance (neither selected)
  emptyGuidance: {
    marginHorizontal: 14,
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },

  // Section wrapper
  section: {
    marginTop: 8,
    marginBottom: 8,
  },

  // Generic card
  card: {
    marginHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    ...Shadows.subtle,
  },

  // Score header
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
  },

  // Highlights 2-column layout
  highlightsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  highlightCol: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    ...Shadows.subtle,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    opacity: 0.5,
  },

  // Best For cards
  bestForCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    ...Shadows.subtle,
  },

  // Section divider
  sectionDivider: {
    height: 1,
    marginVertical: 12,
  },

  // Practical details
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabelBox: {
    width: 72,
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 8,
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

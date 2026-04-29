import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, RefreshCw, ArrowLeftRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';
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
import { WinnerList, type WinnerRow } from '@/components/compare/WinnerList';
import { VsPickerCard } from '@/components/compare/VsPickerCard';
import { FaceoffRow } from '@/components/compare/FaceoffRow';
import {
  CompareCountryCardV2,
  toAlpha2,
} from '@/components/compare/CompareCountryCardV2';
import { CategoryScoresCard } from '@/components/compare/CategoryScoresCard';
import { VerdictCard } from '@/components/compare/VerdictCard';
import TripPlannerSheet, { type TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';
import { useRouter } from 'expo-router';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';

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

const SCORE_CATEGORIES: { key: keyof AIScores; label: string }[] = [
  { key: 'food',       label: 'FOOD' },
  { key: 'adventure',  label: 'ADVENTURE' },
  { key: 'culture',    label: 'CULTURE' },
  { key: 'relaxation', label: 'RELAXATION' },
  { key: 'nightlife',  label: 'NIGHTLIFE' },
  { key: 'nature',     label: 'NATURE' },
];

// ---------------------------------------------------------------------------
// Popular face-offs
// ---------------------------------------------------------------------------
const POPULAR_FACEOFFS = [
  { codeA: 'JPN', nameA: 'Japan',    codeB: 'VNM', nameB: 'Vietnam' },
  { codeA: 'PRT', nameA: 'Portugal', codeB: 'ESP', nameB: 'Spain' },
  { codeA: 'THA', nameA: 'Thailand', codeB: 'IDN', nameB: 'Indonesia' },
];

// ---------------------------------------------------------------------------
// ISO alpha-3 → alpha-2 (for Flag component and isoToFlagEmoji)
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
      {SCORE_CATEGORIES.map((cat) => (
        <View key={cat.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <SkeletonBar widthPct={4} />
          <View style={{ width: 80, alignItems: 'center' }}>
            <Text style={[styles.skeletonCatLabel, { color: colors.inkMute }]}>{cat.label}</Text>
          </View>
          <SkeletonBar widthPct={4} />
        </View>
      ))}
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
// Main Screen
// ---------------------------------------------------------------------------

export default function CompareScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { heldVisas, residence } = useVisa();
  const plannerRef = useRef<TripPlannerSheetRef>(null);
  const [planTarget, setPlanTarget] = useState<'a' | 'b'>('a');

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

  function buildFlightHours(code: string): number | null {
    const travel = travelData[code];
    return getFlightHours(residence ?? 'GBR', code) ?? travel?.flightHoursFromLondon ?? null;
  }

  function buildBudget(code: string): string {
    return travelData[code]?.dailyBudget ?? '—';
  }

  function buildBestTime(code: string): string {
    return travelData[code]?.bestTimeNote?.split(' ')[0] ?? '—';
  }

  // ── Compute winners ───────────────────────────────────────────────────────

  const winners: WinnerRow[] = useMemo(() => {
    if (!selectedA || !selectedB || !resolvedA || !resolvedB) return [];

    const tA = travelData[selectedA.code];
    const tB = travelData[selectedB.code];

    let cheapestWinner = '—';
    if (tA && tB) {
      cheapestWinner = tA.costLevel <= tB.costLevel ? selectedA.name : selectedB.name;
    }

    const rankA = CATEGORY_RANK[resolvedA.category] ?? 3;
    const rankB = CATEGORY_RANK[resolvedB.category] ?? 3;
    const easyWinner = rankA < rankB ? selectedA.name : rankB < rankA ? selectedB.name : '—';

    const fA = getFlightHours(residence ?? 'GBR', selectedA.code) ?? tA?.flightHoursFromLondon ?? 99;
    const fB = getFlightHours(residence ?? 'GBR', selectedB.code) ?? tB?.flightHoursFromLondon ?? 99;
    const flightWinner = fA <= fB ? selectedA.name : selectedB.name;

    return [
      { label: 'Cheapest', winner: cheapestWinner },
      { label: 'Easiest visa', winner: easyWinner },
      { label: 'Shortest flight', winner: flightWinner },
    ];
  }, [selectedA, selectedB, resolvedA, resolvedB, residence]);

  // ── Determine overall winner (for card badge) ─────────────────────────────

  const overallWinner = useMemo<'a' | 'b' | null>(() => {
    if (!aiData || !selectedA || !selectedB) return null;
    const scoresA = SCORE_CATEGORIES.map((c) => aiData.countryA.scores[c.key] ?? 5);
    const scoresB = SCORE_CATEGORIES.map((c) => aiData.countryB.scores[c.key] ?? 5);
    const sumA = scoresA.reduce((a, b) => a + b, 0);
    const sumB = scoresB.reduce((a, b) => a + b, 0);
    if (sumA === sumB) return null;
    return sumA > sumB ? 'a' : 'b';
  }, [aiData, selectedA, selectedB]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Dynamic header title
  const titleNode = bothSelected && selectedA && selectedB ? (
    <Text
      style={{
        fontFamily: FontFamily.display,
        fontSize: 32,
        fontWeight: '500',
        letterSpacing: -32 * 0.022,
        lineHeight: 34,
        color: colors.ink,
        marginTop: 4,
      }}
    >
      <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>
        {selectedA.name}
      </Text>
      {' vs '}
      <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>
        {selectedB.name}
      </Text>
      <Text style={{ color: colors.coral }}>.</Text>
    </Text>
  ) : (
    <Text
      style={{
        fontFamily: FontFamily.display,
        fontSize: 38,
        fontWeight: '500',
        letterSpacing: -38 * 0.022,
        lineHeight: 40,
        color: colors.ink,
        marginTop: 4,
      }}
    >
      Compare{' '}
      <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>
        two
      </Text>
      <Text style={{ color: colors.coral }}>.</Text>
    </Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopSafeAreaBlur />

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
          <Text style={[Type.kicker, { color: colors.inkMute }]}>SIDE BY SIDE</Text>
          {titleNode}
          <Squiggle
            width={bothSelected ? 160 : 110}
            color={colors.coral}
            style={{ marginTop: 6 }}
          />
        </View>

        {/* ════════════════════════════════════════════════════════════════
            LANDING STATE — no countries selected
        ════════════════════════════════════════════════════════════════ */}
        {!bothSelected && (
          <>
            {/* VsPickerCard */}
            <VsPickerCard
              onPickFirst={() => setPickerTarget('a')}
              onPickSecond={() => setPickerTarget('b')}
              firstLabel={selectedA?.name}
              secondLabel={selectedB?.name}
            />

            {/* Popular face-offs */}
            <View style={styles.faceoffSection}>
              <View style={styles.faceoffHeader}>
                <Text style={[Type.kicker, { color: colors.inkMute }]}>
                  Popular face-offs
                </Text>
                <Squiggle width={80} color={colors.coral} style={{ marginTop: 3 }} />
              </View>
              <View
                style={[
                  styles.faceoffCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                  },
                ]}
              >
                {POPULAR_FACEOFFS.map((fo, i) => (
                  <FaceoffRow
                    key={`${fo.codeA}-${fo.codeB}`}
                    codeA={fo.codeA}
                    nameA={fo.nameA}
                    codeB={fo.codeB}
                    nameB={fo.nameB}
                    hasDivider={i > 0}
                    onOpen={() => {
                      setCountryA(fo.codeA);
                      setCountryB(fo.codeB);
                    }}
                  />
                ))}
              </View>
            </View>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            RESULTS STATE — both countries selected
        ════════════════════════════════════════════════════════════════ */}
        {bothSelected && (
          <>
            {/* ── Country cards row with swap button ──────────────────── */}
            <View style={styles.cardsRowWrapper}>
              <View style={styles.cardsRow}>
                {/* Card A */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setPickerTarget('a')}
                  activeOpacity={0.85}
                >
                  <CompareCountryCardV2
                    countryName={selectedA!.name}
                    countryCode={selectedA!.code}
                    visaCategory={toCat(resolvedA!.category)}
                    flightHours={buildFlightHours(selectedA!.code)}
                    dailyBudget={buildBudget(selectedA!.code)}
                    bestTime={buildBestTime(selectedA!.code)}
                    isWinner={overallWinner === 'a'}
                  />
                </TouchableOpacity>

                {/* Swap button — centered absolutely between cards */}
                <View style={styles.swapBtnContainer}>
                  <TouchableOpacity
                    style={[
                      styles.swapBtn,
                      { backgroundColor: colors.ink },
                    ]}
                    onPress={swap}
                    activeOpacity={0.8}
                    accessibilityLabel="Swap countries"
                  >
                    <ArrowLeftRight size={13} color="#FFFFFF" strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* Card B */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setPickerTarget('b')}
                  activeOpacity={0.85}
                >
                  <CompareCountryCardV2
                    countryName={selectedB!.name}
                    countryCode={selectedB!.code}
                    visaCategory={toCat(resolvedB!.category)}
                    flightHours={buildFlightHours(selectedB!.code)}
                    dailyBudget={buildBudget(selectedB!.code)}
                    bestTime={buildBestTime(selectedB!.code)}
                    isWinner={overallWinner === 'b'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Loading ──────────────────────────────────────────────── */}
            {loading && (
              <View style={styles.section}>
                <LoadingState />
              </View>
            )}

            {/* ── Error ─────────────────────────────────────────────────── */}
            {error && !loading && (
              <TouchableOpacity
                style={[
                  styles.card,
                  styles.section,
                  { backgroundColor: colors.surface, borderColor: colors.line, alignItems: 'center' },
                ]}
                onPress={retry}
                activeOpacity={0.7}
              >
                <RefreshCw size={18} color={colors.inkMute} />
                <Text style={[Type.body13, { color: colors.inkMute, marginTop: 8, textAlign: 'center' }]}>
                  {error}
                </Text>
              </TouchableOpacity>
            )}

            {/* ── Full comparison results ────────────────────────────── */}
            {aiData && !loading && (
              <>
                {/* ─ Category Scores Card ──────────────────────────────── */}
                <View style={[styles.section, { paddingHorizontal: 14 }]}>
                  <CategoryScoresCard
                    scoresA={SCORE_CATEGORIES.map((c) => aiData.countryA.scores[c.key] ?? 5)}
                    scoresB={SCORE_CATEGORIES.map((c) => aiData.countryB.scores[c.key] ?? 5)}
                    nameA={selectedA!.name}
                    nameB={selectedB!.name}
                    categories={SCORE_CATEGORIES.map((c) => c.label)}
                  />
                </View>

                {/* ─ Verdict Card — dark ink bg ────────────────────────── */}
                <View style={[styles.section, { paddingHorizontal: 14 }]}>
                  <VerdictCard text={aiData.verdict} />
                </View>

                {/* ─ Highlights (2-column) ─────────────────────────────── */}
                <View style={styles.section}>
                  <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 14 }}>
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

                {/* ─ Best For ──────────────────────────────────────────── */}
                <View style={styles.section}>
                  <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 14 }}>
                    BEST FOR
                  </SectionKicker>
                  <View style={styles.highlightsRow}>
                    <View style={[styles.bestForCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <Text style={[Type.kicker, { color: colors.inkMute, marginBottom: 6 }]}>
                        {selectedA!.name}
                      </Text>
                      <Text style={[Type.body14, { color: colors.ink, lineHeight: 20 }]}>
                        {aiData.countryA.bestFor}
                      </Text>
                    </View>
                    <View style={[styles.bestForCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <Text style={[Type.kicker, { color: colors.inkMute, marginBottom: 6 }]}>
                        {selectedB!.name}
                      </Text>
                      <Text style={[Type.body14, { color: colors.ink, lineHeight: 20 }]}>
                        {aiData.countryB.bestFor}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ─ Weather Verdict ───────────────────────────────────── */}
                {(aiData.countryA.weatherVerdict || aiData.countryB.weatherVerdict) && (
                  <View style={styles.section}>
                    <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 14 }}>
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

                {/* ─ Value Comparison ──────────────────────────────────── */}
                {aiData.valueComparison && (
                  <View style={styles.section}>
                    <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 14 }}>
                      VALUE
                    </SectionKicker>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <Text style={[Type.body14, { color: colors.ink, lineHeight: 22 }]}>
                        {aiData.valueComparison}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ─ Winner by Category ────────────────────────────────── */}
                {winners.length > 0 && (
                  <View style={[styles.section, { paddingHorizontal: 14 }]}>
                    <WinnerList winners={winners} />
                  </View>
                )}

                {/* ─ Practical Details ─────────────────────────────────── */}
                {metaA && metaB && travelA && travelB && (
                  <View style={styles.section}>
                    <SectionKicker style={{ marginBottom: 12, paddingHorizontal: 14 }}>
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

                {/* ─ Plan-a-trip CTAs ───────────────────────────────────── */}
                {selectedA && selectedB && (
                  <View style={styles.planRow}>
                    <Pressable
                      onPress={() => {
                        setPlanTarget('a');
                        plannerRef.current?.present();
                      }}
                      style={({ pressed }) => [
                        styles.planBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.line,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
                        PLAN
                      </Text>
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 15,
                          fontWeight: '500',
                          color: colors.ink,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {selectedA.name}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setPlanTarget('b');
                        plannerRef.current?.present();
                      }}
                      style={({ pressed }) => [
                        styles.planBtn,
                        {
                          backgroundColor: colors.coral,
                          borderColor: colors.coral,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[Type.kickerSm, { color: 'rgba(255,255,255,0.85)', fontSize: 9 }]}>
                        PLAN
                      </Text>
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 15,
                          fontWeight: '500',
                          color: '#FFFFFF',
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {selectedB.name}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* ─ Bottom action bar: swap + refresh ─────────────────── */}
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
          </>
        )}
      </ScrollView>

      {/* ── Planner sheet — opens for whichever side was tapped ─── */}
      {(() => {
        const c = planTarget === 'a' ? selectedA : selectedB;
        const m = planTarget === 'a' ? metaA : metaB;
        const t = planTarget === 'a' ? travelA : travelB;
        const r = planTarget === 'a' ? resolvedA : resolvedB;
        if (!c || !r) return null;
        return (
          <TripPlannerSheet
            ref={plannerRef}
            country={c}
            meta={m}
            travel={t}
            resolved={r}
            heldVisas={heldVisasSet}
            onTripCreated={(tripId) => router.push(`/trip/${tripId}` as never)}
          />
        );
      })()}
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
    paddingHorizontal: 22,
    marginBottom: 24,
  },

  // Country cards wrapper (with overflow: visible for TOP PICK badge)
  cardsRowWrapper: {
    paddingHorizontal: 14,
    marginBottom: 16,
    paddingTop: 14, // space for badge
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    position: 'relative',
  },

  // Swap button between cards
  swapBtnContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -14,
    marginTop: -14,
    zIndex: 20,
  },
  swapBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    ...Shadows.subtle,
  },

  // Popular face-offs section
  faceoffSection: {
    paddingHorizontal: 22,
  },
  faceoffHeader: {
    marginBottom: 12,
  },
  faceoffCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.subtle,
    shadowColor: '#1F1A14',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
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

  // Plan CTAs
  planRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 14,
    marginTop: 8,
  },
  planBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
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

  // Skeleton cat label
  skeletonCatLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 9 * 0.14,
    fontWeight: '600',
  },
});

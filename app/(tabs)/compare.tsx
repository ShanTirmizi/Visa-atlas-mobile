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
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftRight, ChevronDown, Search, X, Sparkles, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
  type ThemeColors,
} from '@/constants/theme';
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
import { travelData, type TravelInfo } from '@/data/travelData';

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

const SCORE_CATEGORIES: { key: keyof AIScores; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food', emoji: '\uD83C\uDF5C' },
  { key: 'adventure', label: 'Adventure', emoji: '\u26F0\uFE0F' },
  { key: 'culture', label: 'Culture', emoji: '\uD83C\uDFDB\uFE0F' },
  { key: 'relaxation', label: 'Relaxation', emoji: '\uD83C\uDFD6\uFE0F' },
  { key: 'nightlife', label: 'Nightlife', emoji: '\uD83C\uDF19' },
  { key: 'nature', label: 'Nature', emoji: '\uD83C\uDF32' },
  { key: 'value', label: 'Value', emoji: '\uD83D\uDCB0' },
];

const LOADING_MESSAGES = [
  'Comparing destinations...',
  'Analysing visa requirements...',
  'Evaluating costs...',
  'Rating local experiences...',
  'Crunching the numbers...',
];

// ---------------------------------------------------------------------------
// ISO alpha-3 to flag emoji
// ---------------------------------------------------------------------------

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

function isoToFlag(code: string): string {
  const a2 = ALPHA3_TO_ALPHA2[code.toUpperCase()];
  if (!a2) return '';
  return a2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function getCategoryColor(category: VisaCategory, colors: ThemeColors): string {
  switch (category) {
    case 'visa-free': return colors.visaFree;
    case 'visa-on-arrival': return colors.visaOnArrival;
    case 'evisa': return colors.evisa;
    case 'visa-required': return colors.visaRequired;
    default: return colors.textMuted;
  }
}

function getCategoryBgColor(category: VisaCategory, colors: ThemeColors): string {
  switch (category) {
    case 'visa-free': return colors.visaFreeBg;
    case 'visa-on-arrival': return colors.visaOnArrivalBg;
    case 'evisa': return colors.evisaBg;
    case 'visa-required': return colors.visaRequiredBg;
    default: return colors.shimmer;
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

// ---------------------------------------------------------------------------
// Country Picker Modal
// ---------------------------------------------------------------------------

function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  excludeCode,
  heldVisasSet,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  excludeCode: string;
  heldVisasSet: Set<HeldVisaType>;
  colors: ThemeColors;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    return visaData
      .filter((c) => c.category !== 'home' && c.code !== excludeCode)
      .filter((c) => {
        if (!search) return true;
        return c.name.toLowerCase().includes(search.toLowerCase());
      });
  }, [search, excludeCode]);

  const handleSelect = useCallback((code: string) => {
    onSelect(code);
    onClose();
    setSearch('');
  }, [onSelect, onClose]);

  const renderItem = useCallback(({ item }: { item: CountryVisa }) => {
    const resolved = resolveCountry(item, heldVisasSet);
    const catColor = getCategoryColor(resolved.category, colors);
    const catBg = getCategoryBgColor(resolved.category, colors);
    return (
      <TouchableOpacity
        style={[styles.pickerItem, { borderBottomColor: colors.borderSubtle }]}
        onPress={() => handleSelect(item.code)}
        activeOpacity={0.6}
      >
        <Text style={styles.pickerFlag}>{isoToFlag(item.code)}</Text>
        <Text style={[styles.pickerName, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.pickerBadge, { backgroundColor: catBg }]}>
          <Text style={[styles.pickerBadgeText, { color: catColor }]}>
            {getCategoryLabel(resolved.category)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [colors, heldVisasSet, handleSelect]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Handle bar */}
        <View style={styles.modalHandle}>
          <View style={[styles.handleBar, { backgroundColor: colors.textMuted }]} />
        </View>

        {/* Header */}
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'android' ? insets.top + Spacing.sm : Spacing.md }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Country</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { borderBottomColor: colors.borderSubtle }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search countries..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[styles.emptySearchText, { color: colors.textMuted }]}>
                No countries found
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Score Bar
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  emoji,
  scoreA,
  scoreB,
  colors,
}: {
  label: string;
  emoji: string;
  scoreA: number;
  scoreB: number;
  colors: ThemeColors;
}) {
  const barWidth = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2 - 80) / 2;
  const aWins = scoreA > scoreB;
  const bWins = scoreB > scoreA;

  const animA = useRef(new Animated.Value(0)).current;
  const animB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animA, {
        toValue: scoreA / 10,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(animB, {
        toValue: scoreB / 10,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  }, [scoreA, scoreB]);

  return (
    <View style={styles.scoreRow}>
      {/* A side */}
      <View style={styles.scoreBarSide}>
        <Text style={[styles.scoreNum, { color: aWins ? colors.primary : colors.textMuted }]}>
          {scoreA}
        </Text>
        <View style={[styles.barTrack, { backgroundColor: colors.shimmer, width: barWidth - 26 }]}>
          <Animated.View
            style={[
              styles.barFillRight,
              {
                backgroundColor: colors.primary,
                opacity: aWins ? 1 : 0.45,
                width: animA.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Category label */}
      <View style={styles.scoreLabelBox}>
        <Text style={styles.scoreLabelEmoji}>{emoji}</Text>
        <Text style={[styles.scoreLabelText, { color: colors.textSecondary }]}>{label}</Text>
      </View>

      {/* B side */}
      <View style={styles.scoreBarSideB}>
        <View style={[styles.barTrack, { backgroundColor: colors.shimmer, width: barWidth - 26 }]}>
          <Animated.View
            style={[
              styles.barFillLeft,
              {
                backgroundColor: colors.accent,
                opacity: bWins ? 1 : 0.45,
                width: animB.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.scoreNum, { color: bWins ? colors.accent : colors.textMuted }]}>
          {scoreB}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading State
// ---------------------------------------------------------------------------

function LoadingState({ colors }: { colors: ThemeColors }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: Spacing.md }} />
      <Animated.Text style={[styles.loadingText, { color: colors.textSecondary, opacity: fadeAnim }]}>
        {LOADING_MESSAGES[msgIndex]}
      </Animated.Text>

      {/* Skeleton bars */}
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.skeletonRow, { marginTop: i === 0 ? Spacing.lg : Spacing.sm }]}>
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, flex: 1 }]} />
          <View style={[styles.skeletonDot, { backgroundColor: colors.shimmer }]} />
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, flex: 1 }]} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CompareScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { heldVisas } = useVisa();

  const [countryA, setCountryA] = useState('');
  const [countryB, setCountryB] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'a' | 'b' | null>(null);
  const [aiData, setAiData] = useState<AIComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const fetchRef = useRef<AbortController | null>(null);

  const heldVisasSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  const selectedA = useMemo(() => visaData.find((c) => c.code === countryA), [countryA]);
  const selectedB = useMemo(() => visaData.find((c) => c.code === countryB), [countryB]);
  const metaA = countryA ? countryMeta[countryA] : null;
  const metaB = countryB ? countryMeta[countryB] : null;
  const travelA = countryA ? travelData[countryA] : null;
  const travelB = countryB ? travelData[countryB] : null;

  // Auto-fetch comparison when both countries selected
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

    const resolvedA = resolveCountry(selectedA, heldVisasSet);
    const resolvedB = resolveCountry(selectedB, heldVisasSet);

    const payload = {
      countryA: {
        name: selectedA.name,
        region: metaA.region,
        capital: metaA.capital,
        currency: metaA.currency,
        language: metaA.language,
        dailyBudget: travelA.dailyBudget,
        flightHours: travelA.flightHoursFromLondon,
        costLevel: travelA.costLevel,
        visaCategory: categoryLabels[resolvedA.category],
        bestTimeNote: travelA.bestTimeNote,
      },
      countryB: {
        name: selectedB.name,
        region: metaB.region,
        capital: metaB.capital,
        currency: metaB.currency,
        language: metaB.language,
        dailyBudget: travelB.dailyBudget,
        flightHours: travelB.flightHoursFromLondon,
        costLevel: travelB.costLevel,
        visaCategory: categoryLabels[resolvedB.category],
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
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setAiData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.name === 'AbortError' ? null : 'Failed to generate comparison. Tap to retry.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [countryA, countryB, heldVisasSet]);

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

  const toggleSection = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const bothSelected = !!selectedA && !!selectedB;

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
        colors={colors}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[styles.heading, { color: colors.foreground }]}>Compare</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pick two countries to compare
        </Text>

        {/* Selectors */}
        <View style={styles.selectorRow}>
          {/* Country A picker */}
          <TouchableOpacity
            style={[
              styles.selectorBtn,
              {
                backgroundColor: colors.card,
                borderColor: selectedA ? colors.primary : colors.border,
                borderWidth: selectedA ? 1.5 : 1,
              },
            ]}
            onPress={() => setPickerTarget('a')}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>COUNTRY A</Text>
            {selectedA ? (
              <View style={styles.selectorSelected}>
                <Text style={styles.selectorFlag}>{isoToFlag(selectedA.code)}</Text>
                <Text style={[styles.selectorName, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedA.name}
                </Text>
              </View>
            ) : (
              <View style={styles.selectorPlaceholderRow}>
                <Text style={[styles.selectorPlaceholder, { color: colors.textMuted }]}>
                  Select...
                </Text>
                <ChevronDown size={14} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>

          {/* Swap button */}
          <TouchableOpacity
            style={[styles.swapBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={swap}
            activeOpacity={0.7}
          >
            <ArrowLeftRight size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Country B picker */}
          <TouchableOpacity
            style={[
              styles.selectorBtn,
              {
                backgroundColor: colors.card,
                borderColor: selectedB ? colors.accent : colors.border,
                borderWidth: selectedB ? 1.5 : 1,
              },
            ]}
            onPress={() => setPickerTarget('b')}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>COUNTRY B</Text>
            {selectedB ? (
              <View style={styles.selectorSelected}>
                <Text style={styles.selectorFlag}>{isoToFlag(selectedB.code)}</Text>
                <Text style={[styles.selectorName, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedB.name}
                </Text>
              </View>
            ) : (
              <View style={styles.selectorPlaceholderRow}>
                <Text style={[styles.selectorPlaceholder, { color: colors.textMuted }]}>
                  Select...
                </Text>
                <ChevronDown size={14} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Empty state */}
        {!bothSelected && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowLeftRight size={36} color={colors.textMuted} style={{ opacity: 0.3, marginBottom: Spacing.md }} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Select two countries above to get an AI-powered comparison
            </Text>
          </View>
        )}

        {/* Loading state */}
        {bothSelected && loading && <LoadingState colors={colors} />}

        {/* Error state */}
        {bothSelected && error && (
          <TouchableOpacity
            style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.danger }]}
            onPress={retry}
            activeOpacity={0.7}
          >
            <RefreshCw size={20} color={colors.danger} style={{ marginBottom: Spacing.sm }} />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          </TouchableOpacity>
        )}

        {/* Comparison results */}
        {bothSelected && aiData && (
          <View style={styles.resultsContainer}>
            {/* Score Bars */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Score header */}
              <View style={[styles.scoreHeader, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.scoreHeaderName, { color: colors.primary }]} numberOfLines={1}>
                  {selectedA!.name}
                </Text>
                <Text style={[styles.scoreHeaderLabel, { color: colors.textMuted }]}>SCORE</Text>
                <Text style={[styles.scoreHeaderName, { color: colors.accent, textAlign: 'right' }]} numberOfLines={1}>
                  {selectedB!.name}
                </Text>
              </View>

              {SCORE_CATEGORIES.map((cat) => (
                <ScoreBar
                  key={cat.key}
                  label={cat.label}
                  emoji={cat.emoji}
                  scoreA={aiData.countryA.scores[cat.key]}
                  scoreB={aiData.countryB.scores[cat.key]}
                  colors={colors}
                />
              ))}
            </View>

            {/* Hero Cards - Country A */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroFlag}>{isoToFlag(selectedA!.code)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroName, { color: colors.foreground }]}>{selectedA!.name}</Text>
                  <Text style={[styles.heroPitch, { color: colors.textSecondary }]}>{aiData.countryA.pitch}</Text>
                </View>
              </View>
              <View style={[styles.heroBestFor, { backgroundColor: colors.primaryBg, borderColor: colors.primaryGlow }]}>
                <Text style={[styles.heroBestForText, { color: colors.primary }]}>{aiData.countryA.bestFor}</Text>
              </View>
              {aiData.countryA.highlights.map((h, i) => (
                <View key={i} style={styles.highlightRow}>
                  <View style={[styles.highlightDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.highlightText, { color: colors.textSecondary }]}>{h}</Text>
                </View>
              ))}
            </View>

            {/* Hero Cards - Country B */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroFlag}>{isoToFlag(selectedB!.code)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroName, { color: colors.foreground }]}>{selectedB!.name}</Text>
                  <Text style={[styles.heroPitch, { color: colors.textSecondary }]}>{aiData.countryB.pitch}</Text>
                </View>
              </View>
              <View style={[styles.heroBestFor, { backgroundColor: colors.accentBg, borderColor: colors.accentGlow }]}>
                <Text style={[styles.heroBestForText, { color: colors.accent }]}>{aiData.countryB.bestFor}</Text>
              </View>
              {aiData.countryB.highlights.map((h, i) => (
                <View key={i} style={styles.highlightRow}>
                  <View style={[styles.highlightDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.highlightText, { color: colors.textSecondary }]}>{h}</Text>
                </View>
              ))}
            </View>

            {/* The Verdict */}
            <View style={[styles.verdictCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={[styles.verdictAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.verdictHeader}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.verdictTitle, { color: colors.primary }]}>The Verdict</Text>
              </View>
              <Text style={[styles.verdictBody, { color: colors.foreground }]}>{aiData.verdict}</Text>
              {aiData.valueComparison ? (
                <View style={[styles.verdictDivider, { borderTopColor: colors.borderSubtle }]}>
                  <Text style={[styles.verdictValue, { color: colors.textSecondary }]}>
                    {aiData.valueComparison}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Practical Details (collapsible) */}
            {metaA && metaB && travelA && travelB && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.sectionToggle}
                  onPress={() => toggleSection('practical')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sectionToggleText, { color: colors.textSecondary }]}>
                    Practical Details
                  </Text>
                  <ChevronDown
                    size={16}
                    color={colors.textMuted}
                    style={{
                      transform: [{ rotate: expandedSections.has('practical') ? '180deg' : '0deg' }],
                    }}
                  />
                </TouchableOpacity>
                {expandedSections.has('practical') && (
                  <View style={styles.detailsGrid}>
                    {[
                      { label: 'Capital', a: metaA.capital, b: metaB.capital },
                      { label: 'Currency', a: `${metaA.currencyCode}`, b: `${metaB.currencyCode}` },
                      { label: 'Language', a: metaA.language, b: metaB.language },
                      { label: 'Timezone', a: metaA.timezone, b: metaB.timezone },
                      { label: 'Region', a: metaA.region, b: metaB.region },
                      { label: 'Budget', a: travelA.dailyBudget, b: travelB.dailyBudget },
                      { label: 'Best Time', a: travelA.bestTimeNote, b: travelB.bestTimeNote },
                    ].map((row, i) => (
                      <View key={i} style={[styles.detailRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}>
                        <Text style={[styles.detailVal, { color: colors.foreground, textAlign: 'right' }]} numberOfLines={2}>
                          {row.a}
                        </Text>
                        <View style={styles.detailLabelBox}>
                          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{row.label}</Text>
                        </View>
                        <Text style={[styles.detailVal, { color: colors.foreground }]} numberOfLines={2}>
                          {row.b}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
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
    paddingHorizontal: Spacing.lg,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    marginBottom: Spacing.xl,
  },

  // Selectors
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  selectorBtn: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    minHeight: 72,
  },
  selectorLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs + 2,
  },
  selectorSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectorFlag: {
    fontSize: 20,
  },
  selectorName: {
    fontFamily: FontFamily.serifSemibold,
    fontSize: FontSize.base,
    flex: 1,
  },
  selectorPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorPlaceholder: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
  },
  swapBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },

  // Empty state
  emptyCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Loading
  loadingCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  skeletonBar: {
    height: 8,
    borderRadius: 4,
  },
  skeletonDot: {
    width: 30,
    height: 10,
    borderRadius: 5,
  },

  // Error
  errorCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // Results
  resultsContainer: {
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadows.card,
  },

  // Score bars
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  scoreHeaderName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.sm,
    flex: 1,
  },
  scoreHeaderLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.5,
    textAlign: 'center',
    width: 50,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
  },
  scoreBarSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  scoreBarSideB: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  barFillRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3.5,
  },
  barFillLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3.5,
  },
  scoreNum: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.xs,
    minWidth: 16,
    textAlign: 'center',
  },
  scoreLabelBox: {
    width: 60,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  scoreLabelEmoji: {
    fontSize: 10,
  },
  scoreLabelText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Hero cards
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heroFlag: {
    fontSize: 28,
    marginTop: 2,
  },
  heroName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    marginBottom: 2,
  },
  heroPitch: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  heroBestFor: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  heroBestForText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs + 2,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  highlightText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 18,
    flex: 1,
  },

  // Verdict
  verdictCard: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    padding: Spacing.md,
    overflow: 'hidden',
    ...Shadows.card,
  },
  verdictAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  verdictTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
  },
  verdictBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  verdictDivider: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  verdictValue: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // Practical Details
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  sectionToggleText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsGrid: {
    marginTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  detailVal: {
    flex: 1,
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  detailLabelBox: {
    width: 65,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  detailLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
  },
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    gap: Spacing.sm,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    paddingVertical: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  pickerFlag: {
    fontSize: 22,
  },
  pickerName: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    flex: 1,
  },
  pickerBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  pickerBadgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptySearch: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptySearchText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
  },
});

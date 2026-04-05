import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Sparkles, Globe, ChevronLeft, Plane } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { endpoints } from '@/constants/api';
import { visaData, resolveCountry, type HeldVisaType } from '@/data/visaData';
import { travelData } from '@/data/travelData';
import {
  getVisaCategoryColor, getVisaCategoryShortLabel, type VisaCategory,
} from '@/constants/categories';

// ── Constants ───────────────────────────────────────────────────────────
const VIBES = [
  { v: 'beach', l: 'Beach' },
  { v: 'culture', l: 'Culture' },
  { v: 'adventure', l: 'Adventure' },
  { v: 'nature', l: 'Nature' },
  { v: 'food', l: 'Food' },
  { v: 'photography', l: 'Photography' },
  { v: 'romantic', l: 'Romantic' },
  { v: 'nightlife', l: 'Nightlife' },
  { v: 'relaxation', l: 'Relaxation' },
];

const BUDGETS = [
  { v: 0, l: 'Any' },
  { v: 1, l: 'Budget' },
  { v: 2, l: 'Comfort' },
  { v: 3, l: 'Luxury' },
];

const FLIGHT_TIMES = [
  { v: 0, l: 'Any' },
  { v: 4, l: 'Under 4h' },
  { v: 6, l: '6h' },
  { v: 8, l: '8h' },
  { v: 12, l: '12h' },
  { v: 16, l: '16h+' },
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SEARCH_MSGS = [
  'Scanning 180+ countries...',
  'Matching your vibes...',
  'Checking visa requirements...',
  'Evaluating flight times...',
  'Comparing costs & seasons...',
  'Found something special...',
];

// ── Alpha-3 to Alpha-2 map (for flag emoji) ────────────────────────────
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

// Map data-layer category names (visa-free) to UI category keys (visa_free)
function normalizeCategoryKey(category: string): VisaCategory {
  switch (category) {
    case 'visa-free': return 'visa_free';
    case 'visa-on-arrival': return 'visa_on_arrival';
    case 'evisa': return 'e_visa';
    case 'visa-required': return 'visa_required';
    default: return 'visa_required';
  }
}

// ── Types ───────────────────────────────────────────────────────────────
type Step = 'vibes' | 'prefs' | 'searching' | 'reveal';

export interface SurpriseMeSheetProps {
  heldVisas: Set<HeldVisaType>;
  onCountrySelected: (code: string) => void;
}

export interface SurpriseMeSheetRef {
  present: () => void;
  dismiss: () => void;
}

// ════════════════════════════════════════════════════════════════════════
// useGlobeAnimation
// ════════════════════════════════════════════════════════════════════════
function useGlobeAnimation(isActive: boolean) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      translateY.value = withTiming(0, { duration: 300 });
      rotate.value = withTiming(0, { duration: 300 });
    }
  }, [isActive, translateY, rotate]);

  return useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));
}

// ════════════════════════════════════════════════════════════════════════
// TypingDots
// ════════════════════════════════════════════════════════════════════════
function TypingDots({ color }: { color: string }) {
  const dot1 = useSharedValue(0.4);
  const dot2 = useSharedValue(0.4);
  const dot3 = useSharedValue(0.4);

  useEffect(() => {
    const anim = (sv: { value: number }, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: delay }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    };
    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scale: dot1.value }], opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scale: dot2.value }], opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scale: dot3.value }], opacity: dot3.value }));

  const dotStyle = { width: 6, height: 6, borderRadius: 3, backgroundColor: color };

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.lg }}>
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
      <Animated.View style={[dotStyle, s3]} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SurpriseMeSheet
// ════════════════════════════════════════════════════════════════════════
const SurpriseMeSheet = forwardRef<SurpriseMeSheetRef, SurpriseMeSheetProps>(
  ({ heldVisas, onCountrySelected }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // ── Step state ──────────────────────────────────────────────────
    const [step, setStep] = useState<Step>('vibes');
    const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());
    const [budget, setBudget] = useState(0);
    const [maxFlight, setMaxFlight] = useState(0);
    const [travelMonth, setTravelMonth] = useState(0); // 0 = any, 1-12 = month
    const [includeVisaReq, setIncludeVisaReq] = useState(false);
    const [error, setError] = useState('');
    const [tick, setTick] = useState(0);
    const [result, setResult] = useState<{ code: string; reason: string } | null>(null);

    const globeStyle = useGlobeAnimation(step === 'searching');

    // ── Loading timer ───────────────────────────────────────────────
    useEffect(() => {
      if (step !== 'searching') { setTick(0); return; }
      const id = setInterval(() => setTick((t) => t + 1), 3000);
      return () => clearInterval(id);
    }, [step]);

    // ── Toggle vibe chip ────────────────────────────────────────────
    const toggleVibe = useCallback((v: string) => {
      setSelectedVibes((prev) => {
        const n = new Set(prev);
        if (n.has(v)) {
          n.delete(v);
        } else if (n.size < 3) {
          n.add(v);
        }
        return n;
      });
    }, []);

    // ── Reset state on open ─────────────────────────────────────────
    const resetState = useCallback(() => {
      setStep('vibes');
      setSelectedVibes(new Set());
      setBudget(0);
      setMaxFlight(0);
      setTravelMonth(0);
      setIncludeVisaReq(false);
      setError('');
      setTick(0);
      setResult(null);
    }, []);

    // ── Imperative handle for parent ────────────────────────────────
    useImperativeHandle(ref, () => ({
      present: () => {
        resetState();
        bottomSheetRef.current?.present();
      },
      dismiss: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Search API call ─────────────────────────────────────────────
    const search = useCallback(async () => {
      setStep('searching');
      setError('');
      setResult(null);
      try {
        const res = await fetch(endpoints.surprise, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vibes: [...selectedVibes],
            maxFlightHours: maxFlight,
            maxBudget: budget,
            month: travelMonth,
            heldVisas: [...heldVisas],
            visited: [],
            includeVisaRequired: includeVisaReq,
            duration: 7,
          }),
        });
        if (!res.ok) throw new Error('Search failed');
        const data: { pick: string; reason: string } = await res.json();
        setResult({ code: data.pick, reason: data.reason });
        setStep('reveal');
      } catch {
        setError('Something went wrong. Please try again.');
        setStep('prefs');
      }
    }, [selectedVibes, maxFlight, budget, travelMonth, heldVisas, includeVisaReq]);

    // ── Backdrop ────────────────────────────────────────────────────
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    // ── Derived data for reveal step ────────────────────────────────
    const revealData = useMemo(() => {
      if (!result) return null;
      const country = visaData.find((c) => c.code === result.code);
      if (!country) return null;
      const resolved = resolveCountry(country, heldVisas);
      const catKey = normalizeCategoryKey(resolved.category);
      const travel = travelData[result.code];
      return {
        name: country.name,
        flag: getFlag(result.code),
        category: catKey,
        flightHours: travel?.flightHoursFromLondon,
        costLevel: travel?.costLevel,
        reason: result.reason,
      };
    }, [result, heldVisas]);

    const s = useMemo(() => makeStyles(colors), [colors]);

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        maxDynamicContentSize={Dimensions.get('window').height - insets.top - 10}
        enablePanDownToClose={step !== 'searching'}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: 28 }}
        onChange={(index) => {
          if (index === -1) resetState();
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── STEP 1: Vibes ──────────────────────────────────── */}
          {step === 'vibes' && (
            <View>
              <Text style={[s.title, { color: colors.foreground }]}>
                What kind of trip?
              </Text>
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                Pick 1-3 vibes that excite you
              </Text>

              <View style={s.chipWrap}>
                {VIBES.map(({ v, l }) => {
                  const active = selectedVibes.has(v);
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => toggleVibe(v)}
                      activeOpacity={0.7}
                      style={[
                        s.chip,
                        {
                          backgroundColor: active ? colors.accent : colors.card,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text style={[
                        s.chipText,
                        { color: active ? '#FFFFFF' : colors.foreground },
                      ]}>
                        {l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={() => { if (selectedVibes.size >= 1) setStep('prefs'); }}
                disabled={selectedVibes.size < 1}
                activeOpacity={0.7}
                style={[
                  s.nextBtn,
                  {
                    backgroundColor: selectedVibes.size >= 1 ? colors.primary : colors.surfaceLight,
                    opacity: selectedVibes.size >= 1 ? 1 : 0.5,
                    ...(selectedVibes.size >= 1 ? Shadows.glow(colors.primary, 0.25) : {}),
                  },
                ]}
              >
                <Text style={[
                  s.nextBtnText,
                  { color: selectedVibes.size >= 1 ? '#FFFFFF' : colors.textMuted },
                ]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Preferences ──────────────────────────── */}
          {step === 'prefs' && (
            <View>
              <TouchableOpacity
                onPress={() => setStep('vibes')}
                style={s.backBtn}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <ChevronLeft size={18} color={colors.textSecondary} />
                <Text style={[s.backBtnText, { color: colors.textSecondary }]}>Back</Text>
              </TouchableOpacity>

              <Text style={[s.title, { color: colors.foreground }]}>
                Set your limits
              </Text>
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                We'll find destinations that match
              </Text>

              {/* Budget */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  BUDGET
                </Text>
                <View style={s.optionRow}>
                  {BUDGETS.map(({ v, l }) => {
                    const active = budget === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setBudget(v)}
                        activeOpacity={0.7}
                        style={[
                          s.optionPill,
                          {
                            backgroundColor: active ? colors.accent : 'transparent',
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.optionText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                          {l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Max Flight Time */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  MAX FLIGHT TIME
                </Text>
                <View style={s.flightRow}>
                  {FLIGHT_TIMES.map(({ v, l }) => {
                    const active = maxFlight === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setMaxFlight(v)}
                        activeOpacity={0.7}
                        style={[
                          s.flightPill,
                          {
                            backgroundColor: active ? colors.accent : 'transparent',
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.optionText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                          {l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Travel Month */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  TRAVEL MONTH
                </Text>
                <TouchableOpacity
                  onPress={() => setTravelMonth(0)}
                  activeOpacity={0.7}
                  style={[
                    s.anyMonthPill,
                    {
                      backgroundColor: travelMonth === 0 ? colors.accent : 'transparent',
                      borderColor: travelMonth === 0 ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[
                    s.optionText,
                    { color: travelMonth === 0 ? '#FFFFFF' : colors.textSecondary },
                  ]}>
                    Any month
                  </Text>
                </TouchableOpacity>
                {travelMonth === 0 ? null : null}
                <View style={s.monthGrid}>
                  {MONTHS_SHORT.map((m, i) => {
                    const monthNum = i + 1;
                    const active = travelMonth === monthNum;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setTravelMonth(monthNum)}
                        activeOpacity={0.7}
                        style={[
                          s.monthPill,
                          {
                            backgroundColor: active ? colors.accent : 'transparent',
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.monthText,
                          { color: active ? '#FFFFFF' : colors.foreground },
                        ]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Visa-required toggle */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  VISA-REQUIRED
                </Text>
                <TouchableOpacity
                  onPress={() => setIncludeVisaReq((prev) => !prev)}
                  activeOpacity={0.7}
                  style={s.toggleRow}
                >
                  <Text style={[s.toggleLabel, { color: colors.foreground }]}>
                    Include visa-required countries
                  </Text>
                  <View style={[
                    s.togglePill,
                    {
                      backgroundColor: includeVisaReq ? colors.accent : colors.surfaceLight,
                    },
                  ]}>
                    <Text style={[
                      s.togglePillText,
                      { color: includeVisaReq ? '#FFFFFF' : colors.textMuted },
                    ]}>
                      {includeVisaReq ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Error */}
              {error !== '' && (
                <View style={[s.errorCard, {
                  borderColor: colors.danger + '30',
                  backgroundColor: colors.dangerBg,
                }]}>
                  <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => setError('')}
                    style={[s.errorDismiss, { borderColor: colors.danger + '40' }]}
                  >
                    <Text style={[s.errorDismissText, { color: colors.danger }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Find My Destination button */}
              <TouchableOpacity
                onPress={search}
                activeOpacity={0.7}
                style={[
                  s.generateBtn,
                  {
                    backgroundColor: colors.primary,
                    ...Shadows.glow(colors.primary, 0.3),
                  },
                ]}
              >
                <Sparkles size={20} color="#FFFFFF" />
                <Text style={s.generateBtnText}>
                  Find My Destination
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 3: Searching ────────────────────────────── */}
          {step === 'searching' && (
            <View style={s.loadingContainer}>
              <Animated.View style={[s.iconCircle, { backgroundColor: colors.primaryBg }, globeStyle]}>
                <Globe size={32} color={colors.primary} />
              </Animated.View>

              <Text style={[s.loadingContext, { color: colors.textSecondary }]}>
                Finding your perfect match...
              </Text>

              <Animated.Text
                key={tick}
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(200)}
                style={[s.loadingMsg, { color: colors.foreground }]}
              >
                {SEARCH_MSGS[tick % SEARCH_MSGS.length]}
              </Animated.Text>

              <TypingDots color={colors.primary} />
            </View>
          )}

          {/* ── STEP 4: Reveal ───────────────────────────────── */}
          {step === 'reveal' && result && revealData && (
            <View style={s.revealContainer}>
              {/* Flag */}
              <Text style={s.revealFlag}>{revealData.flag}</Text>

              {/* Country name */}
              <Text style={[s.revealName, { color: colors.foreground }]}>
                {revealData.name}
              </Text>

              {/* AI reason */}
              <Text style={[s.revealReason, { color: colors.textSecondary }]}>
                {revealData.reason}
              </Text>

              {/* Quick facts row */}
              <View style={s.factsRow}>
                {/* Visa badge */}
                <View style={[s.factBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[
                    s.factDot,
                    { backgroundColor: getVisaCategoryColor(revealData.category, colors) },
                  ]} />
                  <Text style={[s.factText, { color: colors.foreground }]}>
                    {getVisaCategoryShortLabel(revealData.category)}
                  </Text>
                </View>

                {/* Flight time */}
                {revealData.flightHours != null && (
                  <View style={[s.factBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Plane size={14} color={colors.textSecondary} />
                    <Text style={[s.factText, { color: colors.foreground }]}>
                      {revealData.flightHours}h
                    </Text>
                  </View>
                )}

                {/* Cost level */}
                {revealData.costLevel != null && (
                  <View style={[s.factBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[s.factText, { color: colors.foreground }]}>
                      {'$'.repeat(revealData.costLevel)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Plan Trip button */}
              <TouchableOpacity
                onPress={() => {
                  bottomSheetRef.current?.dismiss();
                  onCountrySelected(result.code);
                }}
                activeOpacity={0.7}
                style={[
                  s.primaryBtn,
                  {
                    backgroundColor: colors.primary,
                    ...Shadows.glow(colors.primary, 0.25),
                  },
                ]}
              >
                <Text style={s.primaryBtnText}>Plan Trip</Text>
              </TouchableOpacity>

              {/* Different Place button */}
              <TouchableOpacity
                onPress={search}
                activeOpacity={0.7}
                style={[s.secondaryBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>
                  Different Place
                </Text>
              </TouchableOpacity>

              {/* Change Filters link */}
              <TouchableOpacity
                onPress={() => setStep('vibes')}
                activeOpacity={0.7}
                style={s.textLink}
              >
                <Text style={[s.textLinkText, { color: colors.textSecondary }]}>
                  Change Filters
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

SurpriseMeSheet.displayName = 'SurpriseMeSheet';
export default SurpriseMeSheet;

// ── Styles ──────────────────────────────────────────────────────────────
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // ── Common headers ───────────────────────────────────────
    title: {
      fontFamily: FontFamily.display,
      fontSize: FontSize['3xl'],
      letterSpacing: 0.5,
    },
    subtitle: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      marginTop: 2,
      marginBottom: Spacing.lg,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: Spacing.xs,
    },
    backBtnText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
    },

    // ── Step 1: Vibes ────────────────────────────────────────
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    chip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
    },
    chipText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },
    nextBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 20,
    },
    nextBtnText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      letterSpacing: 0.5,
    },

    // ── Step 2: Preferences ──────────────────────────────────
    sectionCard: {
      borderRadius: 20,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      ...Shadows.subtle,
    },
    sectionLabel: {
      fontFamily: FontFamily.condensedSemibold,
      fontSize: FontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    optionRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    optionPill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
    },
    optionText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },
    flightRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    flightPill: {
      paddingVertical: 10,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
    },
    anyMonthPill: {
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
      marginBottom: Spacing.sm,
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    monthPill: {
      width: '22%' as unknown as number,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
    },
    monthText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabel: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      flex: 1,
    },
    togglePill: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.full,
      marginLeft: Spacing.sm,
    },
    togglePillText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
    },

    // ── Error ────────────────────────────────────────────────
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1,
      marginBottom: Spacing.sm,
    },
    errorText: {
      flex: 1,
      fontFamily: FontFamily.regular,
      fontSize: FontSize.xs,
    },
    errorDismiss: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radius.xs,
      borderWidth: 1,
      marginLeft: Spacing.sm,
    },
    errorDismissText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
    },

    // ── Generate button ──────────────────────────────────────
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 16,
      borderRadius: 20,
      marginTop: Spacing.md,
    },
    generateBtnText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },

    // ── Loading ──────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['5xl'],
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    loadingContext: {
      fontFamily: FontFamily.serif,
      fontSize: FontSize.sm,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    loadingMsg: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.base,
      textAlign: 'center',
      minHeight: 20,
    },

    // ── Reveal ───────────────────────────────────────────────
    revealContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
    },
    revealFlag: {
      fontSize: 48,
      marginBottom: Spacing.md,
    },
    revealName: {
      fontFamily: FontFamily.display,
      fontSize: FontSize['3xl'],
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    revealReason: {
      fontFamily: FontFamily.serif,
      fontSize: FontSize.sm,
      textAlign: 'center',
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.md,
      lineHeight: 20,
    },
    factsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    factBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    factDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    factText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
    },
    primaryBtn: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 20,
      marginBottom: Spacing.sm,
    },
    primaryBtnText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    secondaryBtn: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1.5,
      marginBottom: Spacing.sm,
    },
    secondaryBtnText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      letterSpacing: 0.5,
    },
    textLink: {
      paddingVertical: Spacing.sm,
    },
    textLinkText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
      textDecorationLine: 'underline',
    },
  });

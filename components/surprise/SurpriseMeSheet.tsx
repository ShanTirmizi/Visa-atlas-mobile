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
  withSpring,
  withTiming,
  interpolateColor,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { endpoints } from '@/constants/api';
import { resolveCountry, type HeldVisaType } from '@/data/visaData';
import { useVisaData } from '@/contexts/visa-context';
import { travelData } from '@/data/travelData';
import { getFlightHours } from '@/utils/flightTime';
import {
  getVisaCategoryColor, getVisaCategoryShortLabel, type VisaCategory,
} from '@/constants/categories';
import { TypingDots } from '@/components/ui/TypingDots';
import { toAlpha2 } from '@/utils/countryCode';

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

// ── Alpha-3 to flag emoji ───────────────────────────────────────────────
function getFlag(alpha3: string): string {
  const a2 = toAlpha2(alpha3);
  if (!a2 || a2.length !== 2) return '';
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
// AnimatedSwitch — iOS-style toggle. Spring-driven thumb slide + cross-fading
// track between line-mid (off) and teal (on). 24px thumb, 50px track.
// ════════════════════════════════════════════════════════════════════════
const SWITCH_W = 50;
const SWITCH_H = 30;
const THUMB_SIZE = 24;
const THUMB_INSET = 3;

function AnimatedSwitch({ value }: { value: boolean }) {
  const { colors } = useTheme();
  // 0 = off, 1 = on. Drives both the thumb position and the track color.
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 240,
      mass: 0.7,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.lineMid, colors.teal],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          progress.value * (SWITCH_W - THUMB_SIZE - THUMB_INSET * 2),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          width: SWITCH_W,
          height: SWITCH_H,
          borderRadius: SWITCH_H / 2,
          padding: THUMB_INSET,
          justifyContent: 'center',
        },
        trackStyle,
      ]}
    >
      <Animated.View
        style={[
          {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 4,
            elevation: 3,
          },
          thumbStyle,
        ]}
      />
    </Animated.View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SurpriseMeSheet
// ════════════════════════════════════════════════════════════════════════
const SurpriseMeSheet = forwardRef<SurpriseMeSheetRef, SurpriseMeSheetProps>(
  ({ heldVisas, onCountrySelected }, ref) => {
    const { colors } = useTheme();
    const { residence, passports } = useVisa();
    const dynamicVisaData = useVisaData();
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
            passports,
            residence,
          }),
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        // API returns { pick: { code, name, ... } | null, reason: string }
        const pickCode = typeof data.pick === 'string' ? data.pick : data.pick?.code;
        if (!pickCode) throw new Error('No destination found');
        setResult({ code: pickCode, reason: data.reason || '' });
        setStep('reveal');
      } catch {
        setError('Something went wrong. Please try again.');
        setStep('prefs');
      }
    }, [selectedVibes, maxFlight, budget, travelMonth, heldVisas, includeVisaReq, passports, residence]);

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
      const country = dynamicVisaData.find((c) => c.code === result.code);
      if (!country) return null;
      const resolved = resolveCountry(country, heldVisas);
      const catKey = normalizeCategoryKey(resolved.category);
      const travel = travelData[result.code];
      return {
        name: country.name,
        flag: getFlag(result.code),
        category: catKey,
        flightHours: getFlightHours(residence ?? 'GBR', result.code) ?? travel?.flightHoursFromLondon,
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
        // maxDynamicContentSize caps HEIGHT only; topInset is the prop that
        // clamps the sheet's POSITION below the Dynamic Island — see the
        // overshoot writeup in TripPlannerSheet.tsx (canonical config).
        topInset={insets.top + 10}
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
                    backgroundColor: selectedVibes.size >= 1 ? colors.primary : colors.surfaceMuted,
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
                We’ll find destinations that match
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

              {/* Visa-required — animated iOS-style switch */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  VISA-REQUIRED
                </Text>
                <TouchableOpacity
                  onPress={() => setIncludeVisaReq((prev) => !prev)}
                  activeOpacity={0.85}
                  style={s.toggleRow}
                >
                  <Text style={[s.toggleLabel, { color: colors.foreground }]}>
                    Include visa-required countries
                  </Text>
                  <AnimatedSwitch value={includeVisaReq} />
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

              <View style={{ marginTop: Spacing.lg }}>
                <TypingDots color={colors.primary} gap={8} />
              </View>
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
      width: '22%',
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

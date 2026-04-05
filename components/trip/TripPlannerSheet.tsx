import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
} from 'react-native';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Plane } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { endpoints } from '@/constants/api';
import type { CountryVisa, HeldVisaType, VisaCategory } from '@/data/visaData';
import type { CountryMeta } from '@/data/countryMeta';
import type { TravelInfo } from '@/data/travelData';

// ── Constants ───────────────────────────────────────────────────────────
const DURATIONS = [3, 5, 7, 10, 14];
const DURATION_COLORS = ['#2AAAA0', '#2EAA6E', '#EB6D3A', '#E5A832', '#D95E8A'];

const VIBES = [
  { v: 'relaxed', l: 'Relaxed' },
  { v: 'balanced', l: 'Balanced' },
  { v: 'packed', l: 'Action-packed' },
];
const BUDGETS = [
  { v: 'budget', l: 'Backpacker' },
  { v: 'mid', l: 'Comfort' },
  { v: 'luxury', l: 'Luxury' },
];
const COMPANIONS = [
  { v: 'solo', l: 'Solo' },
  { v: 'partner', l: 'Partner' },
  { v: 'friends', l: 'Friends' },
  { v: 'family', l: 'Family' },
];
const ACTIVITIES = [
  'Hidden gems', 'Thrill-seeking', 'Foodie', 'Romantic', 'Photography',
  'Nightlife', 'Wellness', 'History', 'Nature walks', 'Shopping',
];
const LOAD_MSGS = [
  'Researching your destination...', 'Planning your day-by-day itinerary...',
  'Finding the best local spots...', 'Scouting hidden gems & restaurants...',
  'Calculating budget breakdown...', 'Checking visa requirements...',
  'Packing your suitcase (virtually)...', 'Scouting car rental options...',
  'Finding the best time to visit...', 'Adding final touches...',
];

// ── Vibrant color palette for option buttons ────────────────────────────
const PACE_COLOR = '#2AAAA0';   // teal
const BUDGET_COLOR = '#2EAA6E'; // green
const PARTY_COLOR = '#EB6D3A';  // orange
const CHIP_COLOR = '#E5A832';   // amber

// ── Types ───────────────────────────────────────────────────────────────
type ResolvedCountry = {
  category: VisaCategory;
  days?: number;
  notes?: string;
  upgradedBy?: HeldVisaType[];
};

export interface TripPlannerSheetProps {
  country: CountryVisa;
  meta: CountryMeta | null;
  travel: TravelInfo | null;
  resolved: ResolvedCountry;
  heldVisas: Set<HeldVisaType>;
  onTripCreated: (tripId: string) => void;
}

export interface TripPlannerSheetRef {
  present: () => void;
  dismiss: () => void;
}

// ════════════════════════════════════════════════════════════════════════
// TripPlannerSheet
// ════════════════════════════════════════════════════════════════════════
const TripPlannerSheet = forwardRef<TripPlannerSheetRef, TripPlannerSheetProps>(
  ({ country, meta, travel, resolved, heldVisas, onTripCreated }, ref) => {
    const { colors } = useTheme();
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // ── Step state ──────────────────────────────────────────────────
    const [step, setStep] = useState<'duration' | 'prefs' | 'loading'>('duration');
    const [days, setDays] = useState<number | null>(null);
    const [customDays, setCustomDays] = useState('');
    const [vibe, setVibe] = useState('relaxed');
    const [budget, setBudget] = useState('mid');
    const [interests, setInterests] = useState('culture, food, sightseeing');
    const [party, setParty] = useState('solo');
    const [activityStyles, setActivityStyles] = useState<Set<string>>(new Set());
    const [error, setError] = useState('');
    const [tick, setTick] = useState(0);

    const createTrip = useMutation(api.trips.createTrip);

    // ── Snap points change with step ────────────────────────────────
    const snapPoints = useMemo(
      () => step === 'duration' ? ['85%'] : ['92%'],
      [step],
    );

    // ── Loading timer ───────────────────────────────────────────────
    useEffect(() => {
      if (step !== 'loading') { setTick(0); return; }
      const id = setInterval(() => setTick((t) => t + 1), 3000);
      return () => clearInterval(id);
    }, [step]);

    // ── Toggle activity chip ────────────────────────────────────────
    const toggleStyle = useCallback((s: string) => {
      setActivityStyles((prev) => {
        const n = new Set(prev);
        n.has(s) ? n.delete(s) : n.add(s);
        return n;
      });
    }, []);

    // ── Reset state on open ─────────────────────────────────────────
    const resetState = useCallback(() => {
      setStep('duration');
      setDays(null);
      setCustomDays('');
      setVibe('relaxed');
      setBudget('mid');
      setInterests('culture, food, sightseeing');
      setParty('solo');
      setActivityStyles(new Set());
      setError('');
      setTick(0);
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

    // ── Generate trip ───────────────────────────────────────────────
    const generate = useCallback(async () => {
      if (!country || !days || !meta || !travel || !resolved) return;
      setStep('loading');
      setError('');
      try {
        const res = await fetch(endpoints.generateTrip, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countryCode: country.code,
            duration: days,
            heldVisas: [...heldVisas],
            vibe,
            budget,
            interests,
            activityStyles: [...activityStyles],
            travelParty: party,
          }),
        });
        if (!res.ok) throw new Error('fail');
        const data = await res.json();
        const tripId = await createTrip({
          ...data,
          status: 'planned' as const,
          companions: party !== 'solo' ? JSON.stringify({ party }) : undefined,
        });
        setTimeout(() => {
          bottomSheetRef.current?.dismiss();
          onTripCreated(String(tripId));
        }, 300);
      } catch {
        setError('Failed to generate trip. Please try again.');
        setStep('prefs');
      }
    }, [country, days, meta, travel, resolved, heldVisas, vibe, budget, interests, activityStyles, party, createTrip, onTripCreated]);

    // ── Backdrop ────────────────────────────────────────────────────
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    const s = useMemo(() => makeStyles(colors), [colors]);

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={step !== 'loading'}
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
          {/* ── STEP 1: Duration ──────────────────────────────────── */}
          {step === 'duration' && (
            <View>
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>
                How long?
              </Text>
              <Text style={[s.sheetSubtitle, { color: colors.textSecondary }]}>
                Pick your trip duration to get started
              </Text>

              {/* Duration presets */}
              <View style={s.durationGrid}>
                {DURATIONS.map((d, i) => {
                  const active = days === d;
                  const pillColor = DURATION_COLORS[i];
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDays(d)}
                      activeOpacity={0.7}
                      style={[
                        s.durationPill,
                        {
                          backgroundColor: active ? pillColor : colors.card,
                          borderColor: active ? pillColor : colors.border,
                          ...(!active ? Shadows.subtle : Shadows.glow(pillColor, 0.3)),
                        },
                      ]}
                    >
                      <Text style={[
                        s.durationNumber,
                        { color: active ? '#FFFFFF' : colors.foreground },
                      ]}>
                        {d}
                      </Text>
                      <Text style={[
                        s.durationLabel,
                        { color: active ? 'rgba(255,255,255,0.85)' : colors.textMuted },
                      ]}>
                        days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom input */}
              <View style={[s.customRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[s.customLabel, { color: colors.textSecondary }]}>
                  Or custom:
                </Text>
                <TextInput
                  style={[s.customInput, {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                  }]}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="Days"
                  placeholderTextColor={colors.textMuted}
                  value={customDays}
                  onChangeText={(t) => {
                    setCustomDays(t);
                    const n = parseInt(t);
                    if (n > 0 && n <= 30) setDays(n);
                    else if (t === '') setDays(null);
                  }}
                />
              </View>

              {/* Next button */}
              <TouchableOpacity
                onPress={() => { if (days && days > 0) setStep('prefs'); }}
                disabled={!days}
                activeOpacity={0.7}
                style={[
                  s.nextBtn,
                  {
                    backgroundColor: days ? colors.primary : colors.shimmer,
                    opacity: days ? 1 : 0.5,
                    ...(days ? Shadows.glow(colors.primary, 0.25) : {}),
                  },
                ]}
              >
                <Text style={[s.nextBtnText, { color: days ? '#FFFFFF' : colors.textMuted }]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STEP 2: Preferences ──────────────────────────────── */}
          {step === 'prefs' && (
            <View>
              <View style={s.prefsHeader}>
                <Text style={[s.sheetTitle, { color: colors.foreground }]}>
                  Customize your trip
                </Text>
                <TouchableOpacity onPress={() => setStep('duration')}>
                  <Text style={[s.changeLink, { color: colors.primary }]}>
                    Change ({days}d)
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[s.sheetSubtitle, { color: colors.textSecondary }]}>
                Tell us how you like to travel
              </Text>

              {/* Trip Pace */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  TRIP PACE
                </Text>
                <View style={s.optionRow}>
                  {VIBES.map((o) => {
                    const active = vibe === o.v;
                    return (
                      <TouchableOpacity
                        key={o.v}
                        onPress={() => setVibe(o.v)}
                        activeOpacity={0.7}
                        style={[
                          s.optionPill,
                          {
                            backgroundColor: active ? PACE_COLOR : 'transparent',
                            borderColor: active ? PACE_COLOR : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.optionText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                          {o.l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Budget Style */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  BUDGET STYLE
                </Text>
                <View style={s.optionRow}>
                  {BUDGETS.map((o) => {
                    const active = budget === o.v;
                    return (
                      <TouchableOpacity
                        key={o.v}
                        onPress={() => setBudget(o.v)}
                        activeOpacity={0.7}
                        style={[
                          s.optionPill,
                          {
                            backgroundColor: active ? BUDGET_COLOR : 'transparent',
                            borderColor: active ? BUDGET_COLOR : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.optionText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                          {o.l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Interests */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  INTERESTS
                </Text>
                <TextInput
                  style={[s.interestsInput, {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                  }]}
                  value={interests}
                  onChangeText={setInterests}
                  placeholder="e.g. food, history, hiking"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Activity Style chips */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  ACTIVITY STYLE
                </Text>
                <View style={s.chipWrap}>
                  {ACTIVITIES.map((a) => {
                    const active = activityStyles.has(a);
                    return (
                      <TouchableOpacity
                        key={a}
                        onPress={() => toggleStyle(a)}
                        activeOpacity={0.7}
                        style={[
                          s.chip,
                          {
                            backgroundColor: active ? CHIP_COLOR : 'transparent',
                            borderColor: active ? CHIP_COLOR : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.chipText,
                          { color: active ? '#FFFFFF' : colors.textMuted },
                        ]}>
                          {a}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Traveling with */}
              <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  TRAVELING WITH
                </Text>
                <View style={s.optionRow}>
                  {COMPANIONS.map((o) => {
                    const active = party === o.v;
                    return (
                      <TouchableOpacity
                        key={o.v}
                        onPress={() => setParty(o.v)}
                        activeOpacity={0.7}
                        style={[
                          s.optionPill,
                          {
                            backgroundColor: active ? PARTY_COLOR : 'transparent',
                            borderColor: active ? PARTY_COLOR : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.optionText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                          {o.l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Error */}
              {error !== '' && (
                <View style={[s.errorCard, {
                  borderColor: colors.danger + '30',
                  backgroundColor: colors.dangerBg,
                }]}>
                  <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => { setError(''); }}
                    style={[s.errorRetry, { borderColor: colors.danger + '40' }]}
                  >
                    <Text style={[s.errorRetryText, { color: colors.danger }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Generate button */}
              <TouchableOpacity
                onPress={generate}
                activeOpacity={0.7}
                style={[
                  s.generateBtn,
                  {
                    backgroundColor: colors.primary,
                    ...Shadows.glow(colors.primary, 0.3),
                  },
                ]}
              >
                <Plane size={20} color="#FFFFFF" />
                <Text style={s.generateBtnText}>
                  Generate {days}-Day Trip
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Loading ──────────────────────────────────────────── */}
          {step === 'loading' && (
            <View style={s.loadingContainer}>
              <Text style={[s.loadingMsg, { color: colors.foreground }]}>
                {LOAD_MSGS[tick % LOAD_MSGS.length]}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

TripPlannerSheet.displayName = 'TripPlannerSheet';
export default TripPlannerSheet;

// ── Styles ──────────────────────────────────────────────────────────────
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // ── Sheet headers ─────────────────────────────────────────
    sheetTitle: {
      fontFamily: FontFamily.display,
      fontSize: FontSize['3xl'],
      letterSpacing: 0.5,
    },
    sheetSubtitle: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      marginTop: 2,
      marginBottom: Spacing.lg,
    },

    // ── Step 1: Duration ──────────────────────────────────────
    durationGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    durationPill: {
      flex: 1,
      minWidth: '17%' as unknown as number,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.lg,
      borderRadius: 20,
      borderWidth: 1.5,
    },
    durationNumber: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize['2xl'],
    },
    durationLabel: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    customLabel: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },
    customInput: {
      width: 70,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      textAlign: 'center',
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

    // ── Step 2: Preferences ───────────────────────────────────
    prefsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    changeLink: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
      textDecorationLine: 'underline',
    },
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
    interestsInput: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1,
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1.5,
    },
    chipText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
    },

    // ── Error ─────────────────────────────────────────────────
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
    errorRetry: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radius.xs,
      borderWidth: 1,
      marginLeft: Spacing.sm,
    },
    errorRetryText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.xs,
    },

    // ── Generate button ───────────────────────────────────────
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

    // ── Loading ───────────────────────────────────────────────
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['5xl'],
    },
    loadingMsg: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.base,
      textAlign: 'center',
      minHeight: 20,
    },
  });

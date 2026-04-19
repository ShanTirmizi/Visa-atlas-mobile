import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
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
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { Type } from '@/constants/typography';
import { endpoints } from '@/constants/api';
import type { CountryVisa, HeldVisaType, VisaCategory } from '@/data/visaData';
import type { CountryMeta } from '@/data/countryMeta';
import type { TravelInfo } from '@/data/travelData';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { PillButton } from '@/components/ui/PillButton';

// ── Constants ───────────────────────────────────────────────────────────
const VIBES = [
  'Food', 'Culture', 'Nature', 'Nightlife', 'Adventure', 'Romance', 'Slow travel', 'History',
];

// Legacy option constants preserved for generate() payload compatibility
const PACE_OPTIONS = ['relaxed', 'balanced', 'packed'];
const BUDGET_OPTIONS = ['budget', 'mid', 'luxury'];
const COMPANION_OPTIONS = ['solo', 'partner', 'friends', 'family'];

const LOAD_MSGS = [
  'Researching your destination...', 'Planning your day-by-day itinerary...',
  'Finding the best local spots...', 'Scouting hidden gems & restaurants...',
  'Calculating budget breakdown...', 'Checking visa requirements...',
  'Packing your suitcase (virtually)...', 'Scouting car rental options...',
  'Finding the best time to visit...', 'Adding final touches...',
];

// Avatar tones for traveler stack — warm, forest, sunset palette
const AVATAR_TONES = ['#C4A882', '#6B8F71', '#C97B4B'] as const;

// Default dates: start = today + 30 days, end = today + 37 days (7-day trip)
function defaultDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
// usePlaneAnimation — preserved for loading state
// ════════════════════════════════════════════════════════════════════════
function usePlaneAnimation(isActive: boolean) {
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
// TypingDots — preserved for loading state
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
// AvatarStack — decorative traveler circles
// ════════════════════════════════════════════════════════════════════════
function AvatarStack({ count }: { count: number }) {
  const shown = Math.min(count, 3);
  return (
    <View style={{ flexDirection: 'row' }}>
      {AVATAR_TONES.slice(0, shown).map((tone, i) => (
        <View
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: tone,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            marginLeft: i === 0 ? 0 : -10,
          }}
        />
      ))}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TripPlannerSheet
// ════════════════════════════════════════════════════════════════════════
const TripPlannerSheet = forwardRef<TripPlannerSheetRef, TripPlannerSheetProps>(
  ({ country, meta, travel, resolved, heldVisas, onTripCreated }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    // ── Core state ──────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [tick, setTick] = useState(0);

    // ── Date state ──────────────────────────────────────────────
    const defaults = defaultDates();
    const [startDate, setStartDate] = useState<Date>(defaults.start);
    const [endDate, setEndDate] = useState<Date>(defaults.end);

    // ── Travelers state ─────────────────────────────────────────
    const [travelers, setTravelers] = useState(2);

    // ── Vibes state (spec-aligned 8-chip set) ───────────────────
    const [activeVibes, setActiveVibes] = useState<Set<string>>(new Set());

    // ── Legacy preference state (preserved for payload compat) ──
    const [vibe] = useState('balanced');
    const [budget] = useState('mid');
    const [party] = useState('couple');

    const createTrip = useMutation(api.trips.createTrip);
    const sparkleStyle = usePlaneAnimation(isLoading);

    // ── Days derived from dates ─────────────────────────────────
    const days = useMemo(() => {
      const diff = endDate.getTime() - startDate.getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    }, [startDate, endDate]);

    // ── Loading ticker ──────────────────────────────────────────
    useEffect(() => {
      if (!isLoading) { setTick(0); return; }
      const id = setInterval(() => setTick((t) => t + 1), 3000);
      return () => clearInterval(id);
    }, [isLoading]);

    // ── Toggle vibe chip ────────────────────────────────────────
    const toggleVibe = useCallback((v: string) => {
      setActiveVibes((prev) => {
        const n = new Set(prev);
        n.has(v) ? n.delete(v) : n.add(v);
        return n;
      });
    }, []);

    // ── Reset state on open ─────────────────────────────────────
    const resetState = useCallback(() => {
      const d = defaultDates();
      setStartDate(d.start);
      setEndDate(d.end);
      setTravelers(2);
      setActiveVibes(new Set());
      setIsLoading(false);
      setError('');
      setTick(0);
    }, []);

    // ── Imperative handle ───────────────────────────────────────
    useImperativeHandle(ref, () => ({
      present: () => {
        resetState();
        bottomSheetRef.current?.present();
      },
      dismiss: () => {
        bottomSheetRef.current?.dismiss();
      },
    }));

    // ── Adjust start date ───────────────────────────────────────
    const shiftStart = useCallback((delta: number) => {
      setStartDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + delta);
        // keep end at least 1 day after start
        setEndDate((e) => {
          if (next >= e) {
            const newEnd = new Date(next);
            newEnd.setDate(newEnd.getDate() + 1);
            return newEnd;
          }
          return e;
        });
        return next;
      });
    }, []);

    // ── Adjust end date ─────────────────────────────────────────
    const shiftEnd = useCallback((delta: number) => {
      setEndDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + delta);
        if (next <= startDate) return prev; // guard: end must be after start
        return next;
      });
    }, [startDate]);

    // ── Generate trip ───────────────────────────────────────────
    const generate = useCallback(async () => {
      if (!country || !meta || !travel || !resolved) return;
      setIsLoading(true);
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
            interests: [...activeVibes].join(', ') || 'culture, food, sightseeing',
            activityStyles: [...activeVibes],
            travelParty: travelers > 1 ? party : 'solo',
          }),
        });
        if (!res.ok) throw new Error('fail');
        const data = await res.json();

        // ── Fetch images (hero + per-day + per-activity) ─────────────────
        let heroImageJson: string | undefined;
        let dayImagesJson: string | undefined;
        let activityImagesJson: string | undefined;
        try {
          type ItineraryDay = {
            morningPlace?: string;
            afternoonPlace?: string;
            eveningPlace?: string;
            title?: string;
            heroSubject?: string;
          };
          const itineraryDays: ItineraryDay[] = data.itinerary
            ? (JSON.parse(data.itinerary) as ItineraryDay[])
            : [];
          const activities = itineraryDays.flatMap((d) => [
            d.morningPlace ? { name: 'morning', place: d.morningPlace } : null,
            d.afternoonPlace ? { name: 'afternoon', place: d.afternoonPlace } : null,
            d.eveningPlace ? { name: 'evening', place: d.eveningPlace } : null,
          ]).filter(Boolean);

          const dayHeroSubjects = itineraryDays.map(
            (d) =>
              d.heroSubject ??
              d.morningPlace ??
              d.afternoonPlace ??
              d.eveningPlace ??
              d.title ??
              '',
          );

          const imgRes = await fetch(endpoints.tripImages, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              countryName: data.countryName,
              capital: data.capital,
              activities,
              dayHeroSubjects,
            }),
          });
          if (imgRes.ok) {
            const imgData = await imgRes.json() as {
              hero: unknown;
              activities: unknown[];
              dayImages?: unknown[];
            };
            if (imgData.hero) heroImageJson = JSON.stringify(imgData.hero);
            if (imgData.activities?.length) activityImagesJson = JSON.stringify(imgData.activities);
            if (imgData.dayImages?.length) dayImagesJson = JSON.stringify(imgData.dayImages);
          }
        } catch {
          // Images are non-critical — proceed without them
        }

        const tripId = await createTrip({
          ...data,
          status: 'planned' as const,
          companions: travelers > 1 ? JSON.stringify({ party, count: travelers }) : undefined,
          heroImage: heroImageJson,
          dayImages: dayImagesJson,
          activityImages: activityImagesJson,
        });
        setTimeout(() => {
          bottomSheetRef.current?.dismiss();
          onTripCreated(String(tripId));
        }, 300);
      } catch {
        setError('Failed to generate trip. Please try again.');
        setIsLoading(false);
      }
    }, [
      country, meta, travel, resolved, heldVisas,
      days, vibe, budget, activeVibes, travelers, party,
      createTrip, onTripCreated,
    ]);

    // ── Backdrop ────────────────────────────────────────────────
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

    const s = useMemo(() => makeStyles(colors), [colors]);

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        maxDynamicContentSize={Dimensions.get('window').height - insets.top - 10}
        enablePanDownToClose={!isLoading}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: 28 }}
        onChange={(index) => {
          if (index === -1) resetState();
        }}
      >
        <BottomSheetScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── MAIN FORM ──────────────────────────────────────── */}
          {!isLoading && (
            <View>
              {/* Header row */}
              <View style={s.headerRow}>
                <DarkOrb size={38}>
                  <Sparkles size={17} color="#FFFFFF" />
                </DarkOrb>
                <View style={s.headerText}>
                  <SectionKicker>AI PLANNER</SectionKicker>
                  <Text style={[s.headerTitle, { color: colors.ink }]}>
                    {country.name ? `Plan a trip to ${country.name}` : 'Plan your next trip'}
                  </Text>
                </View>
              </View>

              {/* Date cards row */}
              <View style={s.dateRow}>
                {/* Start date card */}
                <View style={[s.dateCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>Start</Text>
                  <Text style={[s.dateCardValue, { color: colors.ink }]}>{formatDate(startDate)}</Text>
                  <View style={s.stepperRow}>
                    <TouchableOpacity
                      onPress={() => shiftStart(-1)}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => shiftStart(1)}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* End date card */}
                <View style={[s.dateCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>End</Text>
                  <Text style={[s.dateCardValue, { color: colors.ink }]}>{formatDate(endDate)}</Text>
                  <View style={s.stepperRow}>
                    <TouchableOpacity
                      onPress={() => shiftEnd(-1)}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => shiftEnd(1)}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Travelers card */}
              <View style={[s.travelersCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <View style={s.travelersLeft}>
                  <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>Travelers</Text>
                  <Text style={[s.dateCardValue, { color: colors.ink }]}>
                    {travelers} {travelers === 1 ? 'adult' : 'adults'}
                  </Text>
                </View>
                <View style={s.travelersRight}>
                  <AvatarStack count={travelers} />
                  <View style={s.travelerStepper}>
                    <TouchableOpacity
                      onPress={() => setTravelers((t) => Math.max(1, t - 1))}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setTravelers((t) => Math.min(12, t + 1))}
                      activeOpacity={0.7}
                      style={[s.stepBtn, { borderColor: colors.line }]}
                    >
                      <Text style={[s.stepBtnText, { color: colors.inkMute }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Vibes section */}
              <View style={s.vibesSection}>
                <SectionKicker style={{ marginBottom: 8 }}>Vibes</SectionKicker>
                <View style={s.chipWrap}>
                  {VIBES.map((v) => {
                    const active = activeVibes.has(v);
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => toggleVibe(v)}
                        activeOpacity={0.7}
                        style={[
                          s.vibeChip,
                          active
                            ? { backgroundColor: colors.ink, borderColor: colors.ink }
                            : { backgroundColor: colors.surface, borderColor: colors.line },
                        ]}
                      >
                        <Text style={[
                          s.vibeChipText,
                          { color: active ? '#FFFFFF' : colors.inkSoft },
                        ]}>
                          {v}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Error */}
              {error !== '' && (
                <View style={[s.errorCard, {
                  borderColor: colors.danger,
                  backgroundColor: colors.dangerBg,
                }]}>
                  <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => setError('')}
                    style={[s.errorRetry, { borderColor: colors.danger }]}
                  >
                    <Text style={[s.errorRetryText, { color: colors.danger }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Primary CTA */}
              <PillButton
                label="Generate itinerary"
                onPress={generate}
                variant="primary"
                fullWidth
                icon={<Sparkles size={16} color="#FFFFFF" />}
                style={s.ctaButton}
              />
            </View>
          )}

          {/* ── LOADING STATE ───────────────────────────────────── */}
          {isLoading && (
            <View style={s.loadingContainer}>
              {/* Animated sparkle orb */}
              <Animated.View style={sparkleStyle}>
                <DarkOrb size={80}>
                  <Sparkles size={32} color="#FFFFFF" />
                </DarkOrb>
              </Animated.View>

              {/* Country context */}
              <Text style={[s.loadingContext, { color: colors.inkMute }]}>
                Planning your trip to{' '}
                <Text style={{ fontFamily: FontFamily.semibold, color: colors.ink }}>
                  {country.name}
                </Text>
                ...
              </Text>

              {/* Rotating status message */}
              <Animated.Text
                key={tick}
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(200)}
                style={[s.loadingMsg, { color: colors.ink }]}
              >
                {LOAD_MSGS[tick % LOAD_MSGS.length]}
              </Animated.Text>

              {/* Typing dots */}
              <TypingDots color={colors.ink} />
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
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: 48,
    },

    // ── Header ────────────────────────────────────────────────
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      ...Type.title18,
      marginTop: 1,
    },

    // ── Date cards ────────────────────────────────────────────
    dateRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    dateCard: {
      flex: 1,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      ...Shadows.subtle,
    },
    dateCardLabel: {
      ...Type.meta10_5,
    },
    dateCardValue: {
      ...Type.title17,
      marginTop: 3,
    },
    stepperRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 10,
    },

    // ── Travelers card ────────────────────────────────────────
    travelersCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 10,
      ...Shadows.subtle,
    },
    travelersLeft: {
      gap: 3,
    },
    travelersRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    travelerStepper: {
      flexDirection: 'row',
      gap: 6,
    },

    // ── Shared stepper button ─────────────────────────────────
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.base,
      lineHeight: 20,
      includeFontPadding: false,
    },

    // ── Vibes ─────────────────────────────────────────────────
    vibesSection: {
      marginTop: 6,
      marginBottom: 0,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    vibeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    vibeChipText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },

    // ── Error ─────────────────────────────────────────────────
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.sm,
      borderWidth: 1,
      marginTop: 12,
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

    // ── CTA ───────────────────────────────────────────────────
    ctaButton: {
      marginTop: 18,
    },

    // ── Loading ───────────────────────────────────────────────
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing['5xl'],
    },
    loadingContext: {
      fontFamily: FontFamily.regular,
      fontSize: FontSize.sm,
      textAlign: 'center',
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    loadingMsg: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.base,
      textAlign: 'center',
      minHeight: 20,
    },
  });

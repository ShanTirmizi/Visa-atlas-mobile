import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, FlatList, TextInput,
} from 'react-native';
import { ChevronRight, Search, X } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { Type } from '@/constants/typography';
import { visaData, resolveCountry, type CountryVisa, type HeldVisaType, type VisaCategory } from '@/data/visaData';
import { countryMeta, type CountryMeta } from '@/data/countryMeta';
import { travelData, type TravelInfo } from '@/data/travelData';
import { Flag } from '@/components/ui/Flag';
import { Squiggle } from '@/components/ui/Squiggle';
import { AnimalAvatar, ANIMAL_KINDS } from '@/components/ui/AnimalAvatar';
import { toAlpha2 } from '@/utils/countryCode';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { SectionKicker } from '@/components/ui/SectionKicker';

// ── Constants ───────────────────────────────────────────────────────────
const VIBES = [
  'Food', 'Culture', 'Nature', 'Nightlife', 'Adventure', 'Romance', 'Slow travel', 'History',
];

// Legacy option constants preserved for generate() payload compatibility
const PACE_OPTIONS = ['relaxed', 'balanced', 'packed'];
const BUDGET_OPTIONS = ['budget', 'mid', 'luxury'];
const COMPANION_OPTIONS = ['solo', 'partner', 'friends', 'family'];

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
// AvatarStack — cartoon animal traveler avatars (overlapping circles)
// with a "+N" overflow chip when count exceeds the visible cap.
// ════════════════════════════════════════════════════════════════════════
function AvatarStack({ count }: { count: number }) {
  const VISIBLE_CAP = 3;
  // Show all avatars when count fits the cap; otherwise show one fewer
  // animal so the +N chip can take that slot — keeps the strip width fixed.
  const shown = count <= VISIBLE_CAP ? count : VISIBLE_CAP - 1;
  const overflow = count - shown;
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -10,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            borderRadius: 18,
          }}
        >
          <AnimalAvatar kind={ANIMAL_KINDS[i % ANIMAL_KINDS.length]} size={32} />
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: shown === 0 ? 0 : -10,
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            backgroundColor: colors.teal,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: FontFamily.bold,
              fontSize: 11,
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: -0.2,
            }}
          >
            +{overflow}
          </Text>
        </View>
      )}
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

    // ── Country picker state (used when sheet is launched without a
    // country — e.g. from Trips home's AI button). When a country is
    // already provided via props, this stays empty and the picker stays
    // hidden.
    const propHasCountry = !!country?.code;
    const [pickedCode, setPickedCode] = useState<string>('');
    const [showPicker, setShowPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    const effective = useMemo(() => {
      // Prefer prop country when present (e.g. opened from country detail).
      // Otherwise fall back to the picked country from the picker modal.
      const code = propHasCountry ? country.code : pickedCode;
      if (!code) return null;
      const c = visaData.find((x) => x.code === code);
      if (!c) return null;
      const m = countryMeta[code] ?? null;
      const t = travelData[code] ?? null;
      const r = resolveCountry(c, heldVisas);
      return { country: c, meta: m, travel: t, resolved: r };
    }, [propHasCountry, country?.code, pickedCode, heldVisas]);

    const filteredPickerCountries = useMemo(() => {
      const q = pickerSearch.trim().toLowerCase();
      return visaData
        .filter((c) => c.category !== 'home')
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .slice(0, 80);
    }, [pickerSearch]);

    // ── Date state ──────────────────────────────────────────────
    const defaults = defaultDates();
    const [startDate, setStartDate] = useState<Date>(defaults.start);
    const [endDate, setEndDate] = useState<Date>(defaults.end);
    // Which date card has the picker open. iOS shows an inline modal sheet
    // anchored to the card; Android uses the native picker dialog.
    const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);
    // "Dreaming" mode — user hasn't committed to dates yet. Hides the
    // date cards and just collects how many nights, then saves the trip
    // with no startDate so it lands in the Dreaming filter.
    const [dreaming, setDreaming] = useState(false);
    const [dreamNights, setDreamNights] = useState<number>(7);

    // ── Travelers state ─────────────────────────────────────────
    const [travelers, setTravelers] = useState(2);

    // ── Vibes state (spec-aligned 8-chip set) ───────────────────
    const [activeVibes, setActiveVibes] = useState<Set<string>>(new Set());

    // ── Legacy preference state (preserved for payload compat) ──
    const [vibe] = useState('balanced');
    const [budget] = useState('mid');
    const [party] = useState('couple');

    const generateTripAction = useAction(api.tripGeneration.generateTrip);
    const sparkleStyle = usePlaneAnimation(isLoading);

    // ── Days derived from dates (or the dreaming nights stepper) ───
    const days = useMemo(() => {
      if (dreaming) return Math.max(1, dreamNights);
      const diff = endDate.getTime() - startDate.getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    }, [dreaming, dreamNights, startDate, endDate]);

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
      setPickedCode('');
      setPickerSearch('');
      setShowPicker(false);
      setDreaming(false);
      setDreamNights(7);
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
    // Inserts a generation stub via Convex action; the action schedules
    // server-side streaming so we can dismiss the sheet immediately and
    // navigate the user onto the trip detail screen, where sections
    // arrive live as they finish.
    const generate = useCallback(async () => {
      // When the sheet has a country prop (opened from country detail) we use
      // the prop chain. When opened standalone (Trips home) we fall back to
      // the country picked in the in-sheet picker. Either path must yield a
      // full effective country before we hit the action.
      const eff = effective ?? (
        country && meta && travel && resolved
          ? { country, meta, travel, resolved }
          : null
      );
      if (!eff) {
        setError('Pick a destination first.');
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const tripId = await generateTripAction({
          countryCode: eff.country.code,
          countryName: eff.country.name,
          capital: eff.meta?.capital ?? eff.country.name,
          duration: days,
          heldVisas: [...heldVisas],
          vibe,
          budget,
          interests: [...activeVibes].join(', ') || 'culture, food, sightseeing',
          activityStyles: [...activeVibes],
          travelParty: travelers > 1 ? party : 'solo',
          companions: travelers > 1 ? JSON.stringify({ party, count: travelers }) : undefined,
          startDate: dreaming ? undefined : startDate.toISOString().slice(0, 10),
          endDate: dreaming ? undefined : endDate.toISOString().slice(0, 10),
        });
        bottomSheetRef.current?.dismiss();
        onTripCreated(String(tripId));
      } catch {
        setError("Couldn't start your trip. Please try again.");
        setIsLoading(false);
      }
    }, [
      effective, country, meta, travel, resolved, heldVisas,
      days, vibe, budget, activeVibes, travelers, party,
      generateTripAction, onTripCreated, dreaming, startDate, endDate,
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
              {/* Header row — dark orb + AI PLANNER kicker + squiggle + italic title */}
              <View style={s.headerRow}>
                <DarkOrb size={38}>
                  <Sparkles size={17} color="#FFFFFF" fill="#FFFFFF" />
                </DarkOrb>
                <View style={s.headerText}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontFamily: FontFamily.monoMedium,
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 11 * 0.22,
                        textTransform: 'uppercase',
                        color: colors.coralDeep,
                      }}
                    >
                      AI PLANNER
                    </Text>
                    <Squiggle width={26} color={colors.coral} />
                  </View>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 22,
                      lineHeight: 24,
                      letterSpacing: -22 * 0.018,
                      fontWeight: '500',
                      color: colors.ink,
                      marginTop: 4,
                    }}
                  >
                    {effective ? `Plan a trip to ${effective.country.name}` : 'Plan your next trip'}
                    <Text style={{ color: colors.coral }}>.</Text>
                  </Text>
                </View>
              </View>

              {/* Destination picker — shown when sheet has no country prop.
                  Once a country is picked the card shows flag + italic name. */}
              {!propHasCountry && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowPicker(true)}
                  style={[
                    s.destinationCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: effective ? colors.coral : colors.line,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>
                      DESTINATION
                    </Text>
                    {effective ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <Flag code={toAlpha2(effective.country.code)} size={20} />
                        <Text
                          style={{
                            fontFamily: FontFamily.displayItalic,
                            fontStyle: 'italic',
                            fontSize: 18,
                            fontWeight: '500',
                            color: colors.ink,
                            letterSpacing: -18 * 0.014,
                          }}
                          numberOfLines={1}
                        >
                          {effective.country.name}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 18,
                          fontWeight: '500',
                          color: colors.inkMute,
                          letterSpacing: -18 * 0.014,
                          marginTop: 4,
                        }}
                      >
                        Where to?
                      </Text>
                    )}
                  </View>
                  <ChevronRight size={18} color={colors.inkMute} />
                </TouchableOpacity>
              )}

              {/* "Pick dates / Just dreaming" toggle — italic Fraunces pills.
                  Active gets dark ink fill with white italic; inactive paper. */}
              <View style={s.modeRow}>
                {(['dates', 'dreaming'] as const).map((mode) => {
                  const active =
                    (mode === 'dates' && !dreaming) ||
                    (mode === 'dreaming' && dreaming);
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setDreaming(mode === 'dreaming')}
                      activeOpacity={0.85}
                      style={[
                        s.modeBtn,
                        {
                          backgroundColor: active ? colors.ink : colors.surface,
                          borderColor: active ? colors.ink : colors.line,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: FontFamily.displayItalic,
                          fontStyle: 'italic',
                          fontSize: 14,
                          fontWeight: '500',
                          letterSpacing: -14 * 0.014,
                          color: active ? '#FFFFFF' : colors.ink,
                        }}
                      >
                        {mode === 'dates' ? 'Pick dates' : 'Just dreaming'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {dreaming ? (
                /* Dreaming mode: a single duration card with -/+ stepper */
                <View
                  style={[
                    s.travelersCard,
                    { backgroundColor: colors.surface, borderColor: colors.line, marginBottom: 10 },
                  ]}
                >
                  <View style={s.travelersLeft}>
                    <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>NIGHTS</Text>
                    <Text style={[s.dateCardValue, { color: colors.ink }]}>
                      {dreamNights} {dreamNights === 1 ? 'night' : 'nights'}
                    </Text>
                    <Text style={[s.dateCardSub, { color: colors.inkMute }]}>
                      Pick dates later — saves to Dreaming
                    </Text>
                  </View>
                  <View style={s.travelersRight}>
                    <View style={s.travelerStepper}>
                      <TouchableOpacity
                        onPress={() => setDreamNights((n) => Math.max(1, n - 1))}
                        activeOpacity={0.7}
                        style={[s.stepBtn, { borderColor: colors.line }]}
                      >
                        <Text style={[s.stepBtnText, { color: colors.inkMute }]}>−</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDreamNights((n) => Math.min(60, n + 1))}
                        activeOpacity={0.7}
                        style={[s.stepBtn, { borderColor: colors.line }]}
                      >
                        <Text style={[s.stepBtnText, { color: colors.inkMute }]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                /* Picked-dates mode: tap to open the calendar picker */
                <View style={s.dateRow}>
                  <TouchableOpacity
                    onPress={() => setDatePicker('start')}
                    activeOpacity={0.85}
                    style={[s.dateCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
                  >
                    <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>START</Text>
                    <Text style={[s.dateCardValue, { color: colors.ink }]}>
                      {formatDate(startDate)}
                      <Text style={{ color: colors.coral }}>.</Text>
                    </Text>
                    <Text style={[s.dateCardSub, { color: colors.inkMute }]}>
                      {startDate.getFullYear()} · TAP TO CHANGE
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDatePicker('end')}
                    activeOpacity={0.85}
                    style={[s.dateCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
                  >
                    <Text style={[s.dateCardLabel, { color: colors.inkMute }]}>END</Text>
                    <Text style={[s.dateCardValue, { color: colors.ink }]}>
                      {formatDate(endDate)}
                      <Text style={{ color: colors.coral }}>.</Text>
                    </Text>
                    <Text style={[s.dateCardSub, { color: colors.inkMute }]}>
                      {days} {days === 1 ? 'NIGHT' : 'NIGHTS'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

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

              {/* Vibes section — coral squiggle accent + italic Fraunces chips */}
              <View style={s.vibesSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 11 * 0.22,
                      textTransform: 'uppercase',
                      color: colors.inkMute,
                    }}
                  >
                    VIBES
                  </Text>
                  <Squiggle width={24} color={colors.coral} />
                </View>
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
                            ? { backgroundColor: colors.coral, borderColor: colors.coral }
                            : { backgroundColor: colors.surface, borderColor: colors.line },
                        ]}
                      >
                        <Text style={[
                          s.vibeChipText,
                          {
                            color: active ? '#FFFFFF' : colors.ink,
                          },
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

              {/* Primary CTA — italic Fraunces with coral period when ready,
                  paper hint when waiting for a destination. */}
              {(() => {
                const ready = !!effective || !!(country && meta && travel && resolved);
                return (
                  <TouchableOpacity
                    onPress={ready ? generate : undefined}
                    activeOpacity={ready ? 0.85 : 1}
                    disabled={!ready}
                    style={[
                      s.ctaButton,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        paddingVertical: 18,
                        borderRadius: 999,
                        backgroundColor: ready ? colors.coral : colors.surface,
                        borderWidth: 1,
                        borderColor: ready ? colors.coral : colors.line,
                        shadowColor: ready ? colors.coral : 'transparent',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: ready ? 0.35 : 0,
                        shadowRadius: 16,
                        elevation: ready ? 6 : 0,
                      },
                    ]}
                  >
                    <Sparkles
                      size={16}
                      color={ready ? '#FFFFFF' : colors.inkMute}
                      fill={ready ? '#FFFFFF' : 'transparent'}
                    />
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 17,
                        fontWeight: '500',
                        letterSpacing: -17 * 0.014,
                        color: ready ? '#FFFFFF' : colors.inkMute,
                      }}
                    >
                      {ready ? 'Generate itinerary' : 'Pick a destination first'}
                      {ready ? (
                        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>{'  →'}</Text>
                      ) : null}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          {/* ── Date picker — calendar grid (iOS) / native dialog (Android) ── */}
          {datePicker !== null && (
            <Modal
              visible
              transparent
              animationType="fade"
              onRequestClose={() => setDatePicker(null)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setDatePicker(null)}
                style={s.dateBackdrop}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {}}
                  style={[
                    s.datePickerCard,
                    { backgroundColor: colors.surface, borderColor: colors.line },
                  ]}
                >
                  <Text
                    style={[
                      Type.kicker,
                      {
                        color: colors.inkMute,
                        marginBottom: 4,
                      },
                    ]}
                  >
                    {datePicker === 'start' ? 'START DATE' : 'END DATE'}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 22,
                      fontWeight: '500',
                      color: colors.ink,
                      letterSpacing: -22 * 0.018,
                      marginBottom: 6,
                    }}
                  >
                    Pick a date
                  </Text>
                  <DateTimePicker
                    value={datePicker === 'start' ? startDate : endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={
                      datePicker === 'end'
                        ? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
                        : new Date()
                    }
                    accentColor={colors.coral}
                    themeVariant="light"
                    onChange={(_event, picked) => {
                      if (picked) {
                        if (datePicker === 'start') {
                          setStartDate(picked);
                          // keep end at least 1 day after start
                          if (picked >= endDate) {
                            const newEnd = new Date(picked);
                            newEnd.setDate(newEnd.getDate() + 1);
                            setEndDate(newEnd);
                          }
                        } else {
                          if (picked > startDate) setEndDate(picked);
                        }
                      }
                      // Android closes after selection; iOS stays open until backdrop tap
                      if (Platform.OS === 'android') setDatePicker(null);
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={() => setDatePicker(null)}
                      style={[
                        s.datePickerDone,
                        { backgroundColor: colors.teal },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: FontFamily.bold,
                          fontSize: 13,
                          fontWeight: '700',
                          color: '#FFFFFF',
                        }}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          )}

          {/* ── Country picker modal (search) ─────────────────── */}
          <Modal
            visible={showPicker}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowPicker(false)}
          >
            <View
              style={[
                s.pickerContainer,
                { backgroundColor: colors.background, paddingTop: insets.top + 8 },
              ]}
            >
              <View style={s.pickerHeader}>
                <View style={{ flex: 1 }}>
                  <SectionKicker>DESTINATION</SectionKicker>
                  <Text
                    style={{
                      fontFamily: FontFamily.display,
                      fontSize: 22,
                      fontWeight: '500',
                      letterSpacing: -22 * 0.018,
                      color: colors.ink,
                      marginTop: 2,
                    }}
                  >
                    Where{' '}
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                      }}
                    >
                      to
                    </Text>
                    <Text style={{ color: colors.coral }}>?</Text>
                  </Text>
                  <Squiggle width={70} color={colors.coral} style={{ marginTop: 4 }} />
                </View>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  hitSlop={12}
                  style={[s.pickerClose, { backgroundColor: colors.surface, borderColor: colors.line }]}
                >
                  <X size={18} color={colors.ink} />
                </TouchableOpacity>
              </View>

              <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Search size={16} color={colors.inkMute} />
                <TextInput
                  style={[s.searchInput, { color: colors.ink }]}
                  placeholder="Search countries"
                  placeholderTextColor={colors.inkFaint}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  autoFocus
                  autoCorrect={false}
                />
                {pickerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPickerSearch('')} hitSlop={8}>
                    <X size={14} color={colors.inkMute} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={filteredPickerCountries}
                keyExtractor={(item) => item.code}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setPickedCode(item.code);
                      setShowPicker(false);
                      setPickerSearch('');
                    }}
                    style={[s.pickerRow, { borderBottomColor: colors.line }]}
                    activeOpacity={0.6}
                  >
                    <Flag code={toAlpha2(item.code)} size={24} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 16,
                        fontWeight: '500',
                        color: colors.ink,
                        letterSpacing: -16 * 0.012,
                      }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <ChevronRight size={16} color={colors.inkMute} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text
                    style={[
                      Type.body13,
                      { color: colors.inkMute, textAlign: 'center', marginTop: 24 },
                    ]}
                  >
                    No countries found
                  </Text>
                }
              />
            </View>
          </Modal>

          {/* ── LOADING STATE — minimal wait between tap and dismiss ──
              The streaming generateTrip action returns the new tripId in
              under a second; the sheet dismisses on resolve and the user
              lands on the trip detail screen where content streams in. */}
          {isLoading && (
            <View style={s.loadingContainer}>
              <Animated.View style={sparkleStyle}>
                <DarkOrb size={64}>
                  <Sparkles size={26} color="#FFFFFF" fill="#FFFFFF" />
                </DarkOrb>
              </Animated.View>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 17,
                  lineHeight: 22,
                  letterSpacing: -17 * 0.014,
                  fontWeight: '500',
                  color: colors.inkSoft,
                  textAlign: 'center',
                  marginTop: 16,
                }}
              >
                Starting your trip
                <Text style={{ color: colors.coral }}>…</Text>
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

    // ── Destination picker (in-sheet country card) ────────────
    destinationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 10,
      ...Shadows.subtle,
    },

    // ── Pick-dates / Dreaming toggle ──────────────────────────
    modeRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 10,
    },
    modeBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
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
      fontFamily: FontFamily.displayItalic,
      fontStyle: 'italic',
      fontSize: 14,
      fontWeight: '500',
      letterSpacing: -14 * 0.012,
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
      paddingHorizontal: Spacing.lg,
    },

    // ── Country picker modal ──────────────────────────────────
    pickerContainer: {
      flex: 1,
      paddingHorizontal: 22,
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingBottom: 14,
    },
    pickerClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontFamily: FontFamily.regular,
      fontSize: 14,
      paddingVertical: 0,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },

    // ── Date card sub-label + picker modal ─────────────────────
    dateCardSub: {
      ...Type.kickerSm,
      fontSize: 9,
      marginTop: 4,
    },
    dateBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    datePickerCard: {
      width: '100%',
      borderRadius: 24,
      borderWidth: 1,
      padding: 18,
      maxWidth: 380,
      ...Shadows.cardRaised,
    },
    datePickerDone: {
      marginTop: 6,
      alignSelf: 'stretch',
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

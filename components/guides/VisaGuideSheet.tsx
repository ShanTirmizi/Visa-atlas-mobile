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
import { Shield, BookOpen, ChevronLeft } from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { endpoints } from '@/constants/api';
import type { HeldVisaType } from '@/data/visaData';

// ── Constants ─────────────────────────────────────────────────────────
const EMPLOYMENTS = [
  { v: 'employed', l: 'Employed' },
  { v: 'self-employed', l: 'Self-employed' },
  { v: 'student', l: 'Student' },
  { v: 'retired', l: 'Retired' },
  { v: 'unemployed', l: 'Not working' },
];

const PURPOSES = [
  { v: 'tourism', l: 'Tourism' },
  { v: 'business', l: 'Business' },
  { v: 'transit', l: 'Transit' },
  { v: 'visiting', l: 'Visiting family' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LOAD_MSGS = [
  'Checking visa requirements...',
  'Reviewing document checklist...',
  'Analyzing processing times...',
  'Calculating fees & costs...',
  'Preparing your timeline...',
  'Gathering embassy details...',
  'Reviewing rejection patterns...',
  'Finalizing your guide...',
];

// ── Step config (static — hoisted to avoid re-creation on every render) ──
const STEP_CONFIG: Record<'employment' | 'purpose' | 'rejections' | 'month', { title: string; subtitle: string }> = {
  employment: { title: 'What do you do?', subtitle: "This affects which documents you'll need" },
  purpose: { title: 'Why are you visiting?', subtitle: 'Different visa types for different purposes' },
  rejections: { title: 'Any previous rejections?', subtitle: 'This helps us flag potential issues' },
  month: { title: 'When do you plan to travel?', subtitle: 'Processing times vary by season' },
};

// ── Types ──────────────────────────────────────────────────────────────
type Step = 'employment' | 'purpose' | 'rejections' | 'month' | 'loading';

export interface VisaGuideSheetProps {
  countryCode: string;
  countryName: string;
  heldVisas: Set<HeldVisaType>;
  onGuideCreated: (guideId: string) => void;
}

export interface VisaGuideSheetRef {
  present: () => void;
  dismiss: () => void;
}

// ── Animations ────────────────────────────────────────────────────────
function useShieldAnimation(isActive: boolean) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
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

// ══════════════════════════════════════════════════════════════════════
// VisaGuideSheet
// ══════════════════════════════════════════════════════════════════════
const VisaGuideSheet = forwardRef<VisaGuideSheetRef, VisaGuideSheetProps>(
  ({ countryCode, countryName, heldVisas, onGuideCreated }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    const [step, setStep] = useState<Step>('employment');
    const [employment, setEmployment] = useState('employed');
    const [purpose, setPurpose] = useState('tourism');
    const [rejections, setRejections] = useState(false);
    const [travelMonth, setTravelMonth] = useState(
      MONTHS[(new Date().getMonth() + 2) % 12],
    );
    const [error, setError] = useState('');
    const [tick, setTick] = useState(0);

    const createGuide = useMutation(api.visaGuides.createGuide);
    const shieldStyle = useShieldAnimation(step === 'loading');

    useEffect(() => {
      if (step !== 'loading') { setTick(0); return; }
      const id = setInterval(() => setTick((t) => t + 1), 3000);
      return () => clearInterval(id);
    }, [step]);

    const resetState = useCallback(() => {
      setStep('employment');
      setEmployment('employed');
      setPurpose('tourism');
      setRejections(false);
      setTravelMonth(MONTHS[(new Date().getMonth() + 2) % 12]);
      setError('');
      setTick(0);
    }, []);

    useImperativeHandle(ref, () => ({
      present: () => { resetState(); bottomSheetRef.current?.present(); },
      dismiss: () => { bottomSheetRef.current?.dismiss(); },
    }));

    const generate = useCallback(async () => {
      setStep('loading');
      setError('');
      try {
        const res = await fetch(endpoints.visaGuide, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countryCode,
            countryName,
            employment,
            purpose,
            previousRejections: rejections,
            travelMonth,
            heldVisas: [...heldVisas],
          }),
        });
        if (!res.ok) throw new Error('Generation failed');
        const guide = await res.json();

        const checklist = (guide.documents || []).map(
          (doc: { id: string; label: string; category: string; tip?: string }) => ({
            ...doc,
            checked: false,
          }),
        );

        const guideId = await createGuide({
          countryCode,
          countryName,
          visaType: guide.visaType || 'Tourist Visa',
          userProfile: JSON.stringify({
            employment, purpose, rejections, travelMonth,
          }),
          guide: JSON.stringify(guide),
          checklist: JSON.stringify(checklist),
          status: 'preparing' as const,
        });

        setTimeout(() => {
          bottomSheetRef.current?.dismiss();
          onGuideCreated(String(guideId));
        }, 300);
      } catch {
        setError('Failed to generate guide. Please try again.');
        setStep('month');
      }
    }, [countryCode, countryName, employment, purpose, rejections, travelMonth, heldVisas, createGuide, onGuideCreated]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    const s = useMemo(() => makeStyles(colors), [colors]);

    const nextStep = (): Step | null => {
      switch (step) {
        case 'employment': return 'purpose';
        case 'purpose': return 'rejections';
        case 'rejections': return 'month';
        case 'month': return null;
        default: return null;
      }
    };

    const prevStep = (): Step | null => {
      switch (step) {
        case 'purpose': return 'employment';
        case 'rejections': return 'purpose';
        case 'month': return 'rejections';
        default: return null;
      }
    };

    const handleNext = () => {
      const next = nextStep();
      if (next) setStep(next);
      else generate();
    };

    const renderPills = (
      options: { v: string; l: string }[],
      value: string,
      onSelect: (v: string) => void,
      activeColor?: string,
    ) => (
      <View style={s.pillGrid}>
        {options.map(({ v, l }) => {
          const active = value === v;
          const bg = active ? (activeColor || colors.accent) : colors.card;
          const border = active ? (activeColor || colors.accent) : colors.border;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onSelect(v)}
              activeOpacity={0.7}
              style={[s.pill, { backgroundColor: bg, borderColor: border }]}
            >
              <Text style={[s.pillText, { color: active ? '#FFFFFF' : colors.foreground }]}>
                {l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        enableDynamicSizing={true}
        maxDynamicContentSize={Dimensions.get('window').height - insets.top - 10}
        enablePanDownToClose={step !== 'loading'}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted, width: 40 }}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: 28 }}
        onChange={(index) => { if (index === -1) resetState(); }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {step !== 'loading' && (
            <View>
              {prevStep() && (
                <TouchableOpacity
                  onPress={() => setStep(prevStep()!)}
                  style={s.backBtn}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  <ChevronLeft size={18} color={colors.textSecondary} />
                  <Text style={[s.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
              )}
              <Text style={[s.title, { color: colors.foreground }]}>
                {STEP_CONFIG[step].title}
              </Text>
              <Text style={[s.subtitle, { color: colors.textSecondary }]}>
                {STEP_CONFIG[step].subtitle}
              </Text>

              {step === 'employment' && renderPills(EMPLOYMENTS, employment, setEmployment)}
              {step === 'purpose' && renderPills(PURPOSES, purpose, setPurpose)}
              {step === 'rejections' && renderPills(
                [{ v: 'false', l: 'No, never' }, { v: 'true', l: 'Yes, previously' }],
                String(rejections),
                (v) => setRejections(v === 'true'),
                rejections ? colors.warning : colors.accent,
              )}

              {step === 'month' && (
                <View style={s.monthGrid}>
                  {MONTHS.map((m) => {
                    const active = travelMonth === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setTravelMonth(m)}
                        activeOpacity={0.7}
                        style={[
                          s.monthPill,
                          {
                            backgroundColor: active ? colors.accent : colors.card,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          s.monthText,
                          { color: active ? '#FFFFFF' : colors.foreground },
                        ]}>
                          {m.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {error ? (
                <View style={[s.errorCard, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '30' }]}>
                  <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
                  <TouchableOpacity
                    onPress={() => setError('')}
                    style={[s.errorDismiss, { borderColor: colors.danger + '40' }]}
                  >
                    <Text style={[s.errorDismissText, { color: colors.danger }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.7}
                style={[
                  s.actionBtn,
                  { backgroundColor: colors.primary },
                  Shadows.glow(colors.primary, 0.25),
                ]}
              >
                {step === 'month' && <BookOpen size={18} color="#FFFFFF" />}
                <Text style={s.actionBtnText}>
                  {step === 'month' ? 'Generate Visa Guide' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'loading' && (
            <View style={s.loadingContainer}>
              <Animated.View style={[s.iconCircle, { backgroundColor: colors.primaryBg }, shieldStyle]}>
                <Shield size={32} color={colors.primary} />
              </Animated.View>
              <Text style={[s.loadingContext, { color: colors.textSecondary }]}>
                Preparing your visa guide for{' '}
                <Text style={{ fontFamily: FontFamily.serifSemibold }}>{countryName}</Text>
                ...
              </Text>
              <Animated.Text
                key={tick}
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(200)}
                style={[s.loadingMsg, { color: colors.foreground }]}
              >
                {LOAD_MSGS[tick % LOAD_MSGS.length]}
              </Animated.Text>
              <TypingDots color={colors.primary} />
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

VisaGuideSheet.displayName = 'VisaGuideSheet';
export default VisaGuideSheet;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    pill: {
      paddingVertical: 12,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.sm,
      borderWidth: 1.5,
    },
    pillText: {
      fontFamily: FontFamily.semibold,
      fontSize: FontSize.sm,
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
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
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 16,
      borderRadius: 20,
    },
    actionBtnText: {
      fontFamily: FontFamily.bold,
      fontSize: FontSize.base,
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
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
  });

import React, {
  useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useMemo,
} from 'react';
import {
  View, Text, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  Shield, ChevronLeft, Sparkles,
  Briefcase, Plane, FileX, Calendar as CalendarIcon,
} from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withSpring, Easing,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { Type } from '@/constants/typography';
import { endpoints } from '@/constants/api';
import type { HeldVisaType } from '@/data/visaData';
import { TypingDots } from '@/components/ui/TypingDots';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Squiggle } from '@/components/ui/Squiggle';

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
// Each step has an editorial split: a regular-weight prefix and an italic
// emphasis word, so the title reads like the rest of the app's headlines
// (e.g., "What do you *do*?" with italic "do" + coral "?"). The icon is
// rendered inside the dark orb at the top of the sheet.
type StepKey = 'employment' | 'purpose' | 'rejections' | 'month';

const STEP_CONFIG: Record<StepKey, {
  prefix: string;
  emphasis: string;
  suffix: string;
  subtitle: string;
  kicker: string;
  icon: typeof Briefcase;
  index: number;
}> = {
  employment: {
    prefix: 'What do you ', emphasis: 'do', suffix: '?',
    subtitle: "This affects which documents you'll need",
    kicker: 'WORK', icon: Briefcase, index: 1,
  },
  purpose: {
    prefix: 'Why are you ', emphasis: 'visiting', suffix: '?',
    subtitle: 'Different visa types for different purposes',
    kicker: 'PURPOSE', icon: Plane, index: 2,
  },
  rejections: {
    prefix: 'Any previous ', emphasis: 'rejections', suffix: '?',
    subtitle: 'This helps us flag potential issues',
    kicker: 'HISTORY', icon: FileX, index: 3,
  },
  month: {
    prefix: 'When do you plan to ', emphasis: 'travel', suffix: '?',
    subtitle: 'Processing times vary by season',
    kicker: 'TIMING', icon: CalendarIcon, index: 4,
  },
};
const TOTAL_STEPS = 4;

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
        {options.map(({ v, l }, i) => {
          const active = value === v;
          // Stagger entry so cards arrive one-after-another on step change.
          // 200ms duration, 50ms gap — same rhythm as TripRefinementSheet.
          return (
            <Animated.View
              key={v}
              entering={FadeIn.duration(220).delay(i * 50)}
            >
              <PressablePill
                label={l}
                active={active}
                onPress={() => onSelect(v)}
                colors={colors}
                activeColor={activeColor}
              />
            </Animated.View>
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
          {step !== 'loading' && (() => {
            const meta = STEP_CONFIG[step];
            const StepIcon = meta.icon;
            const back = prevStep();
            const isLastStep = step === 'month';
            return (
              <Animated.View
                key={step}
                entering={FadeIn.duration(260)}
              >
                {/* Back link — text-only, in-sheet step nav (not a screen back) */}
                {back && (
                  <Pressable
                    onPress={() => setStep(back)}
                    style={s.backBtn}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <ChevronLeft size={16} color={colors.inkMute} strokeWidth={2.2} />
                    <Text style={[s.backBtnText, { color: colors.inkMute }]}>Back</Text>
                  </Pressable>
                )}

                {/* Editorial header — orb + kicker + squiggle + italic title */}
                <View style={s.headerRow}>
                  <DarkOrb size={38}>
                    <StepIcon size={17} color="#FFFFFF" strokeWidth={1.8} />
                  </DarkOrb>
                  <View style={s.headerText}>
                    <View style={s.kickerRow}>
                      <Text style={[Type.kicker, { color: colors.coralDeep }]}>
                        STEP {meta.index} OF {TOTAL_STEPS} · {meta.kicker}
                      </Text>
                      <Squiggle width={22} color={colors.coral} />
                    </View>
                    <Text style={s.title}>
                      <Text style={{
                        fontFamily: FontFamily.display,
                        fontSize: 24,
                        lineHeight: 28,
                        letterSpacing: -24 * 0.018,
                        color: colors.ink,
                      }}>
                        {meta.prefix}
                      </Text>
                      <Text style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 24,
                        lineHeight: 28,
                        letterSpacing: -24 * 0.018,
                        color: colors.ink,
                      }}>
                        {meta.emphasis}
                      </Text>
                      <Text style={{
                        fontFamily: FontFamily.display,
                        fontSize: 24,
                        lineHeight: 28,
                        letterSpacing: -24 * 0.018,
                        color: colors.coral,
                      }}>
                        {meta.suffix}
                      </Text>
                    </Text>
                    <Text style={[s.subtitle, { color: colors.inkMute }]}>
                      {meta.subtitle}
                    </Text>
                  </View>
                </View>

                {/* Step progress dots */}
                <View style={s.stepDots}>
                  {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                    const n = i + 1;
                    const reached = n <= meta.index;
                    return (
                      <View
                        key={n}
                        style={[
                          s.stepDot,
                          {
                            backgroundColor: reached ? colors.coral : colors.line,
                            width: n === meta.index ? 22 : 6,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                {step === 'employment' && renderPills(EMPLOYMENTS, employment, setEmployment)}
                {step === 'purpose' && renderPills(PURPOSES, purpose, setPurpose)}
                {step === 'rejections' && renderPills(
                  [{ v: 'false', l: 'No, never' }, { v: 'true', l: 'Yes, previously' }],
                  String(rejections),
                  (v) => setRejections(v === 'true'),
                  rejections ? colors.warning : colors.coral,
                )}

                {step === 'month' && (
                  <View style={s.monthGrid}>
                    {MONTHS.map((m, i) => (
                      <Animated.View
                        key={m}
                        entering={FadeIn.duration(200).delay(i * 28)}
                        style={s.monthPillSlot}
                      >
                        <PressablePill
                          label={m.slice(0, 3)}
                          active={travelMonth === m}
                          onPress={() => setTravelMonth(m)}
                          colors={colors}
                          variant="month"
                        />
                      </Animated.View>
                    ))}
                  </View>
                )}

                {error ? (
                  <View style={[s.errorCard, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '30' }]}>
                    <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
                    <Pressable
                      onPress={() => setError('')}
                      style={[s.errorDismiss, { borderColor: colors.danger + '40' }]}
                    >
                      <Text style={[s.errorDismissText, { color: colors.danger }]}>Dismiss</Text>
                    </Pressable>
                  </View>
                ) : null}

                {/* Premium CTA — italic Fraunces with coral terminal punctuation */}
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => [
                    s.ctaButton,
                    {
                      backgroundColor: colors.coral,
                      borderColor: colors.coral,
                      shadowColor: colors.coral,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  {isLastStep && <Sparkles size={16} color="#FFFFFF" fill="#FFFFFF" />}
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 17,
                      fontWeight: '500',
                      letterSpacing: -17 * 0.014,
                      color: '#FFFFFF',
                    }}
                  >
                    {isLastStep ? 'Generate guide' : 'Next'}
                    <Text style={{ color: '#FFFFFF', opacity: 0.75 }}>
                      {isLastStep ? '.' : '  →'}
                    </Text>
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })()}

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
              <View style={{ marginTop: Spacing.lg }}>
                <TypingDots color={colors.primary} gap={8} />
              </View>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

VisaGuideSheet.displayName = 'VisaGuideSheet';
export default VisaGuideSheet;

// ──────────────────────────────────────────────
// PressablePill — option card with subtle scale-spring on press
// ──────────────────────────────────────────────
function PressablePill({
  label,
  active,
  onPress,
  colors,
  activeColor,
  variant = 'option',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  activeColor?: string;
  variant?: 'option' | 'month';
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withSpring(0.96, { damping: 14, mass: 0.4, stiffness: 220 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 14, mass: 0.4, stiffness: 220 });
  };

  const accent = activeColor || colors.coral;
  const bg = active ? accent : colors.surface;
  const border = active ? accent : colors.line;
  const textColor = active ? '#FFFFFF' : colors.ink;

  const padding =
    variant === 'month'
      ? { paddingVertical: 12, paddingHorizontal: 0 }
      : { paddingVertical: 12, paddingHorizontal: Spacing.lg };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View
          style={[
            {
              borderRadius: variant === 'month' ? 12 : 999,
              borderWidth: 1.25,
              backgroundColor: bg,
              borderColor: border,
              alignItems: 'center',
            },
            padding,
          ]}
        >
          <Text
            style={{
              fontFamily: active ? FontFamily.displayItalic : FontFamily.display,
              fontStyle: active ? 'italic' : 'normal',
              fontSize: variant === 'month' ? 15 : 16,
              fontWeight: '500',
              letterSpacing: -(variant === 'month' ? 15 : 16) * 0.012,
              color: textColor,
            }}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: Spacing.md,
      alignSelf: 'flex-start',
    },
    backBtnText: {
      fontFamily: FontFamily.medium,
      fontSize: FontSize.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14,
    },
    headerText: {
      flex: 1,
      paddingTop: 2,
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    title: {
      // The actual font styling is inline so prefix/emphasis/suffix can each
      // pick their own family + colour without a wrapper. This style just
      // owns vertical rhythm.
      marginTop: 2,
    },
    subtitle: {
      fontFamily: FontFamily.regular,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
    },
    stepDots: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 22,
      marginTop: 4,
    },
    stepDot: {
      height: 6,
      borderRadius: 3,
    },
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: Spacing.lg,
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: Spacing.lg,
    },
    monthPillSlot: {
      width: '23.5%' as unknown as number,
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
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 18,
      borderRadius: 999,
      borderWidth: 1,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 6,
      marginTop: 4,
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

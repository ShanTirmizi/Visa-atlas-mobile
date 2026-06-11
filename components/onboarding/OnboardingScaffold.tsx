// components/onboarding/OnboardingScaffold.tsx
//
// Editorial onboarding shell — same visual vocabulary as the sign-in / create
// account screens: wavy guilloche paper background, top safe-area blur, mono
// kicker + coral squiggle, italic Fraunces title with a coral period, and a
// pinned ink-filled CTA at the bottom. PhotoTone / heroUri props are kept as
// no-op back-compat so existing callers don't break.

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';
import { Guilloche } from '@/components/ui/Guilloche';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
// PhotoTone kept as a typed prop for API back-compat; no longer used visually.
import type { PhotoTone } from '@/components/ui/Photo';

// RNKC's KeyboardAwareScrollView scrolls the focused input above the keyboard
// with the right delta (Apple Mail / Notes algorithm) — the passport and
// residence steps have a search input + inline country list that the keyboard
// buried with a plain ScrollView. Wrapped with createAnimatedComponent so the
// reanimated onScroll handler that drives TopSafeAreaBlur keeps working
// (same pattern as components/ui/BottomSheetKeyboardAwareScrollView.tsx).
const AnimatedKeyboardAwareScrollView =
  Animated.createAnimatedComponent(KeyboardAwareScrollView);

interface OnboardingScaffoldProps {
  /** 1-based step number. */
  step: number;
  totalSteps: number;
  title: string;
  body?: string;
  /** @deprecated — kept for back-compat; no longer rendered. */
  heroTone?: PhotoTone;
  /** @deprecated — kept for back-compat; no longer rendered. */
  heroUri?: string;
  ctaLabel: string;
  onCta: () => void;
  /** When provided, "Skip" link appears top-right. */
  onSkip?: () => void;
  /** Content slot — rendered below title/body, above CTA. */
  children?: React.ReactNode;
  /** Disable the CTA (e.g. no selection yet). */
  ctaDisabled?: boolean;
  /** Show a circular back button in the top-left. Defaults to true except on
   *  step 1 (where the previous screen is auth). */
  showBack?: boolean;
}

export function OnboardingScaffold({
  step,
  totalSteps,
  title,
  body,
  ctaLabel,
  onCta,
  onSkip,
  children,
  ctaDisabled,
  showBack = true,
}: OnboardingScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Drive the top safe-area blur from this scroll. At rest the blur is
  // invisible; as content scrolls under the safe area the blur ramps up
  // smoothly on the UI thread (Apple Mail pattern).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Wavy guilloche paper texture — same as sign-in / forgot-password */}
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <AnimatedKeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 22,
          paddingHorizontal: 22,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Breathing room between the focused input and the keyboard top.
        bottomOffset={24}
      >
        {/* ── Top row: back button + skip link ───────────────────────── */}
        <View style={styles.topRow}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [
                styles.backCircle,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <ArrowLeft size={16} color={colors.ink} strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={{ width: 38, height: 38 }} />
          )}

          {onSkip ? (
            <Pressable
              onPress={onSkip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
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
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Editorial step kicker + squiggle ───────────────────────── */}
        <View style={styles.kickerRow}>
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 10 * 0.22,
              textTransform: 'uppercase',
              color: colors.coralDeep,
            }}
          >
            STEP {String(step).padStart(2, '0')} · OF {String(totalSteps).padStart(2, '0')}
          </Text>
          <Squiggle width={36} color={colors.coral} />
        </View>

        {/* ── Title — italic Fraunces with coral period ──────────────── */}
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 30,
            lineHeight: 34,
            letterSpacing: -30 * 0.022,
            fontWeight: '500',
            color: colors.ink,
            marginTop: 14,
          }}
        >
          {title}
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>

        {body ? (
          <Text
            style={{
              fontFamily: FontFamily.regular,
              fontSize: 14,
              lineHeight: 20,
              color: colors.inkSoft,
              marginTop: 10,
              maxWidth: '94%',
            }}
          >
            {body}
          </Text>
        ) : null}

        {/* Tiny dot progress — three discs that fill coral as steps complete */}
        <View style={styles.progressDots}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              style={{
                width: i + 1 <= step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i + 1 < step
                    ? colors.coralDeep
                    : i + 1 === step
                    ? colors.coral
                    : colors.surfaceMuted,
              }}
            />
          ))}
        </View>

        {children ? <View style={{ marginTop: 24 }}>{children}</View> : null}
      </AnimatedKeyboardAwareScrollView>

      {/* ── Pinned CTA — ink fill with italic Fraunces label + arrow ─── */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
        }}
      >
        <Pressable
          onPress={ctaDisabled ? undefined : onCta}
          disabled={ctaDisabled}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: ctaDisabled ? colors.surface : colors.ink,
              borderWidth: 1,
              borderColor: ctaDisabled ? colors.line : colors.ink,
              opacity: pressed && !ctaDisabled ? 0.9 : 1,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 17,
              fontWeight: '500',
              letterSpacing: -17 * 0.014,
              color: ctaDisabled ? colors.inkMute : '#FFFFFF',
            }}
          >
            {ctaLabel}
          </Text>
          {!ctaDisabled ? (
            <ArrowRight size={16} color={colors.coral} strokeWidth={2.4} />
          ) : null}
        </Pressable>
      </View>

      {/* Glass top blur — invisible at rest (intensity 0), ramps up smoothly
          as content scrolls under the safe area. Apple Mail pattern. */}
      <TopSafeAreaBlur scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
  },
});

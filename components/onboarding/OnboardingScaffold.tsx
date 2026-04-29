// components/onboarding/OnboardingScaffold.tsx
// Clean editorial onboarding shell. No photo hero, no gradient — just bold
// typography on paper. Inspired by Revolut / Airbnb onboarding.

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { PillButton } from '@/components/ui/PillButton';
import { SectionKicker } from '@/components/ui/SectionKicker';
// PhotoTone kept as a typed prop for API back-compat; no longer used visually.
import type { PhotoTone } from '@/components/ui/Photo';

interface OnboardingScaffoldProps {
  /** 1-based step number, e.g. 1 */
  step: number;
  totalSteps: number;
  title: string;
  body?: string;
  /** @deprecated — kept for API back-compat; no longer rendered. */
  heroTone?: PhotoTone;
  /** @deprecated — kept for API back-compat; no longer rendered. */
  heroUri?: string;
  ctaLabel: string;
  onCta: () => void;
  /** When provided, "Skip" link appears top-right */
  onSkip?: () => void;
  /** Content slot — rendered below title/body, above CTA */
  children?: React.ReactNode;
  /** Disable the CTA (e.g. no selection yet). */
  ctaDisabled?: boolean;
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
}: OnboardingScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Progress indicator — N filled bars out of totalSteps, 2px rounded segments
  const progressBars = Array.from({ length: totalSteps }, (_, i) => (
    <View
      key={i}
      style={{
        flex: 1,
        height: 3,
        borderRadius: 2,
        backgroundColor: i < step ? colors.ink : colors.surfaceMuted,
      }}
    />
  ));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 16) + 8,
          paddingHorizontal: 22,
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: 'Inter_700Bold',
              fontSize: 15,
              letterSpacing: -0.2,
            }}
          >
            Visa Atlas
          </Text>
          {onSkip ? (
            <Pressable
              onPress={onSkip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text
                style={{
                  color: colors.inkMute,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 13,
                }}
              >
                Skip
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Progress bars — a subtle step indicator under the header */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}>
          {progressBars}
        </View>
      </View>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginTop: 28 }}>
          <SectionKicker>{`Step ${step} of ${totalSteps}`}</SectionKicker>
          <Text
            style={[
              Type.display32,
              {
                color: colors.ink,
                marginTop: 10,
                // Slightly tighter line-height for a display effect
                lineHeight: 38,
              },
            ]}
          >
            {title}
          </Text>
          {body ? (
            <Text
              style={[
                Type.body14,
                {
                  color: colors.inkMute,
                  marginTop: 12,
                  maxWidth: '92%',
                },
              ]}
            >
              {body}
            </Text>
          ) : null}
        </View>

        {children ? <View style={{ marginTop: 28 }}>{children}</View> : null}
      </ScrollView>

      {/* ── CTA (pinned bottom, above safe area) ───────────────────── */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.lineSoft,
        }}
      >
        <PillButton
          label={ctaLabel}
          onPress={onCta}
          fullWidth
          variant={ctaDisabled ? 'soft' : 'primary'}
        />
      </View>
    </View>
  );
}

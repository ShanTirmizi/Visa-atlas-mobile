// components/onboarding/OnboardingScaffold.tsx
// Spec-matched onboarding shell: hero photo + gradient, top bar, step kicker,
// title / body, content slot, primary CTA pill.
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Photo, PhotoTone } from '@/components/ui/Photo';
import { PillButton } from '@/components/ui/PillButton';
import { SectionKicker } from '@/components/ui/SectionKicker';

interface OnboardingScaffoldProps {
  /** 1-based step number, e.g. 1 */
  step: number;
  totalSteps: number;
  title: string;
  body?: string;
  heroTone?: PhotoTone;
  heroUri?: string;
  ctaLabel: string;
  onCta: () => void;
  /** When provided, "Skip" link appears top-right */
  onSkip?: () => void;
  /** Content slot — rendered below body, above CTA */
  children?: React.ReactNode;
}

export function OnboardingScaffold({
  step,
  totalSteps,
  title,
  body,
  heroTone = 'ocean',
  heroUri,
  ctaLabel,
  onCta,
  onSkip,
  children,
}: OnboardingScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 16 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={{ height: 360, width: '100%' }}>
          <Photo
            tone={heroTone}
            uri={heroUri}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Three-stop gradient: darken top for legibility, fade bottom to bg */}
          <LinearGradient
            colors={['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)', 'rgba(242,242,240,0.97)']}
            locations={[0, 0.42, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Top bar — wordmark + optional Skip */}
          <View
            style={{
              position: 'absolute',
              top: Math.max(insets.top, 16) + 16,
              left: 22,
              right: 22,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: 'Inter_700Bold',
                fontSize: 16,
                letterSpacing: -0.3,
              }}
            >
              Visa Atlas
            </Text>
            {onSkip && (
              <Pressable
                onPress={onSkip}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Skip onboarding"
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                  }}
                >
                  Skip
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Body content ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 22, marginTop: -24 }}>
          {/* Step kicker */}
          <SectionKicker>{`Step ${step} of ${totalSteps}`}</SectionKicker>

          {/* Title */}
          <Text
            style={[
              Type.display32,
              { color: colors.ink, marginTop: 8 },
            ]}
          >
            {title}
          </Text>

          {/* Optional body */}
          {body ? (
            <Text
              style={[
                Type.body14,
                { color: colors.inkSoft, marginTop: 10 },
              ]}
            >
              {body}
            </Text>
          ) : null}

          {/* Content slot */}
          {children ? (
            <View style={{ marginTop: 22 }}>{children}</View>
          ) : null}

          {/* Primary CTA */}
          <PillButton
            label={ctaLabel}
            onPress={onCta}
            fullWidth
            style={{ marginTop: 22 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Onboarding — Held Visas Selector (step 2 of 3)
 *
 * Data source : availableVisas from @/data/visaData
 * Context     : useVisa() — setHeldVisas(selected)
 * Navigation  : router.push('/onboarding/building')
 *
 * Business logic preserved verbatim. Visual shell replaced with
 * OnboardingScaffold.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { Shadows } from '@/constants/theme';
import { availableVisas } from '@/data/visaData';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { Type } from '@/constants/typography';

export default function VisaSelectorScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleVisa = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleContinue = useCallback(() => {
    visa.setHeldVisas([...selected]);
    router.push('/onboarding/building' as import('expo-router').Href);
  }, [selected, visa, router]);

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={3}
      heroTone="sunset"
      title="Do you hold any of these?"
      body="These can unlock visa-free travel to more countries."
      ctaLabel="Continue"
      onCta={handleContinue}
    >
      {/* Visa cards */}
      <View style={styles.cardsContainer}>
        {availableVisas.map((v) => {
          const isActive = selected.has(v.id);
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => toggleVisa(v.id)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}
              style={[
                styles.card,
                Shadows.subtle,
                {
                  backgroundColor: isActive ? colors.surfaceMuted : colors.surface,
                  borderColor: isActive ? colors.ink : colors.line,
                  borderWidth: isActive ? 1.5 : 1,
                },
              ]}
            >
              {/* Flag emoji */}
              <Text style={styles.cardFlag}>{v.flag}</Text>

              <View style={styles.cardTextWrap}>
                <Text style={[Type.title14, { color: colors.ink }]}>
                  {v.label}
                </Text>
                <Text
                  style={[
                    Type.body13,
                    { color: colors.inkMute, marginTop: 2 },
                  ]}
                  numberOfLines={2}
                >
                  {v.description}
                </Text>
              </View>

              {/* Selection indicator */}
              <View
                style={[
                  styles.checkIndicator,
                  isActive
                    ? { backgroundColor: colors.ink, borderColor: colors.ink }
                    : { backgroundColor: 'transparent', borderColor: colors.surfaceMuted },
                ]}
              >
                {isActive && (
                  <Check size={12} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* "None of these" option */}
        <TouchableOpacity
          onPress={clearAll}
          activeOpacity={0.7}
          style={[
            styles.nonePill,
            {
              backgroundColor:
                selected.size === 0 ? colors.surfaceMuted : colors.surface,
              borderColor:
                selected.size === 0 ? colors.ink : colors.line,
              borderWidth: selected.size === 0 ? 1.5 : 1,
            },
          ]}
        >
          <Text
            style={[
              Type.title14,
              {
                color:
                  selected.size === 0 ? colors.ink : colors.inkMute,
              },
            ]}
          >
            None of these
          </Text>
        </TouchableOpacity>
      </View>
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardsContainer: {
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    gap: 12,
  },
  cardFlag: {
    fontSize: 28,
  },
  cardTextWrap: {
    flex: 1,
  },
  checkIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nonePill: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 4,
  },
});

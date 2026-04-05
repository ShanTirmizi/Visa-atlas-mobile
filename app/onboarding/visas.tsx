import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { availableVisas } from '@/data/visaData';

export default function VisaSelectorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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
    router.push('/onboarding/building');
  }, [selected, visa, router]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Back button */}
      <View style={styles.backRow}>
        <BackButton />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Do you hold any of these?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          These can unlock visa-free travel to more countries
        </Text>
      </View>

      {/* Visa cards */}
      <ScrollView
        contentContainerStyle={styles.cardsContent}
        showsVerticalScrollIndicator={false}
      >
        {availableVisas.map((v) => {
          const isActive = selected.has(v.id);
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => toggleVisa(v.id)}
              activeOpacity={0.7}
              style={[
                styles.card,
                Shadows.card,
                {
                  backgroundColor: isActive ? colors.accentBg : colors.card,
                  borderColor: isActive ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={styles.cardFlag}>{v.flag}</Text>
              <View style={styles.cardTextWrap}>
                <Text style={[styles.cardLabel, { color: colors.foreground }]}>
                  {v.label}
                </Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  {v.description}
                </Text>
              </View>
              {isActive && (
                <View style={[styles.checkCircle, { backgroundColor: colors.accent }]}>
                  <Check size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* None of these pill */}
        <TouchableOpacity
          onPress={clearAll}
          activeOpacity={0.7}
          style={[
            styles.nonePill,
            {
              backgroundColor: selected.size === 0 ? colors.accentBg : colors.card,
              borderColor: selected.size === 0 ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.nonePillText,
              { color: selected.size === 0 ? colors.accent : colors.textSecondary },
            ]}
          >
            None of these
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Continue button */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.7}
          style={[styles.continueBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  cardsContent: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  cardFlag: {
    fontSize: 32,
    marginRight: 14,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  nonePill: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  nonePillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  bottomBar: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
  },
  continueBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

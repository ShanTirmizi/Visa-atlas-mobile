/**
 * Onboarding — Residence Picker (spec screen 01)
 * Step 1 of 3.
 *
 * Data source : passportCountries (Alpha-3 codes) from @/data/passportCountries
 * Context     : useVisa() — setResidence(selected)
 * Navigation  : router.push('/onboarding/visas')
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { Flag } from '@/components/ui/Flag';
import { Type } from '@/constants/typography';
import { toAlpha2 } from '@/utils/countryCode';

// ── Country row ────────────────────────────────────────────────────────────
interface CountryRowProps {
  item: PassportCountry;
  isSelected: boolean;
  onPress: (code: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function CountryRow({ item, isSelected, onPress, colors }: CountryRowProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(item.code)}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      style={[
        styles.row,
        isSelected && { backgroundColor: colors.coralBg, borderRadius: 14 },
      ]}
    >
      <Flag code={toAlpha2(item.code)} size={24} />
      <Text
        style={{
          fontFamily: 'Fraunces_500Medium_Italic',
          fontStyle: 'italic',
          fontSize: 16,
          letterSpacing: -16 * 0.012,
          color: colors.ink,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <View
        style={[
          styles.radioIndicator,
          isSelected
            ? { backgroundColor: colors.coral, borderColor: colors.coral }
            : { backgroundColor: 'transparent', borderColor: colors.line },
        ]}
      >
        {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function ResidencePickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passportCountries;
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback((code: string) => {
    setSelected((prev) => (prev === code ? null : code));
  }, []);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    visa.setResidence(selected);
    router.push('/onboarding/visas' as import('expo-router').Href);
  }, [selected, visa, router]);

  const renderItem = useCallback(
    ({ item }: { item: PassportCountry }) => (
      <CountryRow
        item={item}
        isSelected={selected === item.code}
        onPress={toggleCountry}
        colors={colors}
      />
    ),
    [selected, colors, toggleCountry],
  );

  return (
    <OnboardingScaffold
      step={2}
      totalSteps={3}
      title="Where do you live?"
      body="Residence shapes which embassy you apply through and which fast-track lanes are open to you. We'll keep this in mind."
      ctaLabel={selected ? 'Continue' : 'Pick where you live'}
      onCta={handleContinue}
      ctaDisabled={!selected}
    >
      {/* ── Spec card: surface bg, radius 20, 1px border, padding 6 ── */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Search input inside the card */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search countries..."
          placeholderTextColor={colors.inkFaint}
          autoCorrect={false}
          autoCapitalize="words"
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surfaceMuted,
              color: colors.ink,
              fontFamily: 'Inter_400Regular',
            },
          ]}
        />

        {/* Country list — rendered inline (not FlatList) for ScrollView nesting */}
        {filtered.slice(0, 50).map((item) => (
          <CountryRow
            key={item.code}
            item={item}
            isSelected={selected === item.code}
            onPress={toggleCountry}
            colors={colors}
          />
        ))}

        {filtered.length === 0 && (
          <Text style={[Type.body14, { color: colors.inkMute, textAlign: 'center', paddingVertical: 16 }]}>
            No countries found
          </Text>
        )}
      </View>
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden',
  },
  searchInput: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  radioIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Onboarding — Passport Picker (step 1 of 3)
 *
 * Data source : passportCountries (Alpha-3 codes) from @/data/passportCountries
 * Context     : useVisa() — setPassports(selected)
 * Navigation  : router.push('/onboarding/residence')
 *
 * Business logic preserved verbatim. Only the visual shell is replaced with
 * OnboardingScaffold.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { Flag } from '@/components/ui/Flag';
import { Type } from '@/constants/typography';
import { toAlpha2 } from '@/utils/countryCode';

const MAX_PASSPORTS = 3;

// ── Country row ───────────────────────────────────────────────────────────
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
      accessibilityRole="checkbox"
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
export default function PassportPickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string[]>([]);
  const [multiMode, setMultiMode] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return passportCountries;
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback(
    (code: string) => {
      setSelected((prev) => {
        if (prev.includes(code)) return prev.filter((c) => c !== code);
        if (multiMode) {
          if (prev.length >= MAX_PASSPORTS) return prev;
          return [...prev, code];
        }
        return [code]; // single-select
      });
    },
    [multiMode],
  );

  const removeChip = useCallback((code: string) => {
    setSelected((prev) => prev.filter((c) => c !== code));
  }, []);

  const toggleMultiMode = useCallback(() => {
    setMultiMode((prev) => {
      if (!prev) return true;
      setSelected((sel) => (sel.length > 0 ? [sel[0]] : []));
      return false;
    });
  }, []);

  const handleContinue = useCallback(() => {
    visa.setPassports(selected);
    router.push('/onboarding/residence' as import('expo-router').Href);
  }, [selected, visa, router]);

  const getCountryName = useCallback(
    (code: string) => passportCountries.find((c) => c.code === code)?.name ?? code,
    [],
  );

  const canContinue = selected.length >= 1;

  return (
    <OnboardingScaffold
      step={1}
      totalSteps={3}
      title="Pick your passport"
      body="Tell us which passport you carry. We'll work out the 195 countries you can visit and which ones you'll need a visa for."
      ctaLabel={canContinue ? 'Continue' : 'Pick a passport first'}
      onCta={handleContinue}
      ctaDisabled={!canContinue}
      showBack={false}
    >
      {/* ── Multi-passport toggle — italic Fraunces pill ── */}
      <TouchableOpacity
        onPress={toggleMultiMode}
        activeOpacity={0.7}
        style={[
          styles.multiPill,
          {
            backgroundColor: multiMode ? colors.coralBg : colors.surface,
            borderColor: multiMode ? colors.coralDeep : colors.line,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: 'Fraunces_500Medium_Italic',
            fontStyle: 'italic',
            fontSize: 13,
            letterSpacing: -13 * 0.012,
            color: multiMode ? colors.coralDeep : colors.inkSoft,
          }}
        >
          {multiMode ? '— Switch to single' : 'I have multiple passports →'}
        </Text>
      </TouchableOpacity>

      {/* ── Selected chips (multi-mode only) ── */}
      {multiMode && selected.length > 0 && (
        <View style={styles.chipRow}>
          {selected.map((code) => (
            <View
              key={code}
              style={[
                styles.chip,
                { backgroundColor: colors.coralBg, borderColor: colors.coral },
              ]}
            >
              <Flag code={toAlpha2(code)} size={16} />
              <Text
                style={{
                  fontFamily: 'Fraunces_500Medium_Italic',
                  fontStyle: 'italic',
                  fontSize: 13,
                  letterSpacing: -13 * 0.012,
                  color: colors.coralDeep,
                }}
              >
                {getCountryName(code)}
              </Text>
              <TouchableOpacity
                onPress={() => removeChip(code)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <X size={12} color={colors.coralDeep} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── Country list card ── */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search countries…"
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

        {filtered.slice(0, 50).map((item) => (
          <CountryRow
            key={item.code}
            item={item}
            isSelected={selected.includes(item.code)}
            onPress={toggleCountry}
            colors={colors}
          />
        ))}

        {filtered.length === 0 && (
          <Text
            style={[
              Type.body14,
              { color: colors.inkMute, textAlign: 'center', paddingVertical: 16 },
            ]}
          >
            No countries found
          </Text>
        )}
      </View>
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  multiPill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
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

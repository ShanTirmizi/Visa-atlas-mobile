import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { resolveCountry, type HeldVisaType, type CountryVisa } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { cityTemperatures } from '@/data/temperatureData';
import { VisaMap } from '@/components/map/VisaMap';
import { ExploreSheet, type CountryBrief } from '@/components/explore/ExploreSheet';
import SurpriseMeSheet, { type SurpriseMeSheetRef } from '@/components/surprise/SurpriseMeSheet';
import type { Cat } from '@/components/ui/Badge';
import { toAlpha2 } from '@/utils/countryCode';

// Map data-layer VisaCategory → Badge Cat
function toBadgeCat(category: string): Cat {
  switch (category) {
    case 'visa-free':
    case 'home':
      return 'free';
    case 'visa-on-arrival':
      return 'arrival';
    case 'evisa':
      return 'evisa';
    case 'visa-required':
    default:
      return 'required';
  }
}

// Map data-layer category string → VisaMap filter key (for passing activeFilters)
function normalizeCategoryKey(category: string): string {
  switch (category) {
    case 'visa-free':
    case 'home':
      return 'visa_free';
    case 'visa-on-arrival':
      return 'visa_on_arrival';
    case 'evisa':
      return 'e_visa';
    case 'visa-required':
    default:
      return 'visa_required';
  }
}

// Build temperature label from countryMeta capital + temperatureData
function buildTemperatureLabel(countryCode: string): string | undefined {
  const meta = countryMeta[countryCode];
  if (!meta) return undefined;
  const temps = cityTemperatures[meta.capital];
  if (!temps) return undefined;
  const month = new Date().getMonth(); // 0-indexed
  const temp = temps[month];
  return `${temp}° ${meta.capital}`;
}

// Build stay stats for StatStrip
function buildStats(country: CountryVisa, heldVisas: Set<HeldVisaType>): Array<{ label: string; value: string }> {
  const resolved = resolveCountry(country, heldVisas);
  const meta = countryMeta[country.code];
  const stats: Array<{ label: string; value: string }> = [];

  if (resolved.days != null) {
    stats.push({ label: 'Stay', value: `${resolved.days}d` });
  } else if (resolved.category === 'visa-free' || resolved.category === 'home') {
    stats.push({ label: 'Stay', value: '∞' });
  }

  if (meta) {
    stats.push({ label: 'Currency', value: meta.currencyCode });
    stats.push({ label: 'TZ', value: meta.timezone });
  }

  return stats.slice(0, 3);
}

// Convert CountryVisa to CountryBrief
function toBrief(country: CountryVisa, heldVisas: Set<HeldVisaType>): CountryBrief {
  const resolved = resolveCountry(country, heldVisas);
  const meta = countryMeta[country.code];
  const iso2 = toAlpha2(country.code);

  return {
    code: country.code,
    iso2,
    name: country.name,
    region: meta?.region ?? 'World',
    temperature: buildTemperatureLabel(country.code),
    visaCategory: toBadgeCat(resolved.category),
    stats: buildStats(country, heldVisas),
    saved: false,
  };
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const { heldVisas, favorites, toggleFavorite, passports, residence } = useVisa();
  const dynamicVisaData = useVisaData();

  const heldVisasSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  // Build CountryBrief list — exclude home/passport countries, sort alpha
  const countries = useMemo<CountryBrief[]>(() => {
    return dynamicVisaData
      .filter((c: CountryVisa) => {
        if (c.code === residence) return false;
        if (passports.includes(c.code)) return false;
        return true;
      })
      .sort((a: CountryVisa, b: CountryVisa) => a.name.localeCompare(b.name))
      .map((c: CountryVisa) => {
        const brief = toBrief(c, heldVisasSet);
        return { ...brief, saved: favorites.includes(c.code) };
      });
  }, [dynamicVisaData, heldVisasSet, favorites, passports, residence]);

  // No default selection — user picks via map, carousel, or list.
  const [selectedCode, setSelectedCode] = useState<string>('');

  // "Surprise me" sheet — multi-step picker that lands on a random country.
  const surpriseRef = useRef<SurpriseMeSheetRef>(null);
  const handleSurprisePicked = useCallback((code: string) => {
    setSelectedCode(code);
    router.push(`/country/${code}`);
  }, [router]);

  // When map taps a country (ISO-3), update selected
  const handleMapCountrySelect = useCallback((code: string) => {
    setSelectedCode(code);
  }, []);

  // When sheet selects a country, update selected
  const handleSheetSelectCountry = useCallback((code: string) => {
    setSelectedCode(code);
  }, []);

  // "View details" from featured card
  const handleViewDetails = useCallback(
    (code: string) => {
      router.push(`/country/${code}`);
    },
    [router],
  );

  // Toggle save — persists via the AsyncStorage-backed visa context; the
  // `saved` flag on each CountryBrief derives from the same `favorites` array,
  // so the heart fills/unfills live.
  const handleToggleSave = useCallback((code: string) => {
    toggleFavorite(code);
  }, [toggleFavorite]);

  // Pass empty activeFilters to map (map coloring is always all-countries in this view)
  const emptyFilters = useMemo(() => new Set<string>(), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map fills the entire background */}
      <VisaMap
        activeFilters={emptyFilters}
        heldVisas={new Set(heldVisas)}
        onCountrySelect={handleMapCountrySelect}
        selectedCountry={selectedCode}
        sheetCollapsed={false}
        countries={dynamicVisaData}
      />

      {/* Persistent bottom sheet overlay */}
      <ExploreSheet
        countries={countries}
        selectedCode={selectedCode}
        onSelectCountry={handleSheetSelectCountry}
        onViewDetails={handleViewDetails}
        onToggleSave={handleToggleSave}
        onSurpriseMe={() => surpriseRef.current?.present()}
      />

      {/* Surprise me — multi-step picker that lands on a random country
          tailored to the user's vibes/prefs. */}
      <SurpriseMeSheet
        ref={surpriseRef}
        heldVisas={heldVisasSet}
        onCountrySelected={handleSurprisePicked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

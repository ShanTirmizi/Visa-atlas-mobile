import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { resolveCountry, type HeldVisaType, type CountryVisa } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { cityTemperatures } from '@/data/temperatureData';
import { VisaMap } from '@/components/map/VisaMap';
import { ExploreSheet, type CountryBrief } from '@/components/explore/ExploreSheet';
import SurpriseMeSheet, { type SurpriseMeSheetRef } from '@/components/surprise/SurpriseMeSheet';
import type { Cat } from '@/components/ui/Badge';
import { VISA_CATEGORIES, getVisaCategoryColor } from '@/constants/categories';
import { Shadows } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { hapticSelect } from '@/utils/haptics';
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

// ──────────────────────────────────────────────
// MapKeyLegend — Apple Maps-style key for the choropleth fills.
// Compact mono kickers + 8px rounded-square swatches in the exact colors
// VisaMap paints with (same getVisaCategoryColor + theme tokens, so it
// tracks dark mode automatically). Rests 12px above the ExploreSheet's
// collapsed (30%) top edge; the sheet slides over it when expanded —
// same behavior as Apple Maps' overlaid chrome. Static/informational:
// pointerEvents="none" so map pans/taps pass straight through.
// ──────────────────────────────────────────────
const LEGEND_LABELS: Record<string, string> = {
  visa_free: 'VISA-FREE',
  visa_on_arrival: 'ON ARRIVAL',
  e_visa: 'E-VISA',
  visa_required: 'REQUIRED',
};

function MapKeyLegend() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // ExploreSheet uses snapPoints ['30%','70%','100%'] with
  // topInset = insets.top + 10; gorhom resolves percentages against the
  // container height minus topInset. Mirror that math so the legend sits
  // just above the collapsed sheet's top edge.
  const collapsedSheetHeight = 0.3 * (winH - (insets.top + 10));

  return (
    <View
      pointerEvents="none"
      style={[styles.legendWrap, { bottom: collapsedSheetHeight + 12 }]}
    >
      <View
        style={[
          styles.legendPill,
          Shadows.circle,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        {VISA_CATEGORIES.map((cat) => (
          <View key={cat.key} style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                { backgroundColor: getVisaCategoryColor(cat.key, colors) },
              ]}
            />
            <Text
              style={[
                Type.mono9,
                { fontSize: 8, letterSpacing: 8 * 0.12, color: colors.inkMute },
              ]}
            >
              {LEGEND_LABELS[cat.key] ?? cat.shortLabel.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
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
    // Selection haptic — picking/unpicking a favorite, per the app's
    // centralized haptic vocabulary (utils/haptics.ts).
    hapticSelect();
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

      {/* Map color key — mounted before ExploreSheet so the expanding
          sheet slides over it (Apple Maps overlaid-chrome behavior). */}
      <MapKeyLegend />

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
  legendWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2.5,
  },
});

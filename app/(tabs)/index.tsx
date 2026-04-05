import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from '@/constants/theme';
import {
  VISA_CATEGORIES,
  getVisaCategoryColor,
  type VisaCategoryConfig,
} from '@/constants/categories';
import {
  visaData,
  resolveCountry,
  type CountryVisa,
  type HeldVisaType,
  type VisaCategory as DataVisaCategory,
} from '@/data/visaData';
import { VisaMap } from '@/components/map/VisaMap';
import SearchBar from '@/components/ui/SearchBar';
import Chip from '@/components/ui/Chip';
import CountryList from '@/components/country/CountryList';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map data-layer category (visa-free) to UI category key (visa_free)
function normalizeCategoryKey(category: DataVisaCategory | string): string {
  switch (category) {
    case 'visa-free':
      return 'visa_free';
    case 'visa-on-arrival':
      return 'visa_on_arrival';
    case 'evisa':
      return 'e_visa';
    case 'visa-required':
      return 'visa_required';
    case 'home':
      return 'visa_free';
    default:
      return 'visa_required';
  }
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [sheetIndex, setSheetIndex] = useState(0);

  // Context
  const { heldVisas, favorites, visited, toggleFavorite } = useVisa();

  // Convert held visas to the typed set used by resolveCountry
  const heldVisasSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  // Filter and sort countries
  const filteredCountries = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return visaData
      .filter((country: CountryVisa) => {
        // Skip home country
        if (country.code === 'IND') return false;

        // Search filter
        if (query && !country.name.toLowerCase().includes(query)) {
          return false;
        }

        // Category filter
        if (activeFilters.size > 0) {
          const resolved = resolveCountry(country, heldVisasSet);
          const uiKey = normalizeCategoryKey(resolved.category);
          if (!activeFilters.has(uiKey)) {
            return false;
          }
        }

        return true;
      })
      .sort((a: CountryVisa, b: CountryVisa) => a.name.localeCompare(b.name));
  }, [searchQuery, activeFilters, heldVisasSet]);

  // Also build the set for the map (same active filters)
  const mapActiveFilters = activeFilters;

  // Handlers
  const handleCountrySelect = useCallback(
    (code: string) => {
      router.push(`/country/${code}`);
    },
    [router],
  );

  const handleToggleFavorite = useCallback(
    (code: string) => {
      toggleFavorite(code);
    },
    [toggleFavorite],
  );

  const handleToggleFilter = useCallback((filterKey: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterKey)) {
        next.delete(filterKey);
      } else {
        next.add(filterKey);
      }
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters(new Set());
  }, []);

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['25%', '60%', '90%'], []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map fills the background */}
      <View style={[styles.mapContainer, { paddingTop: insets.top }]}>
        <VisaMap
          activeFilters={mapActiveFilters}
          heldVisas={new Set(heldVisas)}
          onCountrySelect={handleCountrySelect}
          sheetCollapsed={sheetIndex === 0}
        />
      </View>

      {/* Bottom sheet with search, filters, and country list */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: colors.background },
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: colors.textMuted },
        ]}
        enablePanDownToClose={false}
        onChange={setSheetIndex}
      >
        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Explore
          </Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search countries..."
          />
        </View>

        {/* Filter chips */}
        <View style={styles.chipsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {/* "All" chip */}
            <Chip
              label="All"
              color={colors.primary}
              active={activeFilters.size === 0}
              onPress={handleClearFilters}
            />

            {/* Category chips */}
            {VISA_CATEGORIES.map((cat: VisaCategoryConfig) => (
              <Chip
                key={cat.key}
                label={cat.shortLabel}
                color={getVisaCategoryColor(cat.key, colors)}
                active={activeFilters.has(cat.key)}
                onPress={() => handleToggleFilter(cat.key)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Country list */}
        <CountryList
          countries={filteredCountries}
          heldVisas={heldVisasSet}
          favorites={favorites}
          visited={visited}
          onCountrySelect={handleCountrySelect}
          onToggleFavorite={handleToggleFavorite}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
  sheetBackground: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  chipsContainer: {
    paddingBottom: Spacing.sm,
  },
  chipsContent: {
    paddingHorizontal: Spacing.lg,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius, Spacing } from '@/constants/theme';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge } from '@/components/ui/Badge';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { CountryCarousel } from './CountryCarousel';
import { FeaturedCountryCard } from './FeaturedCountryCard';
import type { FeaturedCountryProps } from './FeaturedCountryCard';
import type { PhotoTone } from '@/components/ui/Photo';
import type { Cat } from '@/components/ui/Badge';

export interface CountryBrief {
  code: string;       // ISO-3 (e.g. "JPN")
  iso2: string;       // ISO-2 for flag (e.g. "JP")
  name: string;
  region: string;
  tagline?: string;
  temperature?: string;
  visaCategory: Cat;
  photoUri?: string;
  photoTone?: PhotoTone;
  stats: Array<{ label: string; value: string }>;
  saved?: boolean;
}

interface ExploreSheetProps {
  countries: CountryBrief[];
  selectedCode: string;
  onSelectCountry: (code: string) => void;
  onViewDetails: (code: string) => void;
  onToggleSave: (code: string) => void;
}

const FILTER_OPTIONS = ['All', 'Visa-free', 'On arrival', 'E-visa'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ExploreSheet({
  countries,
  selectedCode,
  onSelectCountry,
  onViewDetails,
  onToggleSave,
}: ExploreSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [filter, setFilter] = useState('All');

  const snapPoints = useMemo(() => ['30%', '70%', '92%'], []);

  // When the user picks a country (from the map OR the carousel), expand
  // the sheet to the mid snap so the featured card is visible. We skip the
  // initial mount to avoid fighting the default collapsed position.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (selectedCode) {
      bottomSheetRef.current?.snapToIndex(1);
    }
  }, [selectedCode]);

  // Featured country (selected or first)
  const featured = useMemo<CountryBrief | undefined>(
    () => countries.find((c) => c.code === selectedCode) ?? countries[0],
    [countries, selectedCode],
  );

  // Countries shown in the "MORE DESTINATIONS" list (all except featured)
  const moreCountries = useMemo(() => {
    const filtered = filter === 'All'
      ? countries
      : countries.filter((c) => {
          if (filter === 'Visa-free') return c.visaCategory === 'free';
          if (filter === 'On arrival') return c.visaCategory === 'arrival';
          if (filter === 'E-visa') return c.visaCategory === 'evisa';
          return true;
        });
    return filtered.filter((c) => c.code !== featured?.code);
  }, [countries, filter, featured]);

  const handleCarouselSelect = useCallback(
    (code: string) => {
      onSelectCountry(code);
    },
    [onSelectCountry],
  );

  const featuredCardProps = useMemo<FeaturedCountryProps | null>(() => {
    if (!featured) return null;
    return {
      country: featured,
      onViewDetails: () => onViewDetails(featured.code),
      onToggleSave: () => onToggleSave(featured.code),
    };
  }, [featured, onViewDetails, onToggleSave]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      {/* Kicker */}
      <SectionKicker style={styles.kicker}>Explore</SectionKicker>

      {/* Carousel */}
      <View style={styles.carouselWrapper}>
        <CountryCarousel
          countries={countries}
          selectedCode={selectedCode}
          onSelect={handleCarouselSelect}
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          variant="pill"
        />
      </View>

      {/* Featured card */}
      {featuredCardProps ? (
        <View style={styles.featuredWrapper}>
          <FeaturedCountryCard {...featuredCardProps} />
        </View>
      ) : null}

      {/* More destinations kicker */}
      <SectionKicker style={styles.moreSectionKicker}>
        More Destinations
      </SectionKicker>
    </View>
  ), [countries, selectedCode, handleCarouselSelect, filter, featuredCardProps]);

  const renderItem = useCallback(
    ({ item }: { item: CountryBrief }) => (
      <Pressable
        onPress={() => onViewDetails(item.code)}
        style={({ pressed }) => [
          styles.listRow,
          { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Flag code={item.iso2} size={40} />
        <View style={styles.listRowContent}>
          <Text style={[Type.title14, { color: colors.ink }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[Type.meta11, { color: colors.inkMute, marginTop: 2 }]} numberOfLines={1}>
            {item.region}
          </Text>
        </View>
        <VisaBadge
          cat={item.visaCategory}
          size="sm"
          style={{ alignSelf: 'center' }}
        />
        <DarkOrb size={32} muted>
          <ArrowRight size={13} color={colors.ink} strokeWidth={2} />
        </DarkOrb>
      </Pressable>
    ),
    [colors, onViewDetails],
  );

  const keyExtractor = useCallback((item: CountryBrief) => item.code, []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={[
        styles.sheetBackground,
        { backgroundColor: colors.background },
      ]}
      handleIndicatorStyle={styles.handleIndicator}
      enablePanDownToClose={false}
    >
      <BottomSheetFlatList
        data={moreCountries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
  },
  handleIndicator: {
    backgroundColor: '#9E9E9E',
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingBottom: 8,
  },
  kicker: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 4,
  },
  carouselWrapper: {
    marginTop: 12,
    marginBottom: 16,
  },
  filterRow: {
    paddingHorizontal: 22,
    marginBottom: 4,
  },
  featuredWrapper: {
    marginHorizontal: 22,
    marginBottom: 8,
  },
  moreSectionKicker: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 0,
  },
  listRowContent: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 22,
  },
});

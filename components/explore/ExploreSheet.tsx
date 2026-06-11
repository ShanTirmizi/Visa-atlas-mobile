import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import BottomSheet, {
  BottomSheetFlatList,
  // BottomSheetTextInput so gorhom's keyboard handling engages on focus —
  // a plain RN TextInput is invisible to the sheet, so at the 30% snap the
  // keyboard fully covered the search field.
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ArrowRight, Sparkles, Search, X } from 'lucide-react-native';
import { popularityRank } from '@/data/popularDestinations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Radius, FontFamily } from '@/constants/theme';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge } from '@/components/ui/Badge';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Squiggle } from '@/components/ui/Squiggle';
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
  /** Open the Surprise Me sheet — a multi-step picker that lands on a random
   *  country matching the user's vibes. Optional so existing call sites stay
   *  compatible. */
  onSurpriseMe?: () => void;
}

const FILTER_OPTIONS = ['All', 'Visa-free', 'On arrival', 'E-visa'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ExploreSheet({
  countries,
  selectedCode,
  onSelectCountry,
  onViewDetails,
  onToggleSave,
  onSurpriseMe,
}: ExploreSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Carousel data — popular tourist destinations first (UNWTO-ish ordering),
  // everything else excluded so users see Bali / Tokyo / Paris up front
  // instead of Afghanistan / Albania / Algeria.
  const popularCountries = useMemo(
    () =>
      [...countries]
        .filter((c) => Number.isFinite(popularityRank(c.code)))
        .sort((a, b) => popularityRank(a.code) - popularityRank(b.code)),
    [countries],
  );

  // Snap points are percentages of the area BELOW topInset, so a 100% snap
  // stops cleanly under the Dynamic Island / camera area.
  const snapPoints = useMemo(() => ['30%', '70%', '100%'], []);
  // topInset pushes the sheet's max top position down by this many pixels —
  // gorhom respects it for all snap points.
  const sheetTopInset = insets.top + 10;

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

  // Featured country — only when the user has actively picked one.
  // No hard-coded default; empty state shows a prompt instead.
  const featured = useMemo<CountryBrief | undefined>(
    () => (selectedCode ? countries.find((c) => c.code === selectedCode) : undefined),
    [countries, selectedCode],
  );

  // Countries shown in the "MORE DESTINATIONS" list — alphabetical, with
  // visa-category filter chip + search query both applied.
  const moreCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = filter === 'All'
      ? countries
      : countries.filter((c) => {
          if (filter === 'Visa-free') return c.visaCategory === 'free';
          if (filter === 'On arrival') return c.visaCategory === 'arrival';
          if (filter === 'E-visa') return c.visaCategory === 'evisa';
          return true;
        });
    return filtered
      .filter((c) => c.code !== featured?.code)
      .filter((c) => !q || c.name.toLowerCase().includes(q));
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
      {/* Editorial header — kicker → italic display + Surprise me CTA */}
      <View style={styles.editorialHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[Type.kicker, { color: colors.inkMute }]}>EXPLORE</Text>
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 26,
              fontWeight: '500',
              letterSpacing: -26 * 0.02,
              lineHeight: 26,
              color: colors.ink,
              marginTop: 2,
            }}
          >
            Where to{' '}
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
              }}
            >
              next
            </Text>
            <Text style={{ color: colors.coral }}>?</Text>
          </Text>
        </View>
        {onSurpriseMe ? (
          <Pressable
            onPress={onSurpriseMe}
            accessibilityRole="button"
            accessibilityLabel="Surprise me"
            style={({ pressed }) => [
              styles.surprisePill,
              {
                backgroundColor: colors.coral,
                shadowColor: colors.coral,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Sparkles size={14} color="#FFFFFF" strokeWidth={2} />
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 13,
                fontWeight: '600',
                color: '#FFFFFF',
              }}
            >
              Surprise me
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Carousel — popular destinations only, ordered by tourism popularity */}
      <View style={styles.carouselWrapper}>
        <CountryCarousel
          countries={popularCountries}
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

      {/* Featured card — or empty-state hint when nothing picked */}
      {featuredCardProps ? (
        <View style={styles.featuredWrapper}>
          <FeaturedCountryCard {...featuredCardProps} />
        </View>
      ) : (
        <View
          style={[
            styles.emptyState,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 17,
              fontWeight: '500',
              color: colors.ink,
              textAlign: 'center',
            }}
          >
            Tap a country
          </Text>
          <Squiggle
            width={70}
            color={colors.coral}
            style={{ alignSelf: 'center', marginTop: 6 }}
          />
          <Text
            style={[
              Type.body13,
              { color: colors.inkMute, textAlign: 'center', marginTop: 8 },
            ]}
          >
            Pick any country on the map, the carousel above, or the list below.
          </Text>
        </View>
      )}

      {/* More destinations — italic display */}
      <View style={styles.moreSectionWrap}>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: '500',
            color: colors.ink,
            letterSpacing: -17 * 0.012,
          }}
        >
          More destinations
        </Text>
        <Text
          style={[
            Type.kickerSm,
            { color: colors.inkMute, marginLeft: 'auto', fontSize: 9 },
          ]}
        >
          {countries.length} ON ATLAS
        </Text>
      </View>

      {/* Search bar — narrows the alphabetical list */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Search size={16} color={colors.inkMute} />
          <BottomSheetTextInput
            style={[
              styles.searchInput,
              { color: colors.ink, fontFamily: FontFamily.regular },
            ]}
            placeholder="Search countries"
            placeholderTextColor={colors.inkFaint}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={14} color={colors.inkMute} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  ), [
    countries,
    popularCountries,
    selectedCode,
    handleCarouselSelect,
    filter,
    featuredCardProps,
    colors,
    search,
  ]);

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
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: '500',
              color: colors.ink,
              letterSpacing: -15 * 0.012,
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.inkMute, marginTop: 2, fontSize: 9 },
            ]}
            numberOfLines={1}
          >
            {item.region.toUpperCase()}
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
      topInset={sheetTopInset}
      backgroundStyle={[
        styles.sheetBackground,
        { backgroundColor: colors.background },
      ]}
      handleIndicatorStyle={styles.handleIndicator}
      enablePanDownToClose={false}
      // Same recipe as VisaChatSheet: "extend" raises the sheet to its top
      // snap when the search field focuses (the field rests in the bottom
      // third at the 30% detent, where the keyboard would cover it),
      // "restore" returns it on dismiss, and adjustResize is gorhom's
      // documented Android requirement with edge-to-edge.
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
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
  editorialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 6,
  },
  surprisePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
    marginTop: 6,
  },
  carouselWrapper: {
    marginTop: 8,
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
  emptyState: {
    marginHorizontal: 22,
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
  },
  searchWrap: {
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  moreSectionWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
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

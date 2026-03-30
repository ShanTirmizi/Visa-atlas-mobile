import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import type { CountryVisa, HeldVisaType } from '@/data/visaData';
import CountryCard from './CountryCard';

interface CountryListProps {
  countries: CountryVisa[];
  heldVisas: Set<HeldVisaType>;
  favorites: string[];
  visited: string[];
  onCountrySelect: (code: string) => void;
  onToggleFavorite: (code: string) => void;
}

export default function CountryList({
  countries,
  heldVisas,
  favorites,
  visited,
  onCountrySelect,
  onToggleFavorite,
}: CountryListProps) {
  const { colors } = useTheme();

  const favoritesSet = new Set(favorites);
  const visitedSet = new Set(visited);

  const renderItem = useCallback(
    ({ item }: { item: CountryVisa }) => (
      <CountryCard
        country={item}
        heldVisas={heldVisas}
        isFavorite={favoritesSet.has(item.code)}
        isVisited={visitedSet.has(item.code)}
        onPress={() => onCountrySelect(item.code)}
        onToggleFavorite={() => onToggleFavorite(item.code)}
      />
    ),
    [heldVisas, favoritesSet, visitedSet, onCountrySelect, onToggleFavorite],
  );

  const keyExtractor = useCallback(
    (item: CountryVisa) => item.code,
    [],
  );

  const ListHeaderComponent = useCallback(
    () => (
      <View style={styles.header}>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {countries.length} {countries.length === 1 ? 'country' : 'countries'}
        </Text>
      </View>
    ),
    [countries.length, colors.textSecondary],
  );

  const ItemSeparatorComponent = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  return (
    <BottomSheetFlatList
      data={countries}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={ItemSeparatorComponent}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 120, // Account for floating tab bar (68px) + bottom inset + spacing
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  countText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    height: 0,
  },
});

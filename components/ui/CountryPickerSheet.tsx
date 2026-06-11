import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  // BottomSheetTextInput so gorhom's keyboard handling engages on focus —
  // a plain RN TextInput is invisible to the sheet.
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Search, X } from 'lucide-react-native';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, getVisaCategoryColor } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';
import { Flag } from '@/components/ui/Flag';
import {
  visaData,
  resolveCountry,
  type CountryVisa,
  type HeldVisaType,
} from '@/data/visaData';
import { toAlpha2 } from '@/utils/countryCode';

export interface CountryPickerSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  /** Called with the selected country's ISO-3 code. */
  onSelect: (code: string, name: string) => void;
  /** Optional country codes to exclude from the list. */
  excludeCodes?: string[];
  /** Held visas, used to render the resolved category pill on each row. */
  heldVisas?: Set<HeldVisaType>;
  /** Title shown at the top of the sheet — italic Fraunces. */
  title?: string;
  /** Mono kicker shown above the title. */
  kicker?: string;
}

/** Premium country picker bottom sheet — italic Fraunces title with a
 *  coral period, mono kicker + coral squiggle, soft paper search box,
 *  italic Fraunces country names, visa-category pills. Used by Guides
 *  Start-application flow and any screen that needs a country pick. */
export const CountryPickerSheet = forwardRef<CountryPickerSheetRef, Props>(
  (
    {
      onSelect,
      excludeCodes = [],
      heldVisas,
      title = 'Pick a country',
      kicker = 'SELECT',
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);
    const [search, setSearch] = useState('');

    useImperativeHandle(ref, () => ({
      open: () => {
        setSearch('');
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }));

    const heldSet = useMemo(
      () => heldVisas ?? new Set<HeldVisaType>(),
      [heldVisas],
    );

    const excludeSet = useMemo(
      () => new Set(excludeCodes.map((c) => c.toUpperCase())),
      [excludeCodes],
    );

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      return visaData
        .filter((c) => c.category !== 'home')
        .filter((c) => !excludeSet.has(c.code.toUpperCase()))
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, [search, excludeSet]);

    const handleSelect = useCallback(
      (country: CountryVisa) => {
        onSelect(country.code, country.name);
        sheetRef.current?.dismiss();
      },
      [onSelect],
    );

    const renderItem = useCallback(
      ({ item }: { item: CountryVisa }) => {
        const resolved = resolveCountry(item, heldSet);
        const catColor = getVisaCategoryColor(resolved.category, colors);
        const alpha2 = toAlpha2(item.code);
        const label =
          resolved.category === 'visa-free'
            ? 'Visa-free'
            : resolved.category === 'visa-on-arrival'
            ? 'On arrival'
            : resolved.category === 'evisa'
            ? 'eVisa'
            : 'Visa req.';
        return (
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                borderBottomColor: colors.line,
              },
            ]}
          >
            <View style={styles.flagWrap}>
              <Flag code={alpha2} size={28} />
            </View>
            <Text
              style={[
                styles.rowName,
                { color: colors.ink },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View
              style={[
                styles.catPill,
                { backgroundColor: catColor + '1F' },
              ]}
            >
              <View
                style={[styles.catDot, { backgroundColor: catColor }]}
              />
              <Text
                style={[styles.catLabel, { color: catColor }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      },
      [colors, heldSet, handleSelect],
    );

    return (
      // "extend" raises the sheet to its top position on focus so the
      // results list shrinks above the keyboard and stays fully scrollable
      // while typing (VisaChatSheet recipe; restore/adjustResize come from
      // AppBottomSheet's defaults).
      <AppBottomSheet ref={sheetRef} keyboardBehavior="extend">
        <View style={styles.header}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <Text
              style={[
                styles.kicker,
                { color: colors.inkMute, letterSpacing: 11 * 0.22 },
              ]}
            >
              {kicker}
            </Text>
            <Squiggle width={40} color={colors.coral} />
          </View>

          <Text
            style={[
              styles.title,
              { color: colors.ink, letterSpacing: -28 * 0.022 },
            ]}
          >
            <Text style={styles.titleItalic}>{title}</Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>

          {/* Search */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.line,
              },
            ]}
          >
            <Search size={16} color={colors.inkMute} />
            <BottomSheetTextInput
              style={[
                styles.searchInput,
                { color: colors.ink },
              ]}
              placeholder="Search countries…"
              placeholderTextColor={colors.inkFaint}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <X size={14} color={colors.inkMute} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(item: CountryVisa) => item.code}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: colors.inkMute,
                  textAlign: 'center',
                }}
              >
                No matches.
              </Text>
            </View>
          }
        />
      </AppBottomSheet>
    );
  },
);

CountryPickerSheet.displayName = 'CountryPickerSheet';
export default CountryPickerSheet;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 14,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
    marginBottom: 14,
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flagWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rowName: {
    flex: 1,
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -17 * 0.014,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: -11 * 0.005,
  },
  emptyWrap: {
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
});

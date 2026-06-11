import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import { passportCountries, type PassportCountry } from '@/data/passportCountries';
import BackButton from '@/components/ui/BackButton';
import { toAlpha2 } from '@/utils/countryCode';

// ── Alpha-3 to flag emoji ────────────────────────────────────────────
function getFlag(alpha3: string): string {
  const a2 = toAlpha2(alpha3);
  if (!a2 || a2.length !== 2) return '';
  return String.fromCodePoint(
    ...a2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export default function EditResidenceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const visa = useVisa();

  const [selected, setSelected] = useState<string | null>(visa.residence);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return passportCountries;
    const q = search.trim().toLowerCase();
    return passportCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const toggleCountry = useCallback((code: string) => {
    setSelected((prev) => (prev === code ? null : code));
  }, []);

  const handleSave = useCallback(() => {
    if (!selected) return;
    visa.setResidence(selected);
    router.back();
  }, [selected, visa, router]);

  const renderItem = useCallback(({ item }: { item: PassportCountry }) => {
    const isSelected = selected === item.code;
    return (
      <TouchableOpacity
        onPress={() => toggleCountry(item.code)}
        activeOpacity={0.7}
        style={[
          styles.row,
          {
            backgroundColor: isSelected ? colors.accent : colors.card,
            borderColor: isSelected ? colors.accent : colors.border,
          },
        ]}
      >
        <Text style={styles.flag}>{getFlag(item.code)}</Text>
        <Text
          style={[
            styles.countryName,
            { color: isSelected ? '#FFFFFF' : colors.foreground },
          ]}
        >
          {item.name}
        </Text>
        {isSelected && (
          <View style={[styles.checkWrap, { backgroundColor: colors.solidOverlayMd }]}>
            <Check size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selected, colors, toggleCountry]);

  const canSave = selected !== null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Back button */}
      <View style={styles.backWrap}>
        <BackButton />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Edit Residence
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your residence affects where you apply for visas and which benefits you qualify for
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search countries..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.card,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
      />

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={!canSave}
          style={[
            styles.saveBtn,
            {
              backgroundColor: canSave ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.saveBtnText, { opacity: canSave ? 1 : 0.5 }]}>
            Save
          </Text>
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
  backWrap: {
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
  searchWrap: {
    marginBottom: Spacing.md,
  },
  searchInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  listContent: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    flex: 1,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
  },
  saveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

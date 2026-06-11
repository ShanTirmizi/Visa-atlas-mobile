import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { BackButton } from '@/components/ui/BackButton';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';

export default function VisitedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { visited } = useVisa();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backBtnWrap}>
          <BackButton />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Visited Countries
        </Text>

        {visited.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin color={colors.textMuted} size={40} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No visited countries yet. Mark countries as visited from the country detail page.
            </Text>
          </View>
        ) : (
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {visited.length} countries visited
          </Text>
        )}
      </ScrollView>

      <TopSafeAreaBlur />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  backBtnWrap: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    maxWidth: 280,
  },
});

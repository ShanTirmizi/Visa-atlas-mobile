import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function VisitedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { visited } = useVisa();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
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

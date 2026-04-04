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
import { ArrowLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { availableVisas } from '@/data/visaData';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function VisasScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { heldVisas, toggleHeldVisa } = useVisa();

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
        Held Visas
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Toggle visas you currently hold. This affects visa requirements shown for each country.
      </Text>

      <View style={styles.visaList}>
        {availableVisas.map((visa) => {
          const isHeld = heldVisas.includes(visa.id);
          return (
            <TouchableOpacity
              key={visa.id}
              style={[
                styles.visaItem,
                {
                  backgroundColor: isHeld ? colors.primary : colors.shimmer,
                  borderColor: isHeld ? colors.primary : colors.borderSubtle,
                  borderWidth: isHeld ? 0 : 1,
                },
              ]}
              onPress={() => toggleHeldVisa(visa.id)}
              activeOpacity={0.7}
            >
              <View style={styles.visaInfo}>
                <View
                  style={[
                    styles.visaDot,
                    { backgroundColor: isHeld ? '#FFFFFF' : colors.textMuted },
                  ]}
                />
                <View>
                  <Text style={[styles.visaName, { color: isHeld ? '#FFFFFF' : colors.foreground }]}>
                    {visa.label}
                  </Text>
                  <Text style={[styles.visaCount, { color: isHeld ? 'rgba(255,255,255,0.70)' : colors.textSecondary }]}>
                    {visa.description}
                  </Text>
                </View>
              </View>
              {isHeld ? (
                <Check color="#FFFFFF" size={20} />
              ) : (
                <View
                  style={[styles.uncheckedCircle, { borderColor: colors.textMuted }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
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
  visaList: {
    gap: Spacing.sm,
  },
  visaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  visaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  visaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  visaName: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
  visaCount: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  uncheckedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});

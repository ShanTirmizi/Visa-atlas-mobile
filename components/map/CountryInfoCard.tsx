import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  getVisaCategoryColor,
  getVisaCategoryShortLabel,
  type VisaCategory,
} from '@/constants/categories';
import { toAlpha2 } from '@/utils/countryCode';

// Alpha-3 → flag emoji
function getFlag(alpha3: string): string {
  const a2 = toAlpha2(alpha3);
  if (!a2 || a2.length !== 2) return '';
  return String.fromCodePoint(
    ...a2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

interface CountryInfoCardProps {
  code: string;
  name: string;
  categoryKey: VisaCategory;
  maxStay?: number;
  onViewDetails: () => void;
}

export default function CountryInfoCard({
  code,
  name,
  categoryKey,
  maxStay,
  onViewDetails,
}: CountryInfoCardProps) {
  const { colors } = useTheme();
  const catColor = getVisaCategoryColor(categoryKey, colors);
  const catLabel = getVisaCategoryShortLabel(categoryKey);
  const flag = getFlag(code);

  return (
    <Animated.View
      entering={SlideInDown.duration(250).springify()}
      exiting={SlideOutDown.duration(200)}
      style={[styles.container, Shadows.card, { backgroundColor: colors.card }]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onViewDetails}
        style={styles.content}
      >
        <Text style={styles.flag}>{flag}</Text>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: catColor + '20' }]}>
              <View style={[styles.badgeDot, { backgroundColor: catColor }]} />
              <Text style={[styles.badgeText, { color: catColor }]}>{catLabel}</Text>
            </View>
            {maxStay != null && maxStay > 0 && (
              <Text style={[styles.maxStay, { color: colors.textMuted }]}>
                {maxStay}d max
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Dimensions.get('window').height * 0.27,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 12,
  },
  flag: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  maxStay: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

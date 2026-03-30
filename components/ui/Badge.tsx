import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import type { VisaCategory } from '@/data/visaData';

interface BadgeProps {
  category: VisaCategory;
  size?: 'sm' | 'md';
}

function getCategoryLabel(category: VisaCategory): string {
  switch (category) {
    case 'visa-free':
      return 'Visa Free';
    case 'visa-on-arrival':
      return 'On Arrival';
    case 'evisa':
      return 'eVisa';
    case 'visa-required':
      return 'Visa Required';
    case 'home':
      return 'Home';
    default:
      return category;
  }
}

function getCategoryColor(category: VisaCategory, colors: ThemeColors): string {
  switch (category) {
    case 'visa-free':
      return colors.visaFree;
    case 'visa-on-arrival':
      return colors.visaOnArrival;
    case 'evisa':
      return colors.evisa;
    case 'visa-required':
      return colors.visaRequired;
    case 'home':
      return colors.primary;
    default:
      return colors.textMuted;
  }
}

function getCategoryBgColor(category: VisaCategory, colors: ThemeColors): string {
  switch (category) {
    case 'visa-free':
      return colors.visaFreeBg;
    case 'visa-on-arrival':
      return colors.visaOnArrivalBg;
    case 'evisa':
      return colors.evisaBg;
    case 'visa-required':
      return colors.visaRequiredBg;
    case 'home':
      return colors.primaryBg;
    default:
      return colors.shimmer;
  }
}

export default function Badge({ category, size = 'md' }: BadgeProps) {
  const { colors } = useTheme();
  const color = getCategoryColor(category, colors);
  const bgColor = getCategoryBgColor(category, colors);
  const label = getCategoryLabel(category);
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
          paddingVertical: isSmall ? 2 : Spacing.xs,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: isSmall ? FontSize.xs : FontSize.sm,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FontFamily.condensedSemibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

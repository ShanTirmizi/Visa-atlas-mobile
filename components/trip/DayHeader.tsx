import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

interface DayHeaderProps {
  dayNumber: number;
  title: string;
}

export default function DayHeader({ dayNumber, title }: DayHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Text style={styles.badgeText}>DAY {dayNumber}</Text>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
  },
});

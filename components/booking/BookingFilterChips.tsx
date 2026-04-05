import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Spacing, Radius } from '@/constants/theme';
import { BOOKING_TYPE_LIST, BOOKING_TYPES, type BookingType } from '@/constants/bookings';

interface BookingFilterChipsProps {
  activeFilter: BookingType | 'all';
  onFilterChange: (filter: BookingType | 'all') => void;
}

const FILTERS: { key: BookingType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...BOOKING_TYPE_LIST.map((t) => ({ key: t, label: BOOKING_TYPES[t].label + 's' })),
];

function BookingFilterChips({
  activeFilter,
  onFilterChange,
}: BookingFilterChipsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map(({ key, label }) => {
        const isActive = activeFilter === key;
        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.7}
            onPress={() => onFilterChange(key)}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: colors.accent }
                : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default React.memo(BookingFilterChips);

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  chipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
  },
});

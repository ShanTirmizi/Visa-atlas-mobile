import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  BOOKING_TYPE_LIST,
  BOOKING_TYPES,
  type BookingType,
} from '@/constants/bookings';
import ScanBooking from './ScanBooking';
import type { BookingFormData } from './BookingForm';

interface BookingTypePickerProps {
  onSelect: (type: BookingType) => void;
  onScanComplete: (type: BookingType, data: Partial<BookingFormData>) => void;
}

export default function BookingTypePicker({ onSelect, onScanComplete }: BookingTypePickerProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <ScanBooking onScanComplete={onScanComplete} />

      <Text style={[styles.title, { color: colors.foreground }]}>
        What are you booking?
      </Text>

      <View style={styles.grid}>
        {BOOKING_TYPE_LIST.map((type) => {
          const config = BOOKING_TYPES[type];
          const typeColor = isDark ? config.darkColor : config.color;
          const Icon = config.icon;

          return (
            <TouchableOpacity
              key={type}
              activeOpacity={0.7}
              onPress={() => onSelect(type)}
              style={[
                styles.tile,
                Shadows.subtle,
                {
                  backgroundColor: typeColor,
                  borderColor: 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: 'rgba(255,255,255,0.2)' },
                ]}
              >
                <Icon size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.label, { color: '#FFFFFF' }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '30%' as unknown as number,
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

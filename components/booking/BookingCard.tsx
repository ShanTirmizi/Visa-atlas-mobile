import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';
import {
  type BookingType,
  type BookingStatus,
  BOOKING_TYPES,
  getBookingColor,
  getTintedBackground,
  formatRelativeDate,
  getBookingSecondaryMeta,
  getBookingEndMeta,
} from '@/constants/bookings';

interface BookingCardProps {
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider?: string;
  status: BookingStatus;
  cost?: number;
  currency?: string;
  typeDetails?: Record<string, string>;
  isUnlinked?: boolean;
  onPress: () => void;
}

export default function BookingCard({
  type,
  title,
  startDate,
  endDate,
  location,
  provider,
  status,
  cost,
  currency,
  typeDetails,
  isUnlinked,
  onPress,
}: BookingCardProps) {
  const { isDark } = useTheme();
  const typeColor = getBookingColor(type, isDark);
  const Icon = BOOKING_TYPES[type].icon;

  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';

  const relativeDate = formatRelativeDate(startDate);
  const secondaryMeta = getBookingSecondaryMeta(type, {
    provider,
    startDate,
    endDate,
    location,
    typeDetails,
  });
  const endMeta = getBookingEndMeta(type, { cost, currency, typeDetails });

  const metaText = [relativeDate, secondaryMeta].filter(Boolean).join(' \u00B7 ');

  const cardBg = isUnlinked ? (isDark ? '#1C1A17' : '#FFF8F0') : getTintedBackground(type, isDark);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          opacity: isCancelled ? 0.5 : 1,
        },
        isUnlinked && {
          borderWidth: 1.5,
          borderStyle: 'dashed' as const,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#d4c4b0',
        },
      ]}
    >
      <View style={styles.row}>
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: typeColor + '26' },
          ]}
        >
          <Icon size={18} color={typeColor} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: isDark ? '#E6EDF3' : '#1a1a1a' },
              isCompleted && styles.titleCompleted,
            ]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.meta, { color: isDark ? '#6B7280' : '#888888' }]}
          >
            {metaText}
          </Text>
        </View>

        {/* End meta (flight number or cost) */}
        {endMeta ? (
          <Text style={[styles.endMeta, { color: isDark ? '#6B7280' : '#888888' }]}>
            {endMeta}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  endMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  type BookingType,
  type BookingStatus,
  BOOKING_TYPES,
  getBookingColor,
  formatBookingDates,
} from '@/constants/bookings';

interface BookingCardProps {
  id: string;
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  provider: string;
  status: BookingStatus;
  tripName?: string;
  autoMatched?: boolean;
  onPress: () => void;
  onLinkTrip?: () => void;
}

export default function BookingCard({
  type,
  title,
  startDate,
  endDate,
  location,
  provider,
  status,
  tripName,
  autoMatched,
  onPress,
  onLinkTrip,
}: BookingCardProps) {
  const { colors, isDark } = useTheme();
  const config = BOOKING_TYPES[type];
  const typeColor = getBookingColor(type, isDark);
  const Icon = config.icon;

  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';

  // Build meta string: formatted dates + optional location
  const dateStr = formatBookingDates(
    new Date(startDate),
    endDate ? new Date(endDate) : undefined,
  );
  const metaParts = [dateStr];
  if (location) metaParts.push(location);
  const metaText = metaParts.join(' \u00B7 ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        Shadows.subtle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: isCancelled ? 0.5 : 1,
        },
      ]}
    >
      {/* Main row */}
      <View style={styles.mainRow}>
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: typeColor + '18' },
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
              { color: colors.foreground },
              isCompleted && styles.titleCompleted,
            ]}
          >
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.textSecondary }]}>
            {metaText}
          </Text>
        </View>

        {/* Provider badge */}
        <View style={[styles.providerBadge, { backgroundColor: typeColor + '18' }]}>
          <Text style={[styles.providerText, { color: typeColor }]}>
            {provider}
          </Text>
        </View>
      </View>

      {/* Trip link area */}
      {tripName ? (
        <View style={styles.tripChip}>
          <Link2 size={12} color={colors.primary} />
          <Text style={[styles.tripName, { color: colors.primary }]}>
            {tripName}
          </Text>
          {autoMatched && (
            <Text style={[styles.autoLabel, { color: colors.textMuted }]}>
              auto
            </Text>
          )}
        </View>
      ) : onLinkTrip ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onLinkTrip}
          style={styles.tripChip}
        >
          <Link2 size={12} color={colors.textMuted} />
          <Text style={[styles.linkPrompt, { color: colors.textMuted }]}>
            Link to a trip
          </Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  mainRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
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
  providerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  providerText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  tripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 46,
    marginTop: Spacing.sm,
  },
  tripName: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
  },
  autoLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  linkPrompt: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

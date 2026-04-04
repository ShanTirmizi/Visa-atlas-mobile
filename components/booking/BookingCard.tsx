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

  // Card background matches the bottom sheet color for that booking type
  const cardBg = typeColor;

  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';

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
          backgroundColor: cardBg,
          borderColor: 'transparent',
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
            { backgroundColor: 'rgba(255,255,255,0.2)' },
          ]}
        >
          <Icon size={18} color="#FFFFFF" />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: '#FFFFFF' },
              isCompleted && styles.titleCompleted,
            ]}
          >
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: 'rgba(255,255,255,0.75)' }]}>
            {metaText}
          </Text>
        </View>

        {/* Provider badge */}
        <View style={[styles.providerBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.providerText, { color: '#FFFFFF' }]}>
            {provider}
          </Text>
        </View>
      </View>

      {/* Trip link area */}
      {tripName ? (
        <View style={styles.tripChip}>
          <Link2 size={12} color="rgba(255,255,255,0.8)" />
          <Text style={[styles.tripName, { color: '#FFFFFF' }]}>
            {tripName}
          </Text>
          {autoMatched && (
            <Text style={[styles.autoLabel, { color: 'rgba(255,255,255,0.6)' }]}>
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
          <Link2 size={12} color="rgba(255,255,255,0.6)" />
          <Text style={[styles.linkPrompt, { color: 'rgba(255,255,255,0.6)' }]}>
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

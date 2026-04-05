import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Radius, Shadows } from '@/constants/theme';
import {
  type BookingType,
  BOOKING_TYPES,
  getBookingColor,
  getTintedBackground,
  formatRelativeDate,
  formatBookingDates,
} from '@/constants/bookings';

interface NextUpHeroCardProps {
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  provider?: string;
  location?: string;
  tripName?: string;
  cost?: number;
  currency?: string;
  typeDetails?: Record<string, string>;
  onPress: () => void;
}

export default function NextUpHeroCard({
  type,
  title,
  startDate,
  endDate,
  provider,
  location,
  tripName,
  cost,
  currency,
  typeDetails,
  onPress,
}: NextUpHeroCardProps) {
  const { isDark } = useTheme();
  const typeColor = getBookingColor(type, isDark);
  const Icon = BOOKING_TYPES[type].icon;
  const relativeDate = formatRelativeDate(startDate);

  // Build subtitle: "Provider Detail · Class/RoomType"
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (provider) parts.push(provider);
    if (type === 'flight' && typeDetails?.flightNumber) parts.push(typeDetails.flightNumber);
    if (type === 'flight' && typeDetails?.class) parts.push(typeDetails.class);
    if (type === 'hotel' && typeDetails?.roomType) parts.push(typeDetails.roomType);
    if (type !== 'flight' && type !== 'hotel' && location) parts.push(location);
    return parts.join(' \u00B7 ');
  }, [provider, type, typeDetails, location]);

  // Detail columns depend on booking type
  const detailColumns = useMemo(() => {
    const startDateObj = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : undefined;
    const dayOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

    if (type === 'flight') {
      return {
        left: {
          label: 'Departs',
          line1: startDateObj.toLocaleDateString('en-US', dayOpts),
          line2: typeDetails?.departure || startDateObj.toLocaleTimeString('en-US', timeOpts),
        },
        right: {
          label: 'Arrives',
          line1: endDateObj
            ? endDateObj.toLocaleDateString('en-US', dayOpts)
            : startDateObj.toLocaleDateString('en-US', dayOpts),
          line2: typeDetails?.arrival || '',
        },
        showArrow: true,
      };
    }

    if (type === 'hotel') {
      const nights = endDateObj
        ? Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        left: {
          label: 'Check-in',
          line1: startDateObj.toLocaleDateString('en-US', dayOpts),
          line2: '',
        },
        right: {
          label: 'Check-out',
          line1: endDateObj ? endDateObj.toLocaleDateString('en-US', dayOpts) : '',
          line2: nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : '',
        },
        showArrow: true,
      };
    }

    // Other types: Date | Location | Cost
    const costStr = cost != null && cost > 0
      ? `${currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : '$'}${cost.toLocaleString()}`
      : '';

    return {
      left: {
        label: 'Date',
        line1: formatBookingDates(startDateObj, endDateObj),
        line2: '',
      },
      right: {
        label: location ? 'Location' : (costStr ? 'Cost' : ''),
        line1: location || costStr,
        line2: '',
      },
      showArrow: false,
    };
  }, [type, startDate, endDate, typeDetails, location, cost, currency]);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.container, Shadows.card]}>
        {/* Top: tinted header */}
        <View style={[styles.header, { backgroundColor: getTintedBackground(type, isDark) }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.nextUpLabel, { color: isDark ? '#8B949E' : '#6B7280' }]}>
              NEXT UP
            </Text>
            <View style={[styles.countdownBadge, { backgroundColor: typeColor }]}>
              <Text style={styles.countdownText}>{relativeDate}</Text>
            </View>
          </View>

          <View style={styles.headerContent}>
            <View style={[styles.iconCircle, { backgroundColor: typeColor + '26' }]}>
              <Icon size={22} color={typeColor} />
            </View>
            <View>
              <Text
                numberOfLines={1}
                style={[styles.title, { color: isDark ? '#E6EDF3' : '#1a1a1a' }]}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  numberOfLines={1}
                  style={[styles.subtitle, { color: isDark ? '#8B949E' : '#555555' }]}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Bottom: detail row */}
        <View style={[styles.detailRow, { backgroundColor: isDark ? '#161B22' : '#FFFFFF' }]}>
          <View>
            <Text style={[styles.detailLabel, { color: isDark ? '#6B7280' : '#aaaaaa' }]}>
              {detailColumns.left.label}
            </Text>
            <Text style={[styles.detailValue, { color: isDark ? '#E6EDF3' : '#1a1a1a' }]}>
              {detailColumns.left.line1}
            </Text>
            {detailColumns.left.line2 ? (
              <Text style={[styles.detailSub, { color: isDark ? '#8B949E' : '#777777' }]}>
                {detailColumns.left.line2}
              </Text>
            ) : null}
          </View>

          {detailColumns.showArrow && (
            <Text style={[styles.arrow, { color: isDark ? '#444' : '#ccc' }]}>{'\u27F6'}</Text>
          )}

          <View style={{ alignItems: detailColumns.showArrow ? 'flex-end' as const : undefined }}>
            <Text style={[styles.detailLabel, { color: isDark ? '#6B7280' : '#aaaaaa' }]}>
              {detailColumns.right.label}
            </Text>
            <Text style={[styles.detailValue, { color: isDark ? '#E6EDF3' : '#1a1a1a' }]}>
              {detailColumns.right.line1}
            </Text>
            {detailColumns.right.line2 ? (
              <Text style={[styles.detailSub, { color: isDark ? '#8B949E' : '#777777' }]}>
                {detailColumns.right.line2}
              </Text>
            ) : null}
          </View>

          {tripName && (
            <View style={{ alignItems: 'flex-end' as const }}>
              <Text style={[styles.detailLabel, { color: isDark ? '#6B7280' : '#aaaaaa' }]}>
                Trip
              </Text>
              <Text style={[styles.tripLink, { color: typeColor }]}>{tripName}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    padding: 18,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nextUpLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  countdownBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  countdownText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    marginTop: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  detailLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    marginTop: 1,
  },
  detailSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
  arrow: {
    fontSize: 16,
    alignSelf: 'center',
  },
  tripLink: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    marginTop: 1,
  },
});

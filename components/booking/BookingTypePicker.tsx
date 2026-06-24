import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import {
  BOOKING_TYPE_LIST,
  BOOKING_TYPES,
  type BookingType,
} from '@/constants/bookings';
import ScanBooking from './ScanBooking';
import type { BookingFormData } from './BookingForm';
import { FEATURES } from '@/constants/featureFlags';

interface BookingTypePickerProps {
  onSelect: (type: BookingType) => void;
  onScanComplete: (type: BookingType, data: Partial<BookingFormData>) => void;
}

const SUBTITLE: Record<BookingType, string> = {
  flight: 'AIRLINE · IATA ROUTE',
  hotel: 'HOTEL · RENTAL · HOSTEL',
  experience: 'TOURS & ACTIVITIES',
  car_rental: 'PICKUP · DROPOFF',
  insurance: 'POLICY & COVERAGE',
  restaurant: 'RESERVATION · PARTY',
};

const TYPE_TITLE: Record<BookingType, string> = {
  flight: 'Flight',
  hotel: 'Stay',
  experience: 'Experience',
  car_rental: 'Car rental',
  insurance: 'Insurance',
  restaurant: 'Restaurant',
};

export default function BookingTypePicker({ onSelect, onScanComplete }: BookingTypePickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Editorial header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Text style={[Type.kicker, { color: colors.coralDeep, letterSpacing: 10 * 0.22 }]}>
          NEW BOOKING
        </Text>
        <Squiggle width={28} color={colors.coral} />
      </View>
      <Text
        style={{
          fontFamily: FontFamily.display,
          fontSize: 28,
          fontWeight: '500',
          letterSpacing: -28 * 0.022,
          color: colors.ink,
          marginTop: 2,
          lineHeight: 30,
        }}
      >
        What are you{' '}
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
          }}
        >
          adding
        </Text>
        <Text style={{ color: colors.coral }}>?</Text>
      </Text>

      {FEATURES.bookingScan && (
        <>
          {/* Hero "Scan a confirmation" — dark ink card */}
          <View style={{ marginTop: 18 }}>
            <ScanBooking onScanComplete={onScanComplete} />
          </View>

          {/* Coral squiggle divider */}
          <View style={{ marginTop: 22, marginBottom: 10, paddingHorizontal: 4 }}>
            <Squiggle width={70} color={colors.coral} />
            <Text
              style={[
                Type.kicker,
                { color: colors.inkMute, marginTop: 8, fontSize: 10, letterSpacing: 10 * 0.22 },
              ]}
            >
              OR ADD MANUALLY
            </Text>
          </View>
        </>
      )}

      {/* Numbered list of types — paper rows with tinted icon orbs */}
      <View style={styles.list}>
        {BOOKING_TYPE_LIST.map((type, idx) => {
          const config = BOOKING_TYPES[type];
          const Icon = config.icon;
          const isLast = idx === BOOKING_TYPE_LIST.length - 1;
          return (
            <Pressable
              key={type}
              onPress={() => onSelect(type)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: colors.line,
                  backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
                  borderRadius: pressed ? 12 : 0,
                  marginHorizontal: pressed ? -8 : 0,
                  paddingHorizontal: pressed ? 8 : 0,
                },
              ]}
            >
              {/* Coral mono index — passport stamp style */}
              <View style={styles.indexBox}>
                <Text
                  style={{
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 10,
                    fontWeight: '700',
                    color: colors.coralDeep,
                    letterSpacing: 10 * 0.22,
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </Text>
              </View>

              {/* Tinted icon orb — coral wash on paper */}
              <View
                style={[
                  styles.iconOrb,
                  {
                    backgroundColor: colors.coralBg,
                    borderColor: colors.line,
                  },
                ]}
              >
                <Icon size={20} color={colors.coralDeep} strokeWidth={1.8} />
              </View>

              {/* Title + mono kicker subtitle */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 19,
                    fontWeight: '500',
                    letterSpacing: -19 * 0.014,
                    color: colors.ink,
                  }}
                >
                  {TYPE_TITLE[type]}
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 9 * 0.22,
                    color: colors.inkMute,
                    marginTop: 3,
                  }}
                  numberOfLines={1}
                >
                  {SUBTITLE[type]}
                </Text>
              </View>

              <ChevronRight size={16} color={colors.inkFaint} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  list: {
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  indexBox: {
    width: 22,
    alignItems: 'flex-start',
  },
  iconOrb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

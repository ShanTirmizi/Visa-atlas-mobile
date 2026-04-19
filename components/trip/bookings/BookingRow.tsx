import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ArrowRight, Plane, Hotel, Compass, Car, Shield, UtensilsCrossed } from 'lucide-react-native';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BookingType } from '@/constants/bookings';

// ── Icon map for each booking type ──────────────
const TYPE_ICONS: Record<BookingType, React.ComponentType<{ size: number; color: string }>> = {
  flight: Plane,
  hotel: Hotel,
  experience: Compass,
  car_rental: Car,
  insurance: Shield,
  restaurant: UtensilsCrossed,
};

const TYPE_LABELS: Record<BookingType, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  experience: 'Activity',
  car_rental: 'Car',
  insurance: 'Insurance',
  restaurant: 'Dining',
};

interface BookingRowProps {
  type: BookingType;
  title: string;
  venue?: string;
  timeLabel?: string;
  onPress?: () => void;
}

export function BookingRow({ type, title, venue, timeLabel, onPress }: BookingRowProps) {
  const { colors } = useTheme();
  const Icon = TYPE_ICONS[type] ?? Compass;
  const typeLabel = TYPE_LABELS[type] ?? type;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        Shadows.subtle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {/* Left time + type strip */}
      <View style={styles.leftStrip}>
        {timeLabel ? (
          <Text style={[Type.mono10, { color: colors.inkMute, marginBottom: 5 }]}>
            {timeLabel}
          </Text>
        ) : null}
        {/* Category chip */}
        <View style={[styles.typeChip, { backgroundColor: colors.surfaceMuted }]}>
          <Icon size={11} color={colors.ink} />
          <Text style={[Type.meta11, { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
      </View>

      {/* Middle content */}
      <View style={styles.middle}>
        <Text style={[Type.title15, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {venue ? (
          <Text style={[Type.body12_5, { color: colors.inkMute, marginTop: 2 }]} numberOfLines={1}>
            {venue}
          </Text>
        ) : null}
      </View>

      {/* Right DarkOrb muted */}
      <DarkOrb size={36} muted onPress={onPress} accessibilityLabel="View booking details">
        <ArrowRight size={16} color={colors.ink} />
      </DarkOrb>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  leftStrip: {
    width: 52,
    alignItems: 'flex-end',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    maxWidth: 52,
  },
  middle: {
    flex: 1,
  },
});

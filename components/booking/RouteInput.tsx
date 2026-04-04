import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Spacing, Radius } from '@/constants/theme';

interface RouteInputProps {
  departure: string;
  arrival: string;
  onDepartureChange: (value: string) => void;
  onArrivalChange: (value: string) => void;
  accentColor: string;
}

export default function RouteInput({
  departure,
  arrival,
  onDepartureChange,
  onArrivalChange,
  accentColor,
}: RouteInputProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceLight,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.routeLabel, { color: colors.textMuted }]}>
        ROUTE
      </Text>

      <View style={styles.row}>
        {/* Departure */}
        <View style={styles.airportBox}>
          <Text style={[styles.airportLabel, { color: colors.textMuted }]}>
            FROM
          </Text>
          <TextInput
            style={[styles.airportInput, { color: colors.foreground }]}
            value={departure}
            onChangeText={onDepartureChange}
            autoCapitalize="characters"
            maxLength={4}
            placeholder="IATA"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Center icon */}
        <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
          <Plane
            size={16}
            color="#FFFFFF"
            style={{ transform: [{ rotate: '90deg' }] }}
          />
        </View>

        {/* Arrival */}
        <View style={styles.airportBox}>
          <Text style={[styles.airportLabel, { color: colors.textMuted }]}>
            TO
          </Text>
          <TextInput
            style={[styles.airportInput, { color: colors.foreground }]}
            value={arrival}
            onChangeText={onArrivalChange}
            autoCapitalize="characters"
            maxLength={4}
            placeholder="IATA"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  routeLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  airportBox: {
    flex: 1,
    alignItems: 'center',
  },
  airportLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  airportInput: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    textAlign: 'center',
    padding: 0,
    width: '100%',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
});

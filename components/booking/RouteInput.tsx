import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plane } from 'lucide-react-native';
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
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderColor: 'rgba(255,255,255,0.3)',
        },
      ]}
    >
      <Text style={[styles.routeLabel, { color: accentColor }]}>
        ROUTE
      </Text>

      <View style={styles.row}>
        {/* Departure */}
        <View style={styles.airportBox}>
          <Text style={[styles.airportLabel, { color: 'rgba(0,0,0,0.45)' }]}>
            FROM
          </Text>
          <TextInput
            style={[styles.airportInput, { color: '#111111' }]}
            value={departure}
            onChangeText={onDepartureChange}
            autoCapitalize="characters"
            maxLength={4}
            placeholder="IATA"
            placeholderTextColor="rgba(0,0,0,0.3)"
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
          <Text style={[styles.airportLabel, { color: 'rgba(0,0,0,0.45)' }]}>
            TO
          </Text>
          <TextInput
            style={[styles.airportInput, { color: '#111111' }]}
            value={arrival}
            onChangeText={onArrivalChange}
            autoCapitalize="characters"
            maxLength={4}
            placeholder="IATA"
            placeholderTextColor="rgba(0,0,0,0.3)"
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

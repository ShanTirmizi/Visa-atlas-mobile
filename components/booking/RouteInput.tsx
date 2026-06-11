import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
// BottomSheetTextInput so gorhom's keyboard handling engages — this input
// only ever renders inside AddBookingSheet's bottom sheet.
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import Svg, { Line } from 'react-native-svg';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';

interface RouteInputProps {
  departure: string;
  arrival: string;
  onDepartureChange: (value: string) => void;
  onArrivalChange: (value: string) => void;
  /** Coral by default — kept as a prop so callers can theme it later. */
  accentColor?: string;
}

/** Editorial route input: paper card with mono FROM/TO kickers, italic Fraunces
 *  IATA codes, and a dashed flight path with a rotated coral plane stamp.
 *  Used by the flight booking form. */
export default function RouteInput({
  departure,
  arrival,
  onDepartureChange,
  onArrivalChange,
  accentColor,
}: RouteInputProps) {
  const { colors } = useTheme();
  const tint = accentColor ?? colors.coral;
  const [depFocus, setDepFocus] = useState(false);
  const [arrFocus, setArrFocus] = useState(false);
  // Whole airport box focuses its input — the bare IATA line is a small
  // target (Apple HIG tap-target rule).
  const depRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
  const arrRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {/* Header — kicker + tiny route line */}
      <View style={styles.headerRow}>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 9 * 0.22,
            textTransform: 'uppercase',
            color: colors.coralDeep,
          }}
        >
          ROUTE
        </Text>
        <View style={[styles.routeLine, { backgroundColor: colors.coral }]} />
      </View>

      {/* Airports row with center plane stamp + dashed flight path */}
      <View style={styles.row}>
        {/* FROM */}
        <Pressable
          style={styles.airportBox}
          onPress={() => depRef.current?.focus()}
          accessible={false}
        >
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 9 * 0.22,
              textTransform: 'uppercase',
              color: colors.inkMute,
              marginBottom: 4,
            }}
          >
            FROM
          </Text>
          <BottomSheetTextInput
            ref={depRef}
            style={[
              styles.airportInput,
              {
                color: departure ? colors.ink : colors.inkFaint,
                borderBottomColor: depFocus ? colors.coral : 'transparent',
              },
            ]}
            value={departure}
            onChangeText={(v) => onDepartureChange(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            placeholder="—"
            placeholderTextColor={colors.inkFaint}
            onFocus={() => setDepFocus(true)}
            onBlur={() => setDepFocus(false)}
          />
        </Pressable>

        {/* Flight path — dashed line behind a rotated coral plane stamp */}
        <View style={styles.pathWrap} pointerEvents="none">
          <Svg width="100%" height={2} style={styles.dashedLine}>
            <Line
              x1="0"
              y1="1"
              x2="100%"
              y2="1"
              stroke={colors.line}
              strokeWidth={1}
              strokeDasharray="3,4"
            />
          </Svg>
          <View
            style={[
              styles.planeStamp,
              {
                backgroundColor: tint,
                borderColor: tint,
              },
            ]}
          >
            <Plane
              size={14}
              color="#FFFFFF"
              strokeWidth={2}
              fill="#FFFFFF"
              style={{ transform: [{ rotate: '45deg' }] }}
            />
          </View>
        </View>

        {/* TO */}
        <Pressable
          style={styles.airportBox}
          onPress={() => arrRef.current?.focus()}
          accessible={false}
        >
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 9,
              fontWeight: '700',
              letterSpacing: 9 * 0.22,
              textTransform: 'uppercase',
              color: colors.inkMute,
              marginBottom: 4,
            }}
          >
            TO
          </Text>
          <BottomSheetTextInput
            ref={arrRef}
            style={[
              styles.airportInput,
              {
                color: arrival ? colors.ink : colors.inkFaint,
                borderBottomColor: arrFocus ? colors.coral : 'transparent',
              },
            ]}
            value={arrival}
            onChangeText={(v) => onArrivalChange(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            placeholder="—"
            placeholderTextColor={colors.inkFaint}
            onFocus={() => setArrFocus(true)}
            onBlur={() => setArrFocus(false)}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  routeLine: {
    height: 1,
    width: 28,
    borderRadius: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  airportBox: {
    flex: 1,
    alignItems: 'center',
  },
  airportInput: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -30 * 0.018,
    fontWeight: '500',
    textAlign: 'center',
    padding: 0,
    paddingBottom: 4,
    width: '100%',
    borderBottomWidth: 1.5,
  },
  pathWrap: {
    width: 80,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  dashedLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
  },
  planeStamp: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
});

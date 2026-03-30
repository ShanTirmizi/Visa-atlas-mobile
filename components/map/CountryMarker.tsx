import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { type ThemeColors } from '@/constants/theme';

// ──────────────────────────────────────────────
// CountryMarker
// A small colored circle placed at a country's capital.
// Memoized for performance — the map renders ~195 of these.
// ──────────────────────────────────────────────

interface CountryMarkerProps {
  code: string;
  name: string;
  coordinate: LatLng;
  color: string;
  isSelected: boolean;
  onPress: (code: string) => void;
  colors: ThemeColors;
}

const MARKER_SIZE = 10;
const SELECTED_SIZE = 16;
const SELECTED_BORDER = 3;

function CountryMarkerInner({
  code,
  name,
  coordinate,
  color,
  isSelected,
  onPress,
  colors,
}: CountryMarkerProps) {
  const size = isSelected ? SELECTED_SIZE : MARKER_SIZE;

  return (
    <Marker
      identifier={code}
      coordinate={coordinate}
      title={name}
      tracksViewChanges={false}
      onPress={() => onPress(code)}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={isSelected ? 10 : 1}
      style={isSelected ? styles.selectedMarkerContainer : undefined}
    >
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          isSelected && {
            borderWidth: SELECTED_BORDER,
            borderColor: colors.foreground,
            ...Platform.select({
              ios: {
                shadowColor: color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 6,
              },
              android: {
                elevation: 6,
              },
            }),
          },
        ]}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  dot: {
    // Base dot styles — dimensions applied dynamically
  },
  selectedMarkerContainer: {
    zIndex: 10,
  },
});

export const CountryMarker = memo(
  CountryMarkerInner,
  (prev, next) =>
    prev.code === next.code &&
    prev.color === next.color &&
    prev.isSelected === next.isSelected &&
    prev.coordinate.latitude === next.coordinate.latitude &&
    prev.coordinate.longitude === next.coordinate.longitude,
);

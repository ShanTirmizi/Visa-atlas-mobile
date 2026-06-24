// components/dayplan/DayPlanMap.tsx
//
// The map canvas for a generated day plan: the road route drawn as a coral
// line, numbered circular pins for each stop (synced to the list), and a start
// pin. Built on the same MapLibre setup as VisaMap (OpenFreeMap tiles).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { LIGHT_STYLE, DARK_STYLE } from '@/components/map/mapStyles';
import type { DayPlanStop } from '@/types/dayPlan';

interface Props {
  start: { lat: number; lng: number };
  stops: DayPlanStop[];
  routeGeometry?: [number, number][];
  /** Index of the focused stop (-1/undefined = none) — pin enlarges. */
  activeIndex?: number;
  onStopPress?: (index: number) => void;
  style?: object;
}

export function DayPlanMap({ start, stops, routeGeometry, activeIndex, onStopPress, style }: Props) {
  const { colors, isDark } = useTheme();

  // Bounds covering start + every stop, with padding so pins aren't clipped.
  const bounds = useMemo(() => {
    const pts: [number, number][] = [[start.lng, start.lat], ...stops.map((s) => [s.lng, s.lat] as [number, number])];
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [start, stops]);

  const routeLine = useMemo(() => {
    const coords =
      routeGeometry && routeGeometry.length > 1
        ? routeGeometry
        : [[start.lng, start.lat], ...stops.map((s) => [s.lng, s.lat] as [number, number]), [start.lng, start.lat]];
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    };
  }, [routeGeometry, start, stops]);

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
        attributionEnabled={false}
        logoEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapLibreGL.Camera
          bounds={{
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: 70,
            paddingBottom: 70,
            paddingLeft: 60,
            paddingRight: 60,
          }}
          animationDuration={0}
        />

        <MapLibreGL.ShapeSource id="route-source" shape={routeLine}>
          <MapLibreGL.LineLayer
            id="route-line"
            style={{
              lineColor: colors.coral,
              lineWidth: 4,
              lineOpacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>

        {/* Start pin */}
        <MapLibreGL.PointAnnotation id="start-pin" coordinate={[start.lng, start.lat]}>
          <View style={[styles.startPin, { backgroundColor: colors.ink, borderColor: '#FFFFFF' }]}>
            <View style={[styles.startDot, { backgroundColor: '#FFFFFF' }]} />
          </View>
        </MapLibreGL.PointAnnotation>

        {/* Numbered stop pins */}
        {stops.map((s, i) => {
          const active = i === activeIndex;
          return (
            <MapLibreGL.PointAnnotation
              key={`stop-${i}-${s.lat}-${s.lng}`}
              id={`stop-${i}`}
              coordinate={[s.lng, s.lat]}
              onSelected={() => onStopPress?.(i)}
            >
              <View
                style={[
                  styles.pin,
                  {
                    backgroundColor: colors.coral,
                    borderColor: '#FFFFFF',
                    transform: [{ scale: active ? 1.25 : 1 }],
                  },
                ]}
              >
                <Text style={styles.pinText}>{i + 1}</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  map: { flex: 1 },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  pinText: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: 13 },
  startPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startDot: { width: 6, height: 6, borderRadius: 3 },
});

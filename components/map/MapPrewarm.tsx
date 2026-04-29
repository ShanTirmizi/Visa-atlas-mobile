import React, { useEffect, useState } from 'react';
import { View, InteractionManager, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme } from '@/contexts/theme-context';
import { LIGHT_STYLE, DARK_STYLE } from './mapStyles';

// ─────────────────────────────────────────────────────────────────
// MapPrewarm
//
// Mounted once at the root, off-screen and invisible. Its job is to
// take the heavy first-load costs of the Atlas tab and pay them while
// the user is still on Trips:
//
//  1. The synchronous topojson → GeoJSON pipeline in `data/countriesGeo`
//     (~100–300 ms on a real device) — kicked off via dynamic import on
//     idle so it lands in the module-level cache.
//  2. MapLibre's native view bridge crossing — by mounting a real (but
//     1×1, transparent) <MapView>.
//  3. The style + initial vector tiles fetch from openfreemap — same
//     mapStyle URL as the visible map so the native tile cache is hit
//     when the user finally taps the Atlas tab.
//
// We unmount once the style finishes loading (or after a 30 s timeout
// fallback), so the prewarm view doesn't linger in memory forever.
// ─────────────────────────────────────────────────────────────────

const PREWARM_TIMEOUT_MS = 30_000;

export function MapPrewarm() {
  const { isDark } = useTheme();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);

  // Defer until current interactions are done so we don't slow the first
  // tab's paint. InteractionManager guarantees this fires after the JS
  // thread is idle (typically ~150 ms after the first navigation finishes).
  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      setActive(true);
      // Pre-compute the country GeoJSON off the critical path. Result is
      // memoized at module scope, so when <VisaMap> mounts it skips this.
      import('@/data/countriesGeo')
        .then((m) => {
          m.getCountriesGeoJSON();
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, []);

  // Fallback: if the style never finishes (offline, stalled fetch), drop
  // the prewarm after 30 s so we're not holding a phantom MapView open.
  useEffect(() => {
    if (!active || done) return;
    const timer = setTimeout(() => setDone(true), PREWARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [active, done]);

  if (done || !active) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
        attributionEnabled={false}
        logoEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        onDidFinishLoadingStyle={() => {
          // Style + initial tiles are now in MapLibre's native cache.
          // Drop the prewarm view; the real <VisaMap> in the Atlas tab
          // will mount with a hot cache.
          setDone(true);
        }}
      >
        {/* Match the visible map's default camera so the same tiles get
            cached, not whatever the world-default viewport would fetch. */}
        <MapLibreGL.Camera
          defaultSettings={{
            centerCoordinate: [40, 20],
            zoomLevel: 1.5,
          }}
        />
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  map: {
    flex: 1,
  },
});

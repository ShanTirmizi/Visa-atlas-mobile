import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily, Shadows } from '@/constants/theme';
import { LIGHT_STYLE, DARK_STYLE } from '@/components/map/mapStyles';
import {
  getDayPlaces,
  resolveDestinationGeo,
  type DayPlace,
  type DayPlaceSlots,
} from '@/utils/dayPlaces';
import { openInMaps } from '@/utils/maps';
import { hapticSelect } from '@/utils/haptics';

// ─────────────────────────────────────────────────────────────────
// DayMapStrip
//
// Compact destination map + one "open in Maps" row per named stop on
// the day. We only have place NAMES from the itinerary (no coordinates,
// and no geocoding API by design), so the map honestly shows the trip's
// destination — camera parked on the capital, labelled with a small
// city pill — with NO per-place pins. Inventing pin positions for
// "Tsukiji Outer Market" without coordinates would be lying with a map.
// The real utility lives in the rows: each one hands the place name to
// the platform maps app's search (Apple Maps on iOS), which does the
// actual geocoding.
//
// Same style URL as the Atlas tab's <VisaMap> / <MapPrewarm>, so the
// native tile cache is shared and this card paints from a warm cache.
// ─────────────────────────────────────────────────────────────────

const MAP_HEIGHT = 170;
// City-scale viewport (~20 km across) — enough to read neighbourhoods
// without pretending street-level precision we don't have.
const MAP_ZOOM = 10;
// Matches the sibling cards on the day-detail sheet (PullQuote, AI CTA).
const CARD_RADIUS = 18;

interface DayMapStripProps {
  /** The itinerary day — only the *Place slots are read. */
  day: DayPlaceSlots;
  /** Trip destination country name, e.g. "Japan" — used both to centre
   *  the map and to disambiguate the Maps search query. */
  destination?: string;
}

function DayMapStrip({ day, destination }: DayMapStripProps) {
  const { colors, isDark } = useTheme();

  const places = useMemo(() => getDayPlaces(day), [day]);
  const geo = useMemo(() => resolveDestinationGeo(destination), [destination]);

  // Skeleton fade — same pattern as VisaMap: a solid panel sits over the
  // MapView until tiles paint, then fades out, so the card never shows a
  // blank white flash on cold tile loads.
  const skeletonOpacity = useSharedValue(1);
  const onMapReady = useCallback(() => {
    skeletonOpacity.value = withTiming(0, { duration: 280 });
  }, [skeletonOpacity]);
  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value,
  }));

  const handleOpen = useCallback(
    (place: DayPlace) => {
      hapticSelect();
      // Disambiguate with the COUNTRY only, not the capital — the day's
      // stops may be in another city (a Kyoto day on a Japan trip), and
      // biasing the search with "Tokyo" would send Maps to the wrong spot.
      void openInMaps({ name: place.name, location: destination });
    },
    [destination],
  );

  if (places.length === 0) return null;

  return (
    // Split shadow/clip per CLAUDE.md: outer view carries the shadow and
    // radius (no overflow:hidden — iOS would clip the shadow), inner view
    // clips the map tiles to the rounded corners.
    <View
      style={[
        styles.shadowWrap,
        Shadows.cardWarm,
        { backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.clip, { borderColor: colors.line }]}>
        {geo ? (
          <View
            style={[styles.mapBox, { backgroundColor: colors.backgroundDeep }]}
          >
            {/* pointerEvents none: pure ambience — keeps the screen's
                horizontal day-swipe pan and the sheet scroll untouched. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <MapLibreGL.MapView
                style={StyleSheet.absoluteFill}
                mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
                attributionEnabled={false}
                logoEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                onDidFinishLoadingMap={onMapReady}
              >
                <MapLibreGL.Camera
                  defaultSettings={{
                    centerCoordinate: geo.center,
                    zoomLevel: MAP_ZOOM,
                  }}
                />
              </MapLibreGL.MapView>
            </View>

            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.backgroundDeep },
                skeletonStyle,
              ]}
            />

            {/* Honest label: names the city the camera is parked on. */}
            <View
              style={[
                styles.capitalPill,
                Shadows.subtle,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <MapPin size={10} color={colors.coralDeep} strokeWidth={2.4} />
              <Text
                style={[Type.kickerSm, { color: colors.inkSoft, fontSize: 8.5 }]}
                numberOfLines={1}
              >
                {geo.capital.toUpperCase()}
              </Text>
            </View>
          </View>
        ) : null}

        {places.map((place, idx) => (
          <View key={place.slot}>
            {geo || idx > 0 ? (
              <View
                style={[styles.divider, { backgroundColor: colors.line }]}
              />
            ) : null}
            <Pressable
              onPress={() => handleOpen(place)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${place.name} in Maps`}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[styles.numBadge, { backgroundColor: colors.coralBg }]}
              >
                <Text style={[Type.mono10, { color: colors.coralDeep }]}>
                  {idx + 1}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text
                  style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}
                >
                  {place.slot.toUpperCase()}
                </Text>
                <Text
                  style={[styles.placeName, { color: colors.ink }]}
                  numberOfLines={1}
                >
                  {place.name}
                </Text>
              </View>
              {/* Same trailing-affordance vocabulary as the screen's
                  "CHAT →" on the AI CTA card. */}
              <Text
                style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}
              >
                MAPS →
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export default React.memo(DayMapStrip);

const styles = StyleSheet.create({
  shadowWrap: {
    marginTop: 18,
    borderRadius: CARD_RADIUS,
  },
  clip: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapBox: {
    height: MAP_HEIGHT,
  },
  capitalPill: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '70%',
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  numBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  placeName: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 15.5,
    fontWeight: '500',
    letterSpacing: -15.5 * 0.012,
    marginTop: 2,
  },
});

import React, { useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useTheme } from '@/contexts/theme-context';
import { getVisaCategoryColor } from '@/constants/categories';
import { type VisaCategory as DataVisaCategory, visaData, resolveCountry, type HeldVisaType } from '@/data/visaData';
import { countryCoordinates } from '@/data/countryCoordinates';
import { CountryMarker } from './CountryMarker';
import { MapLegend } from './MapLegend';

// ──────────────────────────────────────────────
// VisaMap
// Full-screen world map with colored markers for
// each country, colored by their visa category.
// ──────────────────────────────────────────────

export interface VisaMapProps {
  activeFilters: Set<string>;
  heldVisas: Set<string>;
  onCountrySelect: (code: string) => void;
  selectedCountry?: string | null;
}

// Map data-layer category names (visa-free) to UI category keys (visa_free)
function normalizeCategoryKey(category: DataVisaCategory | string): string {
  switch (category) {
    case 'visa-free':
      return 'visa_free';
    case 'visa-on-arrival':
      return 'visa_on_arrival';
    case 'evisa':
      return 'e_visa';
    case 'visa-required':
      return 'visa_required';
    case 'home':
      return 'visa_free'; // home country shows as visa-free
    default:
      return 'visa_required';
  }
}

// Initial region centered on the world (slight bias toward Asia/Europe)
const INITIAL_REGION: Region = {
  latitude: 20,
  longitude: 40,
  latitudeDelta: 120,
  longitudeDelta: 120,
};

// Custom map styling for a muted base map (iOS uses mutedStandard; this handles Android)
const MUTED_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ saturation: -60 }, { lightness: 10 }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7a7a7a' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#aaaaaa' }, { weight: 0.5 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [{ color: '#d4e6ec' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry.fill',
    stylers: [{ color: '#f0ece4' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    stylers: [{ visibility: 'off' }],
  },
];

// Same concept for dark mode
const DARK_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1a2e38' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6a8a98' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2d4a58' }, { weight: 0.5 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [{ color: '#0f1f28' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1a3340' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    stylers: [{ visibility: 'off' }],
  },
];

interface ResolvedMarker {
  code: string;
  name: string;
  categoryKey: string; // normalized UI key (visa_free, etc.)
  latitude: number;
  longitude: number;
}

export function VisaMap({
  activeFilters,
  heldVisas,
  onCountrySelect,
  selectedCountry,
}: VisaMapProps) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  // Cast heldVisas to the typed set
  const typedHeldVisas = heldVisas as Set<HeldVisaType>;

  // Resolve all country visa categories considering held visas
  const markers: ResolvedMarker[] = useMemo(() => {
    const result: ResolvedMarker[] = [];

    for (const country of visaData) {
      const coords = countryCoordinates[country.code];
      if (!coords) continue; // skip countries without coordinates

      const resolved = resolveCountry(country, typedHeldVisas);
      const categoryKey = normalizeCategoryKey(resolved.category);

      result.push({
        code: country.code,
        name: country.name,
        categoryKey,
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }

    return result;
  }, [typedHeldVisas]);

  // Filter markers by active category filters
  const visibleMarkers = useMemo(() => {
    if (activeFilters.size === 0) return markers;
    return markers.filter((m) => activeFilters.has(m.categoryKey));
  }, [markers, activeFilters]);

  const handleMarkerPress = useCallback(
    (code: string) => {
      onCountrySelect(code);
    },
    [onCountrySelect],
  );

  const mapStyle = isDark ? DARK_MAP_STYLE : MUTED_MAP_STYLE;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? mapStyle : undefined}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        {visibleMarkers.map((marker) => {
          const markerColor = getVisaCategoryColor(marker.categoryKey, colors);
          return (
            <CountryMarker
              key={marker.code}
              code={marker.code}
              name={marker.name}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              color={markerColor}
              isSelected={selectedCountry === marker.code}
              onPress={handleMarkerPress}
              colors={colors}
            />
          );
        })}
      </MapView>

      <MapLegend />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

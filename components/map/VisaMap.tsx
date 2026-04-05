import React, { useMemo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme } from '@/contexts/theme-context';
import { getVisaCategoryColor, type VisaCategory } from '@/constants/categories';
import {
  type VisaCategory as DataVisaCategory,
  visaData,
  resolveCountry,
  type HeldVisaType,
} from '@/data/visaData';
import { getCountriesGeoJSON } from '@/data/countriesGeo';
import CountryInfoCard from './CountryInfoCard';
import { MapLegend } from './MapLegend';

// ──────────────────────────────────────────────
// VisaMap
// Full-screen world choropleth map with country
// fills colored by their visa category.
// Uses MapLibre GL with ShapeSource + FillLayer.
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

// Load GeoJSON once at module level
const countriesGeoJSON = getCountriesGeoJSON();

// Tile style URLs
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

interface SelectedInfo {
  code: string;
  name: string;
  categoryKey: string;
  maxStay?: number;
}

interface CountryLookupEntry {
  categoryKey: string;
  name: string;
  maxStay?: number;
}

export function VisaMap({
  activeFilters,
  heldVisas,
  onCountrySelect,
}: VisaMapProps) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<SelectedInfo | null>(null);

  // Cast heldVisas to the typed set
  const typedHeldVisas = heldVisas as Set<HeldVisaType>;

  // Build lookup: code → { categoryKey, name, maxStay }
  const countryLookup = useMemo(() => {
    const lookup = new Map<string, CountryLookupEntry>();
    for (const country of visaData) {
      const resolved = resolveCountry(country, typedHeldVisas);
      const categoryKey = normalizeCategoryKey(resolved.category);
      lookup.set(country.code, {
        categoryKey,
        name: country.name,
        maxStay: resolved.days,
      });
    }
    return lookup;
  }, [typedHeldVisas]);

  // Build the fillColor expression: ['match', ['get', 'iso_a3'], code1, color1, ..., default]
  const fillColorExpression = useMemo(() => {
    const defaultColor = isDark ? '#1a3340' : '#e0d5c8';
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    for (const [code, entry] of countryLookup) {
      const color = getVisaCategoryColor(entry.categoryKey, colors);
      expr.push(code, color);
    }
    expr.push(defaultColor);
    return expr;
  }, [countryLookup, colors, isDark]);

  // Build the fillOpacity expression
  const fillOpacityExpression = useMemo(() => {
    if (activeFilters.size === 0) {
      // No filters — all countries at 0.7
      return 0.7;
    }
    // With filters — matching 0.7, non-matching 0.08
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    for (const [code, entry] of countryLookup) {
      if (activeFilters.has(entry.categoryKey)) {
        expr.push(code, 0.7);
      } else {
        expr.push(code, 0.08);
      }
    }
    expr.push(0.08); // default for unknown countries
    return expr;
  }, [countryLookup, activeFilters]);

  // Line width expression: 2px for selected country, 0.5 for others
  const lineWidthExpression = useMemo(() => {
    if (!selected) return 0.5;
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    expr.push(selected.code, 2);
    expr.push(0.5);
    return expr;
  }, [selected]);

  // Line color expression: white for selected country, subtle border for others
  const lineColorExpression = useMemo(() => {
    const defaultLineColor = isDark ? '#2d4a58' : '#aaaaaa';
    if (!selected) return defaultLineColor;
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    expr.push(selected.code, '#FFFFFF');
    expr.push(defaultLineColor);
    return expr;
  }, [selected, isDark]);

  // Handle tap on a country shape
  const handleShapePress = useCallback(
    (event: { features: Array<{ properties?: Record<string, unknown> }> }) => {
      shapeJustPressed.current = true;
      const feature = event.features?.[0];
      const iso = feature?.properties?.iso_a3 as string | undefined;
      if (!iso) {
        // Tapped ocean or feature without iso — dismiss selection
        setSelected(null);
        return;
      }

      // Same country tapped again — dismiss
      if (selected?.code === iso) {
        setSelected(null);
        return;
      }

      const entry = countryLookup.get(iso);
      if (entry) {
        setSelected({
          code: iso,
          name: entry.name,
          categoryKey: entry.categoryKey,
          maxStay: entry.maxStay,
        });
      } else {
        // Country not in visa data
        setSelected(null);
      }
    },
    [selected, countryLookup],
  );

  // Track whether a shape was just pressed (prevents MapView.onPress from dismissing)
  const shapeJustPressed = React.useRef(false);

  // Handle tap on empty map area (ocean)
  const handleMapPress = useCallback(() => {
    // If a shape was just pressed, skip — the shape handler already set selection
    if (shapeJustPressed.current) {
      shapeJustPressed.current = false;
      return;
    }
    setSelected(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (selected) {
      onCountrySelect(selected.code);
    }
  }, [selected, onCountrySelect]);

  const mapStyle = isDark ? DARK_STYLE : LIGHT_STYLE;

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={mapStyle}
        onPress={handleMapPress}
        attributionEnabled={false}
        logoEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapLibreGL.Camera
          defaultSettings={{
            centerCoordinate: [40, 20],
            zoomLevel: 1.5,
          }}
        />

        <MapLibreGL.ShapeSource
          id="countries-source"
          shape={countriesGeoJSON}
          onPress={handleShapePress as unknown as (event: unknown) => void}
        >
          <MapLibreGL.FillLayer
            id="countries-fill"
            style={{
              fillColor: fillColorExpression as unknown as string,
              fillOpacity: fillOpacityExpression as unknown as number,
            }}
          />
          <MapLibreGL.LineLayer
            id="countries-border"
            style={{
              lineColor: lineColorExpression as unknown as string,
              lineWidth: lineWidthExpression as unknown as number,
              lineOpacity: 0.8,
            }}
          />
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>

      {selected != null && (
        <CountryInfoCard
          code={selected.code}
          name={selected.name}
          categoryKey={selected.categoryKey as VisaCategory}
          maxStay={selected.maxStay}
          onViewDetails={handleViewDetails}
        />
      )}

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

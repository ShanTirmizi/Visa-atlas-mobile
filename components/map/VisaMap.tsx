import React, { useMemo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useTheme } from '@/contexts/theme-context';
import { getVisaCategoryColor, type VisaCategory } from '@/constants/categories';
import {
  type VisaCategory as DataVisaCategory,
  resolveCountry,
  type HeldVisaType,
  type CountryVisa,
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
  sheetCollapsed?: boolean;
  countries: CountryVisa[];
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

// ── Point-in-polygon ─────────────────────────────────────────────────
// MapLibre's ShapeSource.onPress returns every feature inside its hitbox,
// not just the one whose geometry actually contains the tap. For neighbors
// like South Korea and Japan (Japan being a multi-polygon with a huge
// bounding-box footprint across the Korea Strait), the first returned
// feature can easily be the wrong country. We re-run point-in-polygon on
// the actual tap coordinate to pick the feature that *really* contains it.

type Ring = number[][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: Polygon): boolean {
  if (polygon.length === 0) return false;
  // Must be inside the outer ring
  if (!pointInRing(lng, lat, polygon[0])) return false;
  // ...and NOT inside any hole
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

function pointInMultiPolygon(lng: number, lat: number, mp: MultiPolygon): boolean {
  for (const poly of mp) {
    if (pointInPolygon(lng, lat, poly)) return true;
  }
  return false;
}

type FeatureGeometry = { type: string; coordinates: unknown };
type FeatureLike = { geometry?: FeatureGeometry; properties?: Record<string, unknown> };

function featureContainsPoint(lng: number, lat: number, feature: FeatureLike): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  if (geom.type === 'Polygon') {
    return pointInPolygon(lng, lat, geom.coordinates as Polygon);
  }
  if (geom.type === 'MultiPolygon') {
    return pointInMultiPolygon(lng, lat, geom.coordinates as MultiPolygon);
  }
  return false;
}

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
  sheetCollapsed = true,
  countries,
}: VisaMapProps) {
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState<SelectedInfo | null>(null);

  // Cast heldVisas to the typed set
  const typedHeldVisas = heldVisas as Set<HeldVisaType>;

  // Build lookup: code → { categoryKey, name, maxStay }
  const countryLookup = useMemo(() => {
    const lookup = new Map<string, CountryLookupEntry>();
    for (const country of countries) {
      const resolved = resolveCountry(country, typedHeldVisas);
      const categoryKey = normalizeCategoryKey(resolved.category);
      lookup.set(country.code, {
        categoryKey,
        name: country.name,
        maxStay: resolved.days,
      });
    }
    return lookup;
  }, [countries, typedHeldVisas]);

  // Build the fillColor expression: ['match', ['get', 'iso_a3'], code1, color1, ..., default]
  const fillColorExpression = useMemo(() => {
    // Unclassified countries use the stone base so the map reads as monochrome
    const defaultColor = colors.backgroundDeep;
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    for (const [code, entry] of countryLookup) {
      const color = getVisaCategoryColor(entry.categoryKey, colors);
      expr.push(code, color);
    }
    expr.push(defaultColor);
    return expr;
  }, [countryLookup, colors]);

  // Build the fillOpacity expression (0.75 for layered depth per Mono spec)
  const fillOpacityExpression = useMemo(() => {
    if (activeFilters.size === 0) {
      // No filters — all countries at spec opacity
      return 0.75;
    }
    // With filters — matching at spec opacity, non-matching dimmed
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    for (const [code, entry] of countryLookup) {
      if (activeFilters.has(entry.categoryKey)) {
        expr.push(code, 0.75);
      } else {
        expr.push(code, 0.1);
      }
    }
    expr.push(0.1); // default for unknown countries
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

  // Line color expression: white for selected country, Mono hairline for others
  const lineColorExpression = useMemo(() => {
    // colors.line = 'rgba(0,0,0,0.06)' — the Mono hairline token
    const defaultLineColor = colors.line;
    if (!selected) return defaultLineColor;
    const expr: unknown[] = ['match', ['get', 'iso_a3']];
    expr.push(selected.code, '#FFFFFF');
    expr.push(defaultLineColor);
    return expr;
  }, [selected, colors.line]);

  // Handle tap on a country shape
  const handleShapePress = useCallback(
    (event: {
      features: FeatureLike[];
      coordinates?: { latitude: number; longitude: number };
    }) => {
      shapeJustPressed.current = true;
      const features = event.features ?? [];
      if (features.length === 0) {
        setSelected(null);
        return;
      }

      // MapLibre returns every feature within its hitbox — we need to pick
      // the one whose polygon ACTUALLY contains the tap coordinate, not
      // just features[0]. Without this, tapping near the Korea/Japan border
      // returns Japan first (its multi-polygon footprint extends westward)
      // even when the finger is on South Korea.
      const coords = event.coordinates;
      let feature: FeatureLike | undefined;
      if (coords && typeof coords.longitude === 'number' && typeof coords.latitude === 'number') {
        feature = features.find((f) => featureContainsPoint(coords.longitude, coords.latitude, f));
      }
      // Fallback: if we somehow didn't get coordinates, or none of the
      // candidates contain the point, use the first feature.
      if (!feature) feature = features[0];

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

        {/* Mono stone basemap — ocean and base map tint */}
        <MapLibreGL.BackgroundLayer
          id="mono-background"
          style={{ backgroundColor: colors.backgroundDeep }}
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
              fillAntialias: true,
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

      <View style={styles.overlay} pointerEvents="box-none">
        {selected != null && sheetCollapsed && (
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});

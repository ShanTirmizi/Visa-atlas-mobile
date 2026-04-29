import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';

// world-atlas 110m resolution — ~300KB
// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldTopology = require('world-atlas/countries-110m.json') as Topology;

// ISO numeric → ISO alpha-3 mapping
const NUMERIC_TO_ALPHA3: Record<string, string> = {
  '004': 'AFG', '008': 'ALB', '012': 'DZA', '020': 'AND', '024': 'AGO',
  '028': 'ATG', '032': 'ARG', '051': 'ARM', '036': 'AUS', '040': 'AUT',
  '031': 'AZE', '044': 'BHS', '048': 'BHR', '050': 'BGD', '052': 'BRB',
  '112': 'BLR', '056': 'BEL', '084': 'BLZ', '204': 'BEN', '064': 'BTN',
  '068': 'BOL', '070': 'BIH', '072': 'BWA', '076': 'BRA', '096': 'BRN',
  '100': 'BGR', '854': 'BFA', '108': 'BDI', '116': 'KHM', '120': 'CMR',
  '124': 'CAN', '132': 'CPV', '140': 'CAF', '148': 'TCD', '152': 'CHL',
  '156': 'CHN', '170': 'COL', '174': 'COM', '178': 'COG', '180': 'COD',
  '188': 'CRI', '384': 'CIV', '191': 'HRV', '192': 'CUB', '196': 'CYP',
  '203': 'CZE', '208': 'DNK', '262': 'DJI', '212': 'DMA', '214': 'DOM',
  '218': 'ECU', '818': 'EGY', '222': 'SLV', '226': 'GNQ', '232': 'ERI',
  '233': 'EST', '231': 'ETH', '748': 'SWZ', '242': 'FJI', '246': 'FIN',
  '250': 'FRA', '266': 'GAB', '270': 'GMB', '268': 'GEO', '276': 'DEU',
  '288': 'GHA', '300': 'GRC', '308': 'GRD', '320': 'GTM', '324': 'GIN',
  '624': 'GNB', '328': 'GUY', '332': 'HTI', '340': 'HND', '348': 'HUN',
  '352': 'ISL', '356': 'IND', '360': 'IDN', '364': 'IRN', '368': 'IRQ',
  '372': 'IRL', '376': 'ISR', '380': 'ITA', '388': 'JAM', '392': 'JPN',
  '400': 'JOR', '398': 'KAZ', '404': 'KEN', '296': 'KIR', '408': 'PRK',
  '410': 'KOR', '414': 'KWT', '417': 'KGZ', '418': 'LAO', '428': 'LVA',
  '422': 'LBN', '426': 'LSO', '430': 'LBR', '434': 'LBY', '438': 'LIE',
  '440': 'LTU', '442': 'LUX', '450': 'MDG', '454': 'MWI', '458': 'MYS',
  '462': 'MDV', '466': 'MLI', '470': 'MLT', '584': 'MHL', '478': 'MRT',
  '480': 'MUS', '484': 'MEX', '583': 'FSM', '498': 'MDA', '492': 'MCO',
  '496': 'MNG', '499': 'MNE', '504': 'MAR', '508': 'MOZ', '104': 'MMR',
  '516': 'NAM', '520': 'NRU', '524': 'NPL', '528': 'NLD', '554': 'NZL',
  '558': 'NIC', '562': 'NER', '566': 'NGA', '807': 'MKD', '578': 'NOR',
  '512': 'OMN', '586': 'PAK', '585': 'PLW', '591': 'PAN', '598': 'PNG',
  '600': 'PRY', '604': 'PER', '608': 'PHL', '616': 'POL', '620': 'PRT',
  '634': 'QAT', '642': 'ROU', '643': 'RUS', '646': 'RWA', '659': 'KNA',
  '662': 'LCA', '670': 'VCT', '882': 'WSM', '674': 'SMR', '678': 'STP',
  '682': 'SAU', '686': 'SEN', '688': 'SRB', '690': 'SYC', '694': 'SLE',
  '702': 'SGP', '703': 'SVK', '705': 'SVN', '090': 'SLB', '706': 'SOM',
  '710': 'ZAF', '728': 'SSD', '724': 'ESP', '144': 'LKA', '729': 'SDN',
  '740': 'SUR', '752': 'SWE', '756': 'CHE', '760': 'SYR', '158': 'TWN',
  '762': 'TJK', '834': 'TZA', '764': 'THA', '626': 'TLS', '768': 'TGO',
  '776': 'TON', '780': 'TTO', '788': 'TUN', '792': 'TUR', '795': 'TKM',
  '798': 'TUV', '800': 'UGA', '804': 'UKR', '784': 'ARE', '826': 'GBR',
  '840': 'USA', '858': 'URY', '860': 'UZB', '548': 'VUT', '862': 'VEN',
  '704': 'VNM', '887': 'YEM', '894': 'ZMB', '716': 'ZWE',
  '275': 'PSE', '304': 'GRL', '540': 'NCL',
};

// ──────────────────────────────────────────────────────
// Geometry fixes for MapLibre GL rendering
// ──────────────────────────────────────────────────────
// The world-atlas TopoJSON uses D3's spherical convention (CW = exterior ring).
// MapLibre GL follows RFC 7946 (CCW = exterior ring on the Cartesian plane).
// Without rewinding, MapLibre treats every country polygon as a "hole",
// causing horizontal band artifacts across the entire map.
//
// Additionally, Russia, Fiji, and Antarctica cross the antimeridian (±180° longitude).
// MapLibre cannot render polygons that wrap around the date line — it draws
// a straight line connecting the east and west edges instead.
// We split those polygons at the antimeridian into separate east/west halves.
// ──────────────────────────────────────────────────────

/**
 * Enforce RFC 7946 winding order on all polygon rings.
 * Outer rings become counter-clockwise, inner rings clockwise
 * (on the Cartesian / projected plane), which is what MapLibre expects.
 *
 * Based on @mapbox/geojson-rewind (MIT), inlined to avoid untyped dependency.
 */
function rewindRing(ring: Position[], dir: boolean): void {
  let area = 0;
  let err = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const k = (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
    const m = area + k;
    err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
    area = m;
  }
  if (area + err >= 0 !== !!dir) ring.reverse();
}

function rewindPolygonRings(rings: Position[][], outer: boolean): void {
  if (rings.length === 0) return;
  rewindRing(rings[0], outer);
  for (let i = 1; i < rings.length; i++) {
    rewindRing(rings[i], !outer);
  }
}

function rewindFeatureCollection(
  fc: FeatureCollection<Polygon | MultiPolygon>,
): void {
  for (const feat of fc.features) {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      rewindPolygonRings(geom.coordinates, false);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        rewindPolygonRings(poly, false);
      }
    }
  }
}

/**
 * Split a polygon ring that crosses the antimeridian (±180° longitude)
 * into separate east-hemisphere and west-hemisphere polygons.
 *
 * Returns the original polygon wrapped in an array if it doesn't cross,
 * or two polygon coordinate arrays (east and west halves) if it does.
 */
function splitPolygonAtAntimeridian(
  polyCoords: Position[][],
): Position[][][] {
  const ring = polyCoords[0]; // outer ring

  // Detect if any edge jumps more than 180° in longitude
  let hasCrossing = false;
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
      hasCrossing = true;
      break;
    }
  }
  if (!hasCrossing) return [polyCoords];

  const eastParts: Position[][] = [];
  const westParts: Position[][] = [];
  let currentEast: Position[] = [];
  let currentWest: Position[] = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const curr = ring[i];
    const next = ring[i + 1];

    // Add current vertex to the appropriate side
    if (curr[0] >= 0) {
      currentEast.push(curr);
    } else {
      currentWest.push(curr);
    }

    // Check if the edge to the next vertex crosses the antimeridian
    if (Math.abs(next[0] - curr[0]) > 180) {
      // Interpolate the latitude at the ±180° crossing
      if (curr[0] >= 0) {
        // East → West crossing
        const dLng = 180 - curr[0] + (180 + next[0]);
        const crossLat =
          dLng === 0
            ? (curr[1] + next[1]) / 2
            : curr[1] + ((180 - curr[0]) / dLng) * (next[1] - curr[1]);
        currentEast.push([180, crossLat]);
        if (currentEast.length > 0) eastParts.push(currentEast);
        currentEast = [];
        currentWest.push([-180, crossLat]);
      } else {
        // West → East crossing
        const dLng = 180 + curr[0] + (180 - next[0]);
        const crossLat =
          dLng === 0
            ? (curr[1] + next[1]) / 2
            : curr[1] +
              ((-180 - curr[0]) / -dLng) * (next[1] - curr[1]);
        currentWest.push([-180, crossLat]);
        if (currentWest.length > 0) westParts.push(currentWest);
        currentWest = [];
        currentEast.push([180, crossLat]);
      }
    }
  }

  // Flush remaining segments
  if (currentEast.length > 0) eastParts.push(currentEast);
  if (currentWest.length > 0) westParts.push(currentWest);

  // Merge all segments on each side into closed rings
  const results: Position[][][] = [];

  const allEast = eastParts.flat();
  if (allEast.length > 2) {
    if (
      allEast[0][0] !== allEast[allEast.length - 1][0] ||
      allEast[0][1] !== allEast[allEast.length - 1][1]
    ) {
      allEast.push([...allEast[0]]);
    }
    results.push([allEast]);
  }

  const allWest = westParts.flat();
  if (allWest.length > 2) {
    if (
      allWest[0][0] !== allWest[allWest.length - 1][0] ||
      allWest[0][1] !== allWest[allWest.length - 1][1]
    ) {
      allWest.push([...allWest[0]]);
    }
    results.push([allWest]);
  }

  return results.length > 0 ? results : [polyCoords];
}

/**
 * Process an entire FeatureCollection, splitting any polygons that
 * cross the antimeridian into multiple polygons.
 */
function splitAntimeridianCrossings(
  fc: FeatureCollection<Polygon | MultiPolygon>,
): FeatureCollection<Polygon | MultiPolygon> {
  const features = fc.features.map((feat) => {
    const geom = feat.geometry;
    if (geom.type === 'Polygon') {
      const splits = splitPolygonAtAntimeridian(geom.coordinates);
      if (splits.length === 1) return feat;
      return {
        ...feat,
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: splits,
        },
      };
    } else if (geom.type === 'MultiPolygon') {
      const allPolys: Position[][][] = [];
      for (const poly of geom.coordinates) {
        allPolys.push(...splitPolygonAtAntimeridian(poly));
      }
      return {
        ...feat,
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: allPolys,
        },
      };
    }
    return feat;
  });
  return { ...fc, features };
}

// The full pipeline (topojson → rewind → antimeridian split → rewind) is
// 100–300 ms of synchronous work on a real device. Memoize the result so
// the prewarm pass on app boot and the real `VisaMap` mount share it.
let _cachedGeoJSON: FeatureCollection<Polygon | MultiPolygon> | null = null;

/**
 * Returns a GeoJSON FeatureCollection of world countries
 * with ISO alpha-3 codes as the `iso_a3` property on each feature.
 *
 * The geometry is post-processed to:
 * 1. Fix polygon winding order for MapLibre GL (RFC 7946 CCW outer rings)
 * 2. Split polygons at the antimeridian (Russia, Fiji, Antarctica)
 *
 * Result is cached at module scope — first call computes, subsequent calls
 * return the cached FeatureCollection.
 */
export function getCountriesGeoJSON(): FeatureCollection<Polygon | MultiPolygon> {
  if (_cachedGeoJSON) return _cachedGeoJSON;

  const countriesObject = worldTopology.objects.countries;
  if (!countriesObject) throw new Error('No countries object in topology');

  const geo = feature(worldTopology, countriesObject) as FeatureCollection<Polygon | MultiPolygon>;

  // Fix winding order: D3/TopoJSON uses CW exterior rings (spherical),
  // but MapLibre expects CCW exterior rings (RFC 7946 / Cartesian plane).
  rewindFeatureCollection(geo);

  // Split polygons that cross the ±180° antimeridian into east/west halves.
  // Without this, MapLibre draws a line straight across the map connecting
  // the eastern and western edges of these countries.
  const split = splitAntimeridianCrossings(geo);

  // Re-apply winding after split (splitting can produce inverted rings)
  rewindFeatureCollection(split);

  // Attach ISO alpha-3 codes
  for (const feat of split.features) {
    const numericId = feat.id as string;
    feat.properties = {
      ...feat.properties,
      iso_a3: NUMERIC_TO_ALPHA3[numericId] || 'UNKNOWN',
    };
  }

  _cachedGeoJSON = split;
  return split;
}

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { resolveCountry, type HeldVisaType, type CountryVisa } from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { cityTemperatures } from '@/data/temperatureData';
import { VisaMap } from '@/components/map/VisaMap';
import { ExploreSheet, type CountryBrief } from '@/components/explore/ExploreSheet';
import SurpriseMeSheet, { type SurpriseMeSheetRef } from '@/components/surprise/SurpriseMeSheet';
import type { Cat } from '@/components/ui/Badge';

// ──────────────────────────────────────────────
// ISO-3 → ISO-2 lookup (for flag rendering)
// ──────────────────────────────────────────────
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: 'AF', ALB: 'AL', DZA: 'DZ', AND: 'AD', AGO: 'AO',
  ATG: 'AG', ARG: 'AR', ARM: 'AM', AUS: 'AU', AUT: 'AT',
  AZE: 'AZ', BHS: 'BS', BHR: 'BH', BGD: 'BD', BRB: 'BB',
  BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ', BTN: 'BT',
  BOL: 'BO', BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN',
  BGR: 'BG', BFA: 'BF', BDI: 'BI', KHM: 'KH', CMR: 'CM',
  CAN: 'CA', CPV: 'CV', CAF: 'CF', TCD: 'TD', CHL: 'CL',
  CHN: 'CN', COL: 'CO', COM: 'KM', COG: 'CG', COD: 'CD',
  CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU', CYP: 'CY',
  CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO',
  ECU: 'EC', EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER',
  EST: 'EE', SWZ: 'SZ', ETH: 'ET', FJI: 'FJ', FIN: 'FI',
  FRA: 'FR', GAB: 'GA', GMB: 'GM', GEO: 'GE', DEU: 'DE',
  GHA: 'GH', GRC: 'GR', GRD: 'GD', GTM: 'GT', GIN: 'GN',
  GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HUN: 'HU',
  ISL: 'IS', IND: 'IN', IDN: 'ID', IRN: 'IR', IRQ: 'IQ',
  IRL: 'IE', ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP',
  JOR: 'JO', KAZ: 'KZ', KEN: 'KE', KIR: 'KI', PRK: 'KP',
  KOR: 'KR', KWT: 'KW', KGZ: 'KG', LAO: 'LA', LVA: 'LV',
  LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI',
  LTU: 'LT', LUX: 'LU', MDG: 'MG', MWI: 'MW', MYS: 'MY',
  MDV: 'MV', MLI: 'ML', MLT: 'MT', MHL: 'MH', MRT: 'MR',
  MUS: 'MU', MEX: 'MX', FSM: 'FM', MDA: 'MD', MCO: 'MC',
  MNG: 'MN', MNE: 'ME', MAR: 'MA', MOZ: 'MZ', MMR: 'MM',
  NAM: 'NA', NRU: 'NR', NPL: 'NP', NLD: 'NL', NZL: 'NZ',
  NIC: 'NI', NER: 'NE', NGA: 'NG', MKD: 'MK', NOR: 'NO',
  OMN: 'OM', PAK: 'PK', PLW: 'PW', PAN: 'PA', PNG: 'PG',
  PRY: 'PY', PER: 'PE', PHL: 'PH', POL: 'PL', PRT: 'PT',
  QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', KNA: 'KN',
  LCA: 'LC', VCT: 'VC', WSM: 'WS', SMR: 'SM', STP: 'ST',
  SAU: 'SA', SEN: 'SN', SRB: 'RS', SYC: 'SC', SLE: 'SL',
  SGP: 'SG', SVK: 'SK', SVN: 'SI', SLB: 'SB', SOM: 'SO',
  ZAF: 'ZA', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR',
  SWE: 'SE', CHE: 'CH', SYR: 'SY', TWN: 'TW', TJK: 'TJ',
  TZA: 'TZ', THA: 'TH', TLS: 'TL', TGO: 'TG', TON: 'TO',
  TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', TUV: 'TV',
  UGA: 'UG', UKR: 'UA', ARE: 'AE', GBR: 'GB', USA: 'US',
  URY: 'UY', UZB: 'UZ', VUT: 'VU', VEN: 'VE', VNM: 'VN',
  YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW', PSE: 'PS', XKX: 'XK',
};

// Map data-layer VisaCategory → Badge Cat
function toBadgeCat(category: string): Cat {
  switch (category) {
    case 'visa-free':
    case 'home':
      return 'free';
    case 'visa-on-arrival':
      return 'arrival';
    case 'evisa':
      return 'evisa';
    case 'visa-required':
    default:
      return 'required';
  }
}

// Map data-layer category string → VisaMap filter key (for passing activeFilters)
function normalizeCategoryKey(category: string): string {
  switch (category) {
    case 'visa-free':
    case 'home':
      return 'visa_free';
    case 'visa-on-arrival':
      return 'visa_on_arrival';
    case 'evisa':
      return 'e_visa';
    case 'visa-required':
    default:
      return 'visa_required';
  }
}

// Build temperature label from countryMeta capital + temperatureData
function buildTemperatureLabel(countryCode: string): string | undefined {
  const meta = countryMeta[countryCode];
  if (!meta) return undefined;
  const temps = cityTemperatures[meta.capital];
  if (!temps) return undefined;
  const month = new Date().getMonth(); // 0-indexed
  const temp = temps[month];
  return `${temp}° ${meta.capital}`;
}

// Build stay stats for StatStrip
function buildStats(country: CountryVisa, heldVisas: Set<HeldVisaType>): Array<{ label: string; value: string }> {
  const resolved = resolveCountry(country, heldVisas);
  const meta = countryMeta[country.code];
  const stats: Array<{ label: string; value: string }> = [];

  if (resolved.days != null) {
    stats.push({ label: 'Stay', value: `${resolved.days}d` });
  } else if (resolved.category === 'visa-free' || resolved.category === 'home') {
    stats.push({ label: 'Stay', value: '∞' });
  }

  if (meta) {
    stats.push({ label: 'Currency', value: meta.currencyCode });
    stats.push({ label: 'TZ', value: meta.timezone });
  }

  return stats.slice(0, 3);
}

// Convert CountryVisa to CountryBrief
function toBrief(country: CountryVisa, heldVisas: Set<HeldVisaType>): CountryBrief {
  const resolved = resolveCountry(country, heldVisas);
  const meta = countryMeta[country.code];
  const iso2 = ALPHA3_TO_ALPHA2[country.code] ?? country.code.slice(0, 2);

  return {
    code: country.code,
    iso2,
    name: country.name,
    region: meta?.region ?? 'World',
    temperature: buildTemperatureLabel(country.code),
    visaCategory: toBadgeCat(resolved.category),
    stats: buildStats(country, heldVisas),
    saved: false,
  };
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const { heldVisas, favorites, passports, residence } = useVisa();
  const dynamicVisaData = useVisaData();

  const heldVisasSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  // Build CountryBrief list — exclude home/passport countries, sort alpha
  const countries = useMemo<CountryBrief[]>(() => {
    return dynamicVisaData
      .filter((c: CountryVisa) => {
        if (c.code === residence) return false;
        if (passports.includes(c.code)) return false;
        return true;
      })
      .sort((a: CountryVisa, b: CountryVisa) => a.name.localeCompare(b.name))
      .map((c: CountryVisa) => {
        const brief = toBrief(c, heldVisasSet);
        return { ...brief, saved: favorites.includes(c.code) };
      });
  }, [dynamicVisaData, heldVisasSet, favorites, passports, residence]);

  // No default selection — user picks via map, carousel, or list.
  const [selectedCode, setSelectedCode] = useState<string>('');

  // "Surprise me" sheet — multi-step picker that lands on a random country.
  const surpriseRef = useRef<SurpriseMeSheetRef>(null);
  const handleSurprisePicked = useCallback((code: string) => {
    setSelectedCode(code);
    router.push(`/country/${code}`);
  }, [router]);

  // When map taps a country (ISO-3), update selected
  const handleMapCountrySelect = useCallback((code: string) => {
    setSelectedCode(code);
  }, []);

  // When sheet selects a country, update selected
  const handleSheetSelectCountry = useCallback((code: string) => {
    setSelectedCode(code);
  }, []);

  // "View details" from featured card
  const handleViewDetails = useCallback(
    (code: string) => {
      router.push(`/country/${code}`);
    },
    [router],
  );

  // Toggle save — stub (saving is out of scope for Phase 2)
  const handleToggleSave = useCallback((code: string) => {
    console.log('[ExploreSheet] toggleSave:', code);
  }, []);

  // Pass empty activeFilters to map (map coloring is always all-countries in this view)
  const emptyFilters = useMemo(() => new Set<string>(), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map fills the entire background */}
      <VisaMap
        activeFilters={emptyFilters}
        heldVisas={new Set(heldVisas)}
        onCountrySelect={handleMapCountrySelect}
        selectedCountry={selectedCode}
        sheetCollapsed={false}
        countries={dynamicVisaData}
      />

      {/* Persistent bottom sheet overlay */}
      <ExploreSheet
        countries={countries}
        selectedCode={selectedCode}
        onSelectCountry={handleSheetSelectCountry}
        onViewDetails={handleViewDetails}
        onToggleSave={handleToggleSave}
        onSurpriseMe={() => surpriseRef.current?.present()}
      />

      {/* Surprise me — multi-step picker that lands on a random country
          tailored to the user's vibes/prefs. */}
      <SurpriseMeSheet
        ref={surpriseRef}
        heldVisas={heldVisasSet}
        onCountrySelected={handleSurprisePicked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

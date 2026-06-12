// Guards the countryMeta.capital → cityTemperatures join.
//
// Every temperature lookup in the app (Atlas explore label, trip-overview
// weather pill) keys cityTemperatures by the countryMeta capital string.
// A silent spelling mismatch ("Bogotá" vs "Bogota") means the country just
// loses its temperature with no error — 21 countries shipped that way once.
// This suite makes any future divergence a hard test failure.

import { countryMeta } from '../countryMeta';
import { cityTemperatures } from '../temperatureData';

// The 21 countries the original audit found silently missing temperatures.
// Kept as an explicit list so a regression on any of them names the country.
const PREVIOUSLY_BROKEN_CODES = [
  'USA', // Washington, D.C.
  'BRA', // Brasilia
  'COL', // Bogota
  'LKA', // Sri Jayawardenepura Kotte
  'MDV', // Male
  'MUS', // Port Louis
  'SYC', // Victoria
  'MDG', // Antananarivo
  'YEM', // Sanaa
  'LUX', // Luxembourg
  'MDA', // Chisinau
  'TGO', // Lome
  'TCD', // N'Djamena
  'CMR', // Yaounde
  'LBR', // Monrovia
  'BDI', // Gitega
  'CRI', // San Jose
  'BOL', // Sucre
  'PRY', // Asuncion
  'FSM', // Palikir
  'VUT', // Port Vila
] as const;

describe('temperatureData ↔ countryMeta capital join', () => {
  it('resolves a temperature series for every countryMeta capital', () => {
    const unresolved = Object.entries(countryMeta)
      .filter(([, meta]) => !cityTemperatures[meta.capital])
      .map(([code, meta]) => `${code} → "${meta.capital}"`);

    expect(unresolved).toEqual([]);
  });

  it('has no orphaned temperature keys (every key is some countryMeta capital)', () => {
    const capitals = new Set(
      Object.values(countryMeta).map((meta) => meta.capital),
    );
    const orphans = Object.keys(cityTemperatures).filter(
      (key) => !capitals.has(key),
    );

    expect(orphans).toEqual([]);
  });

  it.each(PREVIOUSLY_BROKEN_CODES)(
    '%s resolves to a full 12-month series',
    (code) => {
      const meta = countryMeta[code];
      expect(meta).toBeDefined();

      const temps = cityTemperatures[meta.capital];
      expect(temps).toBeDefined();
      expect(temps).toHaveLength(12);
      temps.forEach((t) => expect(typeof t).toBe('number'));
    },
  );

  it('every temperature series has exactly 12 numeric months', () => {
    for (const [city, temps] of Object.entries(cityTemperatures)) {
      expect({ city, length: temps.length }).toEqual({ city, length: 12 });
      temps.forEach((t) => {
        expect(typeof t).toBe('number');
        expect(Number.isFinite(t)).toBe(true);
      });
    }
  });
});

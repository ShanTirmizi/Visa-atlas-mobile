import React from 'react';
import { Text } from 'react-native';
import { VisaHeroCard } from './VisaHeroCard';
import {
  visaData as staticVisaData,
  type CountryVisa,
  type VisaCategory,
} from '@/data/visaData';
import type { VisaHeroCategory } from '@/constants/theme';

interface Props {
  /** Country record. Pass either a full CountryVisa or a minimal {name, code}; missing
   *  fields fall back gracefully. The trip detail screen passes the country looked up
   *  via `staticVisaData.find(c => c.code === trip.countryCode)`. */
  country: CountryVisa;
  /** Effective category after held-visa resolution. May differ from country.category. */
  category: VisaCategory;
  /** Effective max-stay days after held-visa resolution. */
  days?: number;
  /** User's passport ISO-3 codes, used for the visa-free body adjective.
   *  Multiple passports are joined with " / " (e.g. "India / United States"). */
  passports?: string[];
  /** Whether a guide already exists for this country. */
  hasGuide: boolean;
  /** Called when the dark CTA pill is pressed (evisa / required only). */
  onCreateGuide: () => void;
}

export function visaHeroCategoryFor(cat: VisaCategory | string): VisaHeroCategory | null {
  const c = typeof cat === 'string' ? cat.toLowerCase() : cat;
  if (c === 'visa-free' || c === 'home' || c.includes('free')) return 'free';
  if (c === 'visa-on-arrival' || c.includes('arrival')) return 'arrival';
  if (c === 'evisa' || c.includes('evisa') || c.includes('e-visa')) return 'evisa';
  if (c === 'visa-required' || c.includes('required')) return 'required';
  return null;
}

function fmtStayDays(days?: number): string {
  return days ? `${days}d` : '—';
}

function fmtMonthYear(date: Date): string {
  const m = date.toLocaleDateString('en-US', { month: 'short' });
  const y = String(date.getFullYear()).slice(-2);
  return `${date.getDate()} · ${m.toUpperCase()} · ${y}`;
}

function fmtStampDate(processingTime: string, cost: string): string {
  return `${processingTime
    .replace(/\s*days?/i, 'D')
    .replace(/\s*weeks?/i, 'WK')
    .toUpperCase()
    .trim()} · ${cost}`;
}

/** Composes a `<VisaHeroCard />` from a country record + effective category.
 *  Used on the country detail Visa tab and the trip detail Visa tab. */
export function VisaHeroCardForCountry({
  country,
  category,
  days,
  passports,
  hasGuide,
  onCreateGuide,
}: Props) {
  const heroCat = visaHeroCategoryFor(category);
  if (!heroCat) {
    return null;
  }

  const cost = country.cost ?? '—';
  const processingTime = country.processingTime ?? '—';
  const forms = country.forms ?? '—';
  const passportValidity = country.passportValidity ?? '6m+';
  const entries = country.entries ?? (heroCat === 'free' ? '∞' : 'single');

  const passportNames =
    passports && passports.length > 0
      ? passports
          .map((code) => staticVisaData.find((c) => c.code === code)?.name ?? code)
          .join(' / ')
      : null;

  const today = new Date();

  if (heroCat === 'free') {
    return (
      <VisaHeroCard
        category="free"
        kicker="YOU'RE COVERED"
        headlineLine1={days ? 'Visa-free,' : 'Visa-free'}
        headlineLine2={days ? `${days} days` : 'entry'}
        stamp={{ label: 'APPROVED', date: fmtMonthYear(today) }}
        body={
          <>
            {passportNames ? (
              <>
                As a{' '}
                <Text
                  style={{
                    textDecorationLine: 'underline',
                    color: '#FFFFFF',
                    fontWeight: '500',
                  }}
                >
                  {passportNames} passport holder
                </Text>
                {' — '}
              </>
            ) : null}
            {country.notes ?? `No visa needed. Just show up at ${country.name} with your passport.`}
          </>
        }
        meta={[
          { label: 'Stay', value: fmtStayDays(days) },
          { label: 'Entries', value: entries },
          { label: 'Passport', value: passportValidity },
        ]}
      />
    );
  }

  if (heroCat === 'arrival') {
    return (
      <VisaHeroCard
        category="arrival"
        kicker="PAY AT THE GATE"
        headlineLine1="Visa on"
        headlineLine2="arrival"
        stamp={{
          label: 'ON ARRIVAL',
          date: `${cost} · ${fmtStayDays(days).toUpperCase()}`,
        }}
        body={
          <>
            Pay{' '}
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{cost} in cash</Text>{' '}
            at the airport. Bring a passport photo and printed itinerary.
          </>
        }
        meta={[
          { label: 'Stay', value: fmtStayDays(days) },
          { label: 'Cost', value: cost },
          { label: 'Time', value: processingTime },
        ]}
      />
    );
  }

  if (heroCat === 'evisa') {
    return (
      <VisaHeroCard
        category="evisa"
        kicker="APPLY ONLINE"
        headlineLine1="Apply"
        headlineLine2="before you go"
        stamp={{ label: 'E-VISA', date: fmtStampDate(processingTime, cost) }}
        body={
          <>
            Submit on the{' '}
            <Text
              style={{
                textDecorationLine: 'underline',
                color: '#3D1810',
                fontWeight: '500',
              }}
            >
              official portal
            </Text>
            . Approval usually arrives in{' '}
            <Text style={{ color: '#3D1810', fontWeight: '700' }}>{processingTime}</Text>{' '}
            — print before flying.
          </>
        }
        meta={[
          { label: 'Process', value: processingTime },
          { label: 'Fee', value: cost },
          { label: 'Stay', value: fmtStayDays(days) },
        ]}
        onCreateGuide={onCreateGuide}
        ctaLabel={hasGuide ? 'Open your e-visa guide' : 'Create my e-visa guide'}
      />
    );
  }

  // required
  return (
    <VisaHeroCard
      category="required"
      kicker="EMBASSY · IN PERSON"
      headlineLine1="Visa"
      headlineLine2="required"
      stamp={{ label: 'VISA REQ.', date: fmtStampDate(processingTime, cost) }}
      body={
        <>
          Apply at the{' '}
          <Text
            style={{
              textDecorationLine: 'underline',
              color: '#FFFFFF',
              fontWeight: '500',
            }}
          >
            {country.name} embassy
          </Text>
          . Allow{' '}
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{processingTime}</Text>
          : docs, biometrics, interview.
        </>
      }
      meta={[
        { label: 'Process', value: processingTime },
        { label: 'Fee', value: cost },
        { label: 'Forms', value: forms },
      ]}
      onCreateGuide={onCreateGuide}
      ctaLabel={hasGuide ? 'Open your embassy guide' : 'Create my embassy guide'}
    />
  );
}

export default VisaHeroCardForCountry;

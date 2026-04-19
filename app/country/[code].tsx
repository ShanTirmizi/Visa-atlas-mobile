import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { Type } from '@/constants/typography';
import {
  Shadows, Spacing, Radius, type ThemeColors,
} from '@/constants/theme';
import {
  resolveCountry, categoryLabels,
  type HeldVisaType, type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import TripPlannerSheet, { type TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { CircleBtn } from '@/components/ui/CircleBtn';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { Photo } from '@/components/ui/Photo';
import { Flag } from '@/components/ui/Flag';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PillButton } from '@/components/ui/PillButton';
import { StatStrip } from '@/components/ui/StatStrip';
import { SectionKicker } from '@/components/ui/SectionKicker';

// ── Alpha-3 → Alpha-2 flag code map ────────────────────────────────────
/* prettier-ignore */
const A3: Record<string, string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',SWZ:'SZ',ETH:'ET',FJI:'FJ',FIN:'FI',
  FRA:'FR',GAB:'GA',GMB:'GM',GEO:'GE',DEU:'DE',GHA:'GH',GRC:'GR',GRD:'GD',GTM:'GT',GIN:'GN',
  GNB:'GW',GUY:'GY',HTI:'HT',HND:'HN',HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRN:'IR',IRQ:'IQ',
  IRL:'IE',ISR:'IL',ITA:'IT',JAM:'JM',JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KIR:'KI',PRK:'KP',
  KOR:'KR',KWT:'KW',KGZ:'KG',LAO:'LA',LVA:'LV',LBN:'LB',LSO:'LS',LBR:'LR',LBY:'LY',LIE:'LI',
  LTU:'LT',LUX:'LU',MDG:'MG',MWI:'MW',MYS:'MY',MDV:'MV',MLI:'ML',MLT:'MT',MHL:'MH',MRT:'MR',
  MUS:'MU',MEX:'MX',FSM:'FM',MDA:'MD',MCO:'MC',MNG:'MN',MNE:'ME',MAR:'MA',MOZ:'MZ',MMR:'MM',
  NAM:'NA',NRU:'NR',NPL:'NP',NLD:'NL',NZL:'NZ',NIC:'NI',NER:'NE',NGA:'NG',MKD:'MK',NOR:'NO',
  OMN:'OM',PAK:'PK',PLW:'PW',PAN:'PA',PNG:'PG',PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',
  QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',KNA:'KN',LCA:'LC',VCT:'VC',WSM:'WS',SMR:'SM',STP:'ST',
  SAU:'SA',SEN:'SN',SRB:'RS',SYC:'SC',SLE:'SL',SGP:'SG',SVK:'SK',SVN:'SI',SLB:'SB',SOM:'SO',
  ZAF:'ZA',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',TJK:'TJ',
  TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',TUV:'TV',
  UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',VNM:'VN',
  YEM:'YE',ZMB:'ZM',ZWE:'ZW',PSE:'PS',XKX:'XK',
};

function toAlpha2(alpha3: string): string {
  return A3[alpha3.toUpperCase()] ?? '';
}

// ── Visa title from category ────────────────────────────────────────────
function visaTitle(cat: VisaCategory): string {
  const map: Record<VisaCategory, string> = {
    'visa-free': 'Visa-free entry',
    'visa-on-arrival': 'Visa on arrival',
    evisa: 'E-visa required',
    'visa-required': 'Visa required',
    home: 'Home country',
  };
  return map[cat] ?? 'Visa required';
}

// ── Visa body copy from category ────────────────────────────────────────
function visaBody(cat: VisaCategory, days?: number): string {
  if (cat === 'visa-free') {
    return days
      ? `No visa needed. Enjoy up to ${days} days per visit — just show up with your passport.`
      : 'No visa needed — just show up with your passport. Duration depends on officer discretion.';
  }
  if (cat === 'visa-on-arrival') {
    return days
      ? `Pick up your visa stamp at the airport. Maximum stay: ${days} days. Have a return ticket and accommodation proof ready.`
      : 'Get a visa stamp at the port of entry. Have a return ticket and accommodation details ready.';
  }
  if (cat === 'evisa') {
    return 'Apply online before you travel. Processing typically takes 3–7 business days. Keep a printed copy with you.';
  }
  if (cat === 'visa-required') {
    return 'A visa is required before travel. Apply at your nearest embassy or consulate — allow 2–4 weeks for processing.';
  }
  return 'Check the embassy website for up-to-date visa requirements before booking.';
}

// ── Best months names ───────────────────────────────────────────────────
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function bestTimeLabel(months?: number[]): string {
  if (!months || months.length === 0) return '—';
  const sorted = [...months].sort((a, b) => a - b);
  const first = MONTH_SHORT[(sorted[0] - 1 + 12) % 12];
  const last = MONTH_SHORT[(sorted[sorted.length - 1] - 1 + 12) % 12];
  return first === last ? first : `${first} – ${last}`;
}

// ── Category color helpers ──────────────────────────────────────────────
function catFgColor(cat: VisaCategory, c: ThemeColors): string {
  const m: Partial<Record<VisaCategory, string>> = {
    'visa-free': c.visaFree,
    'visa-on-arrival': c.visaOnArrival,
    evisa: c.evisa,
    'visa-required': c.visaRequired,
    home: c.primary,
  };
  return m[cat] ?? c.inkMute;
}
function catBgColor(cat: VisaCategory, c: ThemeColors): string {
  const m: Partial<Record<VisaCategory, string>> = {
    'visa-free': c.visaFreeBg,
    'visa-on-arrival': c.visaOnArrivalBg,
    evisa: c.evisaBg,
    'visa-required': c.visaRequiredBg,
  };
  return m[cat] ?? c.shimmer;
}

// ── Hero height constant ────────────────────────────────────────────────
const HERO_HEIGHT = 340;
const SHEET_OVERLAP = 30;

// ════════════════════════════════════════════════════════════════════════
// Main Screen
// ════════════════════════════════════════════════════════════════════════
export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { heldVisas, isFavorite, toggleFavorite } = useVisa();
  const dynamicVisaData = useVisaData();

  const [tab, setTab] = useState<'Overview' | 'Visa' | 'Tips'>('Overview');
  const [saved, setSaved] = useState(false);

  const country = useMemo(
    () => dynamicVisaData.find((c) => c.code === code) ?? null,
    [code, dynamicVisaData],
  );
  const meta = country ? countryMeta[country.code] ?? null : null;
  const travel = country ? travelData[country.code] ?? null : null;
  const heldSet = useMemo(() => new Set(heldVisas as HeldVisaType[]), [heldVisas]);
  const resolved = country ? resolveCountry(country, heldSet) : null;

  const tripSheetRef = useRef<TripPlannerSheetRef>(null);
  const guideSheetRef = useRef<VisaGuideSheetRef>(null);
  const { isAuthenticated } = useConvexAuth();
  const existingGuide = useQuery(
    api.visaGuides.getGuideByCountry,
    isAuthenticated ? { countryCode: code as string } : 'skip',
  );

  const flagCode = country ? toAlpha2(country.code) : '';

  // ── Sub-row fields ────────────────────────────────────────────────────
  const subRowParts: string[] = [];
  if (meta) {
    if (meta.currency && meta.currencyCode) {
      subRowParts.push(`${meta.currencyCode} · ${meta.currency}`);
    }
    if (meta.timezone) {
      subRowParts.push(meta.timezone);
    }
  }
  const subRow = subRowParts.join(' · ') || (meta?.region ?? '');

  // ── Quick-facts stats ─────────────────────────────────────────────────
  const stats = [
    {
      label: 'Best time',
      value: travel ? bestTimeLabel(travel.bestMonths) : '—',
    },
    {
      label: 'Budget',
      value: travel?.dailyBudget ?? '—',
    },
    {
      label: 'Safety',
      value: '—',   // not in data — flagged in report
    },
  ];

  // ── Not found ────────────────────────────────────────────────────────
  if (!country || !resolved) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }}>
        <CircleBtn
          onPress={() => router.back()}
          style={{ marginLeft: Spacing.lg }}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={colors.ink} />
        </CircleBtn>
        <Text style={[Type.display26, { color: colors.ink, textAlign: 'center', marginTop: 40 }]}>
          Country not found
        </Text>
      </View>
    );
  }

  const catColor = catFgColor(resolved.category, colors);
  const catBg = catBgColor(resolved.category, colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <View style={{ height: HERO_HEIGHT }}>
          {/* Full-bleed photo */}
          <Photo
            tone="sunset"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Dark scrim for text legibility (not a decorative gradient) */}
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.30)',
            }}
          />

          {/* Bottom-weighted scrim — ensures name text is always readable */}
          <View
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 160,
              // LinearGradient is not allowed per no-gradients rule, so we use
              // two stacked semi-transparent views to approximate the dark ramp.
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 80,
              backgroundColor: 'rgba(0,0,0,0.25)',
            }}
          />

          {/* Top nav row: back (left) + heart (right) */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: Spacing.lg,
              right: Spacing.lg,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <CircleBtn
              onPress={() => router.back()}
              solid={false}
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </CircleBtn>

            <CircleBtn
              onPress={() => setSaved((s) => !s)}
              solid={false}
              accessibilityLabel={saved ? 'Remove from saved' : 'Save country'}
            >
              <Heart
                size={16}
                color="#FFFFFF"
                fill={saved ? '#FFFFFF' : 'none'}
              />
            </CircleBtn>
          </View>

          {/* Hero bottom: flag + country name + sub-row */}
          <View
            style={{
              position: 'absolute',
              bottom: SHEET_OVERLAP + 20,
              left: Spacing.lg,
              right: Spacing.lg,
            }}
          >
            {/* Flag + name row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              {flagCode ? (
                <Flag code={flagCode} size={28} />
              ) : null}
              <Text
                style={[Type.display40, { color: '#FFFFFF' }]}
                numberOfLines={2}
              >
                {country.name}
              </Text>
            </View>

            {/* Sub-row: currency + timezone */}
            {subRow ? (
              <Text style={[Type.meta10_5, { color: 'rgba(255,255,255,0.72)', letterSpacing: 0.5 }]}>
                {subRow}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── OVERLAP SHEET ───────────────────────────────────────── */}
        <View
          style={{
            marginTop: -SHEET_OVERLAP,
            backgroundColor: colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingHorizontal: Spacing.lg,
            paddingBottom: insets.bottom + 100, // room for FAB
          }}
        >
          {/* Grab handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.line,
              alignSelf: 'center',
              marginBottom: 18,
            }}
          />

          {/* Tabs */}
          <SegmentedControl
            options={['Overview', 'Visa', 'Tips']}
            value={tab}
            onChange={(v: string) => setTab(v as 'Overview' | 'Visa' | 'Tips')}
            variant="underline"
          />

          {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
          {tab === 'Overview' && (
            <OverviewTab
              colors={colors}
              country={country}
              resolved={resolved}
              catColor={catColor}
              catBg={catBg}
              stats={stats}
              onStartVisa={() => router.push('/more/visas' as never)}
              onDetails={() => {
                if (resolved.category === 'visa-required' || resolved.category === 'evisa') {
                  if (existingGuide) {
                    router.push(`/guide/${existingGuide._id}` as never);
                  } else {
                    guideSheetRef.current?.present();
                  }
                } else {
                  console.log('details stub');
                }
              }}
              showStartVisa={resolved.category === 'visa-required' || resolved.category === 'evisa'}
            />
          )}

          {/* ── VISA TAB stub ─────────────────────────────────────── */}
          {tab === 'Visa' && (
            <View style={{ paddingTop: 8 }}>
              <SectionKicker style={{ marginBottom: 8 }}>Visa details</SectionKicker>
              <Text style={[Type.body14, { color: colors.inkMute }]}>
                Coming soon — full visa application guide, document checklist and embassy links.
              </Text>
            </View>
          )}

          {/* ── TIPS TAB stub ─────────────────────────────────────── */}
          {tab === 'Tips' && (
            <View style={{ paddingTop: 8 }}>
              <SectionKicker style={{ marginBottom: 8 }}>Travel tips</SectionKicker>
              <Text style={[Type.body14, { color: colors.inkMute }]}>
                Coming soon — local tips, safety advice and cultural notes.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── FAB — DarkOrb 56 ────────────────────────────────────── */}
      <DarkOrb
        size={56}
        onPress={() => {
          tripSheetRef.current?.present();
        }}
        accessibilityLabel="Add to trip"
        style={{
          position: 'absolute',
          right: 22,
          bottom: insets.bottom + 96,
          ...Shadows.orb,
        }}
      >
        <Plus size={24} color="#FFFFFF" />
      </DarkOrb>

      {/* ── Bottom sheets (preserved from old screen) ─────────────── */}
      {country && resolved && (
        <TripPlannerSheet
          ref={tripSheetRef}
          country={country}
          meta={meta}
          travel={travel}
          resolved={resolved}
          heldVisas={heldSet}
          onTripCreated={(tripId) => router.replace(`/trip/${tripId}` as never)}
        />
      )}
      {country && resolved && (resolved.category === 'visa-required' || resolved.category === 'evisa') && (
        <VisaGuideSheet
          ref={guideSheetRef}
          countryCode={country.code}
          countryName={country.name}
          heldVisas={heldSet}
          onGuideCreated={(guideId) => router.replace(`/guide/${guideId}` as never)}
        />
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Overview tab content
// ════════════════════════════════════════════════════════════════════════
interface OverviewTabProps {
  colors: ThemeColors;
  country: { category: VisaCategory; days?: number; notes?: string };
  resolved: { category: VisaCategory; days?: number; notes?: string };
  catColor: string;
  catBg: string;
  stats: { label: string; value: string }[];
  onStartVisa: () => void;
  onDetails: () => void;
  showStartVisa: boolean;
}

function OverviewTab({
  colors, country, resolved, catColor, catBg,
  stats, onStartVisa, onDetails, showStartVisa,
}: OverviewTabProps) {
  const bodyText = visaBody(resolved.category, resolved.days);
  const titleText = visaTitle(resolved.category);

  return (
    <>
      {/* ── Visa card ────────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          marginBottom: Spacing.lg,
          ...Shadows.subtle,
        }}
      >
        {/* Kicker */}
        <SectionKicker style={{ color: catColor, marginBottom: 6 }}>
          YOUR VISA
        </SectionKicker>

        {/* Visa title */}
        <Text style={[Type.display22, { color: colors.ink, marginBottom: 8 }]}>
          {titleText}
        </Text>

        {/* Visa body */}
        <Text style={[Type.body14, { color: colors.inkMute, marginBottom: 18, lineHeight: 21 }]}>
          {bodyText}
        </Text>

        {/* Action row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {showStartVisa && (
            <PillButton
              label="Start visa"
              variant="primary"
              onPress={onStartVisa}
              style={{ flex: 1 }}
            />
          )}
          <PillButton
            label="Details"
            variant="soft"
            onPress={onDetails}
            style={showStartVisa ? { flex: 1 } : { alignSelf: 'flex-start', paddingHorizontal: 24 }}
          />
        </View>
      </View>

      {/* ── Quick facts section ─────────────────────────────────── */}
      <SectionKicker style={{ marginBottom: 10 }}>
        QUICK FACTS
      </SectionKicker>
      <StatStrip stats={stats} divided />
    </>
  );
}

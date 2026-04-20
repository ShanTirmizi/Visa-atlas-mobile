import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Sparkles, PlusCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { Type } from '@/constants/typography';
import {
  Shadows, Spacing, Radius, type ThemeColors,
} from '@/constants/theme';
import {
  resolveCountry,
  type HeldVisaType, type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { localInfo } from '@/data/localInfo';
import TripPlannerSheet, { type TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { CircleBtn } from '@/components/ui/CircleBtn';
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

// ── Copy helpers ────────────────────────────────────────────────────────
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
function visaBody(cat: VisaCategory, days?: number): string {
  if (cat === 'visa-free') {
    return days
      ? `No visa needed. Enjoy up to ${days} days per visit — just show up with your passport.`
      : 'No visa needed — just show up with your passport.';
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

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function bestTimeLabel(months?: number[]): string {
  if (!months || months.length === 0) return '—';
  const sorted = [...months].sort((a, b) => a - b);
  const first = MONTH_SHORT[(sorted[0] - 1 + 12) % 12];
  const last = MONTH_SHORT[(sorted[sorted.length - 1] - 1 + 12) % 12];
  return first === last ? first : `${first} – ${last}`;
}

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

const HERO_PHOTO_HEIGHT = 240;

// ════════════════════════════════════════════════════════════════════════
// Main Screen
// ════════════════════════════════════════════════════════════════════════
export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { heldVisas } = useVisa();
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
  const local = country ? localInfo[country.code] ?? null : null;

  const tripSheetRef = useRef<TripPlannerSheetRef>(null);
  const guideSheetRef = useRef<VisaGuideSheetRef>(null);
  const { isAuthenticated } = useConvexAuth();
  const existingGuide = useQuery(
    api.visaGuides.getGuideByCountry,
    isAuthenticated ? { countryCode: code as string } : 'skip',
  );

  const flagCode = country ? toAlpha2(country.code) : '';

  // Photos: countries don't currently carry photoUri in the data layer.
  // When that wiring lands, feed it into the hero. For now we always use
  // the no-photo layout.
  const photoUri: string | undefined = undefined;

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

  const stats = [
    { label: 'Best time', value: travel ? bestTimeLabel(travel.bestMonths) : '—' },
    { label: 'Budget',    value: travel?.dailyBudget ?? '—' },
    { label: 'Safety',    value: '—' },
  ];

  const subRow = [
    meta?.currency && meta.currencyCode ? `${meta.currencyCode} · ${meta.currency}` : null,
    meta?.timezone ?? null,
    meta?.region ?? null,
  ].filter(Boolean).join('  ·  ');

  const visaCat = resolved.category;
  const needsApplication = visaCat === 'visa-required' || visaCat === 'evisa';

  const onStartApplication = () => {
    if (existingGuide) {
      router.push(`/guide/${existingGuide._id}` as never);
    } else {
      guideSheetRef.current?.present();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header (always on paper, ink buttons) ─────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: Spacing.lg,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.background,
        }}
      >
        <CircleBtn solid onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={18} color={colors.ink} strokeWidth={2.25} />
        </CircleBtn>
        <Text style={[Type.title15, { color: colors.ink }]} numberOfLines={1}>
          {country.name}
        </Text>
        <CircleBtn
          solid
          onPress={() => setSaved((s) => !s)}
          accessibilityLabel={saved ? 'Unsave' : 'Save'}
        >
          <Heart
            size={16}
            color={saved ? '#E53E5A' : colors.ink}
            fill={saved ? '#E53E5A' : 'none'}
            strokeWidth={2.25}
          />
        </CircleBtn>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* ── Hero ────────────────────────────────────────────────── */}
        {photoUri ? (
          <View style={{ height: HERO_PHOTO_HEIGHT, marginHorizontal: Spacing.lg, marginBottom: 18, borderRadius: 24, overflow: 'hidden' }}>
            <Photo uri={photoUri} style={StyleSheet.absoluteFillObject} />
            {/* Bottom-weighted darken for legibility */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 140,
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 18,
                right: 18,
                bottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {flagCode ? <Flag code={flagCode} size={24} /> : null}
              <Text style={[Type.display26, { color: '#FFFFFF' }]} numberOfLines={1}>
                {country.name}
              </Text>
            </View>
          </View>
        ) : (
          // Flag-forward header block — no photo, no ugly placeholder
          <View
            style={{
              paddingHorizontal: Spacing.lg,
              paddingTop: 6,
              paddingBottom: 22,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {flagCode ? <Flag code={flagCode} size={72} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={[Type.display32, { color: colors.ink }]} numberOfLines={1}>
                {country.name}
              </Text>
              {subRow ? (
                <Text style={[Type.meta11, { color: colors.inkMute, marginTop: 6 }]} numberOfLines={2}>
                  {subRow}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <SegmentedControl
            options={['Overview', 'Visa', 'Tips']}
            value={tab}
            onChange={(v: string) => setTab(v as 'Overview' | 'Visa' | 'Tips')}
            variant="underline"
          />
        </View>

        {/* ── Tab content ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: 4 }}>
          {tab === 'Overview' && (
            <OverviewTab
              colors={colors}
              catColor={catColor}
              resolved={resolved}
              stats={stats}
              onPlanTrip={() => tripSheetRef.current?.present()}
            />
          )}

          {tab === 'Visa' && (
            <VisaTab
              colors={colors}
              catColor={catColor}
              category={visaCat}
              days={resolved.days}
              needsApplication={needsApplication}
              hasGuide={!!existingGuide}
              onStartApplication={onStartApplication}
            />
          )}

          {tab === 'Tips' && (
            <TipsTab
              colors={colors}
              countryName={country.name}
              local={local}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Preserved sheets ───────────────────────────────────────── */}
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
      {country && resolved && needsApplication && (
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
// OverviewTab
// ════════════════════════════════════════════════════════════════════════
function OverviewTab({
  colors, catColor, resolved, stats, onPlanTrip,
}: {
  colors: ThemeColors;
  catColor: string;
  resolved: { category: VisaCategory; days?: number; notes?: string };
  stats: { label: string; value: string }[];
  onPlanTrip: () => void;
}) {
  return (
    <>
      {/* Visa-at-a-glance card */}
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
        <SectionKicker color={catColor}>YOUR VISA</SectionKicker>
        <Text style={[Type.display22, { color: colors.ink, marginTop: 6 }]}>
          {visaTitle(resolved.category)}
        </Text>
        <Text style={[Type.body14, { color: colors.inkMute, marginTop: 8, lineHeight: 21 }]}>
          {visaBody(resolved.category, resolved.days)}
        </Text>
      </View>

      {/* Quick facts */}
      <SectionKicker style={{ marginBottom: 10 }}>QUICK FACTS</SectionKicker>
      <StatStrip stats={stats} divided />

      {/* Primary CTA — replaces the old floating FAB */}
      <PillButton
        label="Plan a trip"
        variant="primary"
        onPress={onPlanTrip}
        fullWidth
        icon={<Sparkles size={16} color="#FFFFFF" strokeWidth={2} />}
        style={{ marginTop: Spacing.lg }}
      />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// VisaTab
// ════════════════════════════════════════════════════════════════════════
function VisaTab({
  colors, catColor, category, days, needsApplication, hasGuide, onStartApplication,
}: {
  colors: ThemeColors;
  catColor: string;
  category: VisaCategory;
  days?: number;
  needsApplication: boolean;
  hasGuide: boolean;
  onStartApplication: () => void;
}) {
  // Visa-free or on-arrival — inline card, no CTA (or soft "Entry rules")
  if (!needsApplication) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          marginTop: 4,
          ...Shadows.subtle,
        }}
      >
        <SectionKicker color={catColor}>ENTRY RULES</SectionKicker>
        <Text style={[Type.display22, { color: colors.ink, marginTop: 6 }]}>
          {visaTitle(category)}
        </Text>
        <Text style={[Type.body14, { color: colors.inkMute, marginTop: 8, lineHeight: 21 }]}>
          {visaBody(category, days)}
        </Text>
        {category === 'visa-on-arrival' ? (
          <View style={{ marginTop: 14, gap: 6 }}>
            {[
              'Valid passport (6+ months)',
              'Return or onward ticket',
              'Proof of accommodation',
              'Visa fee in cash (USD typically accepted)',
            ].map((item) => (
              <Text key={item} style={[Type.body13, { color: colors.inkSoft }]}>• {item}</Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // Required / E-visa — show guide status and action
  return (
    <View style={{ gap: 14, paddingTop: 4 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          ...Shadows.subtle,
        }}
      >
        <SectionKicker color={catColor}>APPLICATION</SectionKicker>
        <Text style={[Type.display22, { color: colors.ink, marginTop: 6 }]}>
          {visaTitle(category)}
        </Text>
        <Text style={[Type.body14, { color: colors.inkMute, marginTop: 8, lineHeight: 21 }]}>
          {visaBody(category, days)}
        </Text>

        {hasGuide ? (
          <PillButton
            label="Continue your application"
            variant="primary"
            fullWidth
            onPress={onStartApplication}
            style={{ marginTop: 18 }}
          />
        ) : (
          <PillButton
            label="Start visa application"
            variant="primary"
            fullWidth
            icon={<PlusCircle size={16} color="#FFFFFF" strokeWidth={2} />}
            onPress={onStartApplication}
            style={{ marginTop: 18 }}
          />
        )}
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: Radius.lg,
          padding: 14,
        }}
      >
        <Text style={[Type.meta11, { color: colors.inkMute }]}>
          Your visa application is saved per country. Start it once, come back any time to continue.
        </Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TipsTab — pulls from static `localInfo` map. Shows a clean empty state
// when the country is not in the map.
// ════════════════════════════════════════════════════════════════════════
function TipsTab({
  colors, countryName, local,
}: {
  colors: ThemeColors;
  countryName: string;
  local: import('@/data/localInfo').LocalInfo | null;
}) {
  if (!local) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          marginTop: 4,
        }}
      >
        <SectionKicker>TRAVEL TIPS</SectionKicker>
        <Text style={[Type.title17, { color: colors.ink, marginTop: 6 }]}>
          No saved tips for {countryName} yet
        </Text>
        <Text style={[Type.body14, { color: colors.inkMute, marginTop: 8, lineHeight: 21 }]}>
          Tips for this country will be generated on-demand and saved here when you plan your first
          trip. For now, check the embassy website and your airline's entry requirements before
          travel.
        </Text>
      </View>
    );
  }

  const rows: Array<{ kicker: string; body: string | null; bullets?: string[] }> = [
    { kicker: 'TIPPING', body: local.tippingCulture ?? null },
    { kicker: 'MONEY', body: local.currencyTip ?? null },
    { kicker: 'TAP WATER', body: local.tapWater === 'safe' ? 'Tap water is safe to drink.' : local.tapWater === 'unsafe' ? 'Tap water is NOT safe. Drink bottled or filtered water.' : 'Tap water safety varies — stick to bottled or filtered water to be safe.' },
    { kicker: 'SIM & DATA', body: local.simCard ?? null },
    { kicker: 'PLUGS', body: local.plugType ?? null },
    { kicker: 'DRESS CODE', body: local.dressCode ?? null },
  ];
  const bulletRows: Array<{ kicker: string; items: string[] }> = [];
  if (local.scamWarnings?.length) bulletRows.push({ kicker: 'SCAM WARNINGS', items: local.scamWarnings });
  if (local.localCustoms?.length) bulletRows.push({ kicker: 'LOCAL CUSTOMS', items: local.localCustoms });

  return (
    <View style={{ gap: 12, paddingTop: 4 }}>
      {/* Emergency strip */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <SectionKicker color={colors.danger}>EMERGENCY</SectionKicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 }}>
          {[
            { label: 'General', value: local.emergencyNumber },
            { label: 'Police', value: local.policeNumber },
            { label: 'Ambulance', value: local.ambulanceNumber },
            { label: 'Fire', value: local.fireNumber },
          ].map((e) => (
            <View
              key={e.label}
              // 2×2 grid: each tile takes half the row minus the gap.
              style={{
                flexBasis: '48%',
                flexGrow: 1,
                backgroundColor: colors.surfaceMuted,
                borderRadius: Radius.md,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Text
                style={[Type.meta10_5, { color: colors.inkMute, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {e.label}
              </Text>
              <Text style={[Type.title17, { color: colors.ink }]} numberOfLines={1}>
                {e.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Info rows */}
      {rows.filter((r) => r.body).map((r) => (
        <View
          key={r.kicker}
          style={{
            backgroundColor: colors.surface,
            borderRadius: Radius.xl,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <SectionKicker>{r.kicker}</SectionKicker>
          <Text style={[Type.body14, { color: colors.inkSoft, marginTop: 6, lineHeight: 21 }]}>
            {r.body}
          </Text>
        </View>
      ))}

      {/* Bullet rows */}
      {bulletRows.map((r) => (
        <View
          key={r.kicker}
          style={{
            backgroundColor: colors.surface,
            borderRadius: Radius.xl,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <SectionKicker>{r.kicker}</SectionKicker>
          <View style={{ marginTop: 8, gap: 4 }}>
            {r.items.map((item, i) => (
              <Text key={i} style={[Type.body13, { color: colors.inkSoft, lineHeight: 20 }]}>
                • {item}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

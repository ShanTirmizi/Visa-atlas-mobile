import React, { useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { tabSlideIn } from '@/utils/tabAnimation';
import {
  View, Text, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import { Type } from '@/constants/typography';
import {
  Shadows, Spacing, Radius, FontFamily, type ThemeColors,
} from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';
import { Guilloche } from '@/components/ui/Guilloche';
import { ApprovedStamp } from '@/components/ui/ApprovedStamp';
import { BestTimeBar } from '@/components/ui/BestTimeBar';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { VisaHeroCardForCountry } from '@/components/visa/VisaHeroCardForCountry';
import {
  resolveCountry,
  type HeldVisaType, type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { CountryTipsView } from '@/components/tips/CountryTipsView';
import { convertBudget } from '@/utils/currency';
import { bestTimeStatus, bestTimeColor } from '@/utils/bestTime';
import TripPlannerSheet, { type TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';

import { CircleBtn } from '@/components/ui/CircleBtn';
import { Photo } from '@/components/ui/Photo';
import { Flag } from '@/components/ui/Flag';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PillButton } from '@/components/ui/PillButton';
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

  const { heldVisas, residence, passports, isFavorite, toggleFavorite } = useVisa();
  // User's home currency, derived from their residence country.
  const userCurrency = useMemo(
    () => (residence ? countryMeta[residence]?.currencyCode : undefined),
    [residence],
  );
  const dynamicVisaData = useVisaData();

  const [tab, setTab] = useState<'Overview' | 'Visa' | 'Tips'>('Overview');
  // Track previous tab so the directional fade-slide knows which side to
  // come in from when the user taps a different tab.
  const TAB_ORDER: ReadonlyArray<'Overview' | 'Visa' | 'Tips'> = [
    'Overview',
    'Visa',
    'Tips',
  ];
  const prevTabRef = useRef<'Overview' | 'Visa' | 'Tips'>('Overview');
  const tabDirection =
    TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prevTabRef.current) ? 1 : -1;
  useEffect(() => {
    prevTabRef.current = tab;
  }, [tab]);
  // The heart toggles the country in the persisted favorites list (used by
  // the /more/favorites screen). No local "saved" state — favorites is the
  // single source of truth.
  const saved = code ? isFavorite(code) : false;

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

  // Scroll-fade chrome (Apple Music / App Store detail pattern): the fixed
  // nav row floats over full-bleed scroll content, and TopSafeAreaBlur ramps
  // in as content tucks under it. Header height is measured at layout time
  // so the blur band and the content inset always match the real chrome.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const [headerHeight, setHeaderHeight] = useState(insets.top + 56);

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
        <TopSafeAreaBlur />
      </View>
    );
  }

  const catColor = catFgColor(resolved.category, colors);

  // Rich quick-facts: colored best-time dot, localized budget, safety score.
  const btStatus = bestTimeStatus(travel?.bestMonths);
  const btDotColor = bestTimeColor(btStatus, colors);
  const budgetDisplay = travel?.dailyBudget
    ? convertBudget(travel.dailyBudget, userCurrency)
    : '—';
  const safetyDisplay =
    typeof travel?.safetyScore === 'number'
      ? `${travel.safetyScore.toFixed(1)}/10`
      : '—';
  const stats = [
    {
      label: 'Best time',
      value: travel ? bestTimeLabel(travel.bestMonths) : '—',
      dotColor: travel ? btDotColor : undefined,
    },
    { label: 'Budget', value: budgetDisplay },
    { label: 'Safety', value: safetyDisplay },
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
      {/* ── Floating nav row — content scrolls beneath, TopSafeAreaBlur
             frosts the band on scroll (App Store detail pattern) ────── */}
      <View
        // box-none: only the circular buttons capture touches — drags on the
        // rest of the band fall through to the scroll content beneath.
        pointerEvents="box-none"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 110,
          paddingTop: insets.top + 8,
          paddingHorizontal: Spacing.lg,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          onPress={() => code && toggleFavorite(code)}
          accessibilityLabel={saved ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            size={16}
            color={colors.coral}
            fill={saved ? colors.coral : 'none'}
            strokeWidth={2.25}
          />
        </CircleBtn>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* ── Hero ────────────────────────────────────────────────── */}
        {photoUri ? (
          <View style={{ height: HERO_PHOTO_HEIGHT, marginHorizontal: Spacing.lg, marginBottom: 18, borderRadius: 24, overflow: 'hidden' }}>
            <Photo uri={photoUri} style={StyleSheet.absoluteFillObject} />
            {/* Bottom-weighted gradient scrim for legibility — same recipe
                as TripOverviewHero / NextTripHero, never a hard-edged band. */}
            <LinearGradient
              colors={['rgba(0,0,0,0.18)', 'transparent', 'rgba(0,0,0,0.58)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
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
          // Flag-forward Signature v2 header — italic name + coral period + APPROVED stamp
          <View
            style={{
              paddingHorizontal: Spacing.lg,
              paddingTop: 6,
              paddingBottom: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {flagCode ? <Flag code={flagCode} size={56} /> : null}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FontFamily.display,
                  fontSize: 26,
                  fontWeight: '500',
                  letterSpacing: -26 * 0.018,
                  color: colors.ink,
                }}
                numberOfLines={1}
              >
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                  }}
                >
                  {country.name}
                </Text>
                <Text style={{ color: colors.coral }}>.</Text>
              </Text>
              {meta?.region ? (
                <Text
                  style={[
                    Type.kickerSm,
                    {
                      color: colors.inkMute,
                      marginTop: 4,
                      fontSize: 9,
                      letterSpacing: 9 * 0.16,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {meta.region.toUpperCase()}
                  {meta.timezone ? ` · ${meta.timezone}` : ''}
                </Text>
              ) : null}
            </View>
            {existingGuide?.status === 'approved' ? (
              <ApprovedStamp year={new Date().getFullYear()} size={62} />
            ) : null}
          </View>
        )}

        {/* ── Tabs — squiggle variant matches the trip tabs ──── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <SegmentedControl
            options={['Overview', 'Visa', 'Tips']}
            value={tab}
            onChange={(v: string) => setTab(v as 'Overview' | 'Visa' | 'Tips')}
            variant="squiggle"
          />
        </View>

        {/* ── Tab content with directional fade-slide ─────────────── */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: 4 }}>
          {tab === 'Overview' && (
            <Animated.View entering={tabSlideIn(tabDirection * 18)}>
              <OverviewTab
                colors={colors}
                catColor={catColor}
                resolved={resolved}
                bestMonths={travel?.bestMonths}
                budgetDisplay={budgetDisplay}
                safetyDisplay={safetyDisplay}
                onPlanTrip={() => tripSheetRef.current?.present()}
              />
            </Animated.View>
          )}

          {tab === 'Visa' && (
            <Animated.View entering={tabSlideIn(tabDirection * 18)}>
              <VisaHeroCardForCountry
                country={country}
                category={visaCat}
                days={resolved.days}
                passports={passports}
                hasGuide={!!existingGuide}
                onCreateGuide={onStartApplication}
              />
            </Animated.View>
          )}

          {tab === 'Tips' && (
            <Animated.View entering={tabSlideIn(tabDirection * 18)}>
              <CountryTipsView
                countryCode={country.code}
                countryName={country.name}
              />
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>

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

      {/* Frosts the nav band as content scrolls beneath it. The nav row sits
          at zIndex 110 (above the blur's 100) so its buttons stay crisp. */}
      <TopSafeAreaBlur scrollY={scrollY} extra={Math.max(0, headerHeight - insets.top)} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// OverviewTab
// ════════════════════════════════════════════════════════════════════════
function OverviewTab({
  colors, catColor, resolved, bestMonths, budgetDisplay, safetyDisplay, onPlanTrip,
}: {
  colors: ThemeColors;
  catColor: string;
  resolved: { category: VisaCategory; days?: number; notes?: string };
  bestMonths: number[] | undefined;
  budgetDisplay: string;
  safetyDisplay: string;
  onPlanTrip: () => void;
}) {
  return (
    <>
      {/* Visa-at-a-glance — guilloché bg + italic title + coral squiggle */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: 18,
          borderWidth: 1,
          borderColor: colors.line,
          marginBottom: Spacing.lg,
          overflow: 'hidden',
          position: 'relative',
          ...Shadows.subtle,
        }}
      >
        <Guilloche variant="rings" color={colors.teal} opacity={0.04} />
        <Text
          style={[
            Type.kickerSm,
            { color: catColor, fontSize: 9, letterSpacing: 9 * 0.22 },
          ]}
        >
          YOUR VISA
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 24,
            fontWeight: '500',
            letterSpacing: -24 * 0.018,
            color: colors.ink,
            marginTop: 4,
          }}
        >
          {visaTitle(resolved.category)}
        </Text>
        <Squiggle width={110} color={colors.coral} style={{ marginTop: 4 }} />
        <Text style={[Type.body14, { color: colors.inkSoft, marginTop: 10, lineHeight: 21 }]}>
          {visaBody(resolved.category, resolved.days)}
        </Text>
      </View>

      {/* When to go — full-width 12-month climate bar */}
      {bestMonths && bestMonths.length > 0 && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <BestTimeBar bestMonths={bestMonths} />
        </View>
      )}

      {/* Budget + Safety pair */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 18,
            padding: 14,
          }}
        >
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>BUDGET</Text>
          <Text
            style={[
              Type.title17,
              { color: colors.ink, fontSize: 16, marginTop: 4 },
            ]}
            numberOfLines={1}
          >
            {budgetDisplay}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 18,
            padding: 14,
          }}
        >
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>SAFETY</Text>
          <Text
            style={[
              Type.title17,
              { color: colors.ink, fontSize: 16, marginTop: 4 },
            ]}
            numberOfLines={1}
          >
            {safetyDisplay}
          </Text>
        </View>
      </View>

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


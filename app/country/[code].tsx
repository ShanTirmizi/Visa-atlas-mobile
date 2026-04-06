import React, { useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Plane, BookOpen, Star, Globe, Check,
  Clock, DollarSign, Languages, Banknote, Calendar,
  AlertTriangle, Info,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa, useVisaData } from '@/contexts/visa-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import {
  visaData, resolveCountry, categoryLabels, availableVisas,
  type HeldVisaType, type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { getFlightHours } from '@/utils/flightTime';
import TripPlannerSheet, { type TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';

// ── Alpha-3 to flag emoji ───────────────────────────────────────────────
/* prettier-ignore */
const A3: Record<string,string> = {
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
function toFlag(code: string): string {
  const a2 = A3[code.toUpperCase()];
  if (!a2) return '';
  return a2.split('').map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
}

// ── Category color helpers ──────────────────────────────────────────────
function catColor(cat: VisaCategory, c: ThemeColors) {
  const m: Partial<Record<VisaCategory, string>> = {
    'visa-free': c.visaFree, 'visa-on-arrival': c.visaOnArrival,
    evisa: c.evisa, 'visa-required': c.visaRequired, home: c.primary,
  };
  return m[cat] ?? c.textMuted;
}
function catBg(cat: VisaCategory, c: ThemeColors) {
  const m: Partial<Record<VisaCategory, string>> = {
    'visa-free': c.visaFreeBg, 'visa-on-arrival': c.visaOnArrivalBg,
    evisa: c.evisaBg, 'visa-required': c.visaRequiredBg,
  };
  return m[cat] ?? c.shimmer;
}


// ════════════════════════════════════════════════════════════════════════
// Main Screen
// ════════════════════════════════════════════════════════════════════════
export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { heldVisas, isFavorite, toggleFavorite, isVisited, toggleVisited, residence } = useVisa();
  const dynamicVisaData = useVisaData();

  const country = useMemo(() => dynamicVisaData.find((c) => c.code === code) ?? null, [code, dynamicVisaData]);
  const meta = country ? countryMeta[country.code] : null;
  const travel = country ? travelData[country.code] : null;
  const heldSet = useMemo(() => new Set(heldVisas as HeldVisaType[]), [heldVisas]);
  const resolved = country ? resolveCountry(country, heldSet) : null;
  const upgraded = !!(resolved?.upgradedBy?.length) && resolved.category !== country?.category;

  // ── Trip planner sheet ref ───────────────────────────────────────────
  const tripSheetRef = useRef<TripPlannerSheetRef>(null);
  const guideSheetRef = useRef<VisaGuideSheetRef>(null);
  const { isAuthenticated } = useConvexAuth();
  const existingGuide = useQuery(
    api.visaGuides.getGuideByCountry,
    isAuthenticated ? { countryCode: code as string } : 'skip',
  );

  const flag = country ? toFlag(country.code) : '';
  const cost$ = travel ? '$'.repeat(travel.costLevel) : '';
  const flightHours = country ? getFlightHours(residence ?? 'GBR', country.code) : null;
  const s = useMemo(() => makeStyles(colors), [colors]);

  // ── Not found ─────────────────────────────────────────────────────────
  if (!country || !resolved) {
    return (
      <View style={[s.root, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ArrowLeft color={colors.foreground} size={24} />
        </TouchableOpacity>
        <Text style={[s.h1, { color: colors.foreground, textAlign: 'center', marginTop: 40 }]}>
          Country not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.back}>
            <ArrowLeft color={colors.foreground} size={22} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => toggleVisited(country.code)}
            style={[s.iconBtn, {
              borderColor: isVisited(country.code) ? colors.primaryGlow : colors.border,
              backgroundColor: isVisited(country.code) ? colors.primaryBg : 'transparent',
            }]}
          >
            {isVisited(country.code)
              ? <Check size={16} color={colors.primary} />
              : <Globe size={16} color={colors.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleFavorite(country.code)}
            style={[s.iconBtn, {
              borderColor: isFavorite(country.code) ? colors.secondaryGlow : colors.border,
              backgroundColor: isFavorite(country.code) ? colors.secondaryBg : 'transparent',
              marginLeft: Spacing.sm,
            }]}
          >
            <Star size={16}
              color={isFavorite(country.code) ? colors.secondary : colors.textMuted}
              fill={isFavorite(country.code) ? colors.secondary : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* ── FLAG + NAME ──────────────────────────────────────────── */}
        <View style={s.titleRow}>
          <Text style={{ fontSize: 48, lineHeight: 56 }}>{flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.h1, { color: colors.foreground }]}>{country.name}</Text>
            <View style={s.badges}>
              {meta && (
                <View style={[s.badge, { backgroundColor: colors.shimmer, borderColor: colors.borderSubtle }]}>
                  <Text style={[s.badgeTxt, { color: colors.textSecondary }]}>{meta.region}</Text>
                </View>
              )}
              <View style={[s.badge, {
                backgroundColor: catBg(resolved.category, colors),
                borderColor: catColor(resolved.category, colors) + '40',
              }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catColor(resolved.category, colors) }} />
                <Text style={[s.badgeTxt, { color: catColor(resolved.category, colors) }]}>
                  {categoryLabels[resolved.category]}
                </Text>
              </View>
              {upgraded && resolved.upgradedBy!.map((v) => {
                const info = availableVisas.find((x) => x.id === v);
                return (
                  <View key={v} style={[s.badge, { backgroundColor: colors.accentBg, borderColor: colors.accent + '30' }]}>
                    <Text style={[s.badgeTxt, { color: colors.accent }]}>{info?.flag} {info?.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── QUICK INFO ───────────────────────────────────────────── */}
        {(meta || travel) && (
          <View style={s.grid}>
            {travel && <QuickCard icon={<Clock size={16} color="#FFFFFF" />} value={flightHours != null ? `${flightHours}h` : '—'} label="Flight" bg={colors.primary} />}
            {travel && <QuickCard icon={<DollarSign size={16} color="#FFFFFF" />} value={cost$} label="Cost" bg={colors.secondary} />}
            {meta && <QuickCard icon={<Banknote size={16} color="#FFFFFF" />} value={meta.currencyCode} label="Currency" bg={colors.accent} />}
            {meta && <QuickCard icon={<Languages size={16} color="#FFFFFF" />} value={meta.language} label="Language" bg={colors.warning} />}
          </View>
        )}

        {/* ── VISA INFO ────────────────────────────────────────────── */}
        {resolved.days != null && (
          <View style={[s.card, { backgroundColor: catColor(resolved.category, colors), borderWidth: 0 }, Shadows.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xl, color: '#FFFFFF' }}>
                  {resolved.days} days
                </Text>
                <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.70)', marginTop: 2 }}>
                  Maximum stay allowed
                </Text>
              </View>
            </View>
          </View>
        )}

        {resolved.notes && (
          <View style={[s.card, { backgroundColor: colors.primary, borderWidth: 0 }, Shadows.card]}>
            <Text style={[s.label, { color: 'rgba(255,255,255,0.70)' }]}>DETAILS</Text>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 22, color: '#FFFFFF' }}>
              {resolved.notes}
            </Text>
          </View>
        )}

        {country.restrictions && (
          <View style={[s.card, { backgroundColor: colors.danger, borderWidth: 0 }, Shadows.card]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={13} color="#FFFFFF" />
              <Text style={[s.label, { color: 'rgba(255,255,255,0.80)', marginBottom: 0 }]}>RESTRICTIONS</Text>
            </View>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 22, color: '#FFFFFF', marginTop: Spacing.sm }}>
              {country.restrictions}
            </Text>
          </View>
        )}

        {/* ── ACTION BUTTONS ───────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
          <TouchableOpacity
            onPress={() => tripSheetRef.current?.present()}
            style={[s.primaryBtn, { backgroundColor: colors.primary }, Shadows.glow(colors.primary, 0.2)]}
            activeOpacity={0.8}
          >
            <Plane size={18} color={colors.primaryButtonText} />
            <Text style={[s.primaryBtnTxt, { color: colors.primaryButtonText }]}>Plan Trip</Text>
          </TouchableOpacity>

          {(resolved.category === 'visa-required' || resolved.category === 'evisa') && (
            <TouchableOpacity
              onPress={() => {
                if (existingGuide) {
                  router.push(`/guide/${existingGuide._id}`);
                } else {
                  guideSheetRef.current?.present();
                }
              }}
              style={[s.secondaryBtn, { borderColor: colors.accent + '40', backgroundColor: colors.accentBg }]}
              activeOpacity={0.8}
            >
              <BookOpen size={16} color={colors.accent} />
              <Text style={{ fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.sm, color: colors.accent }}>Visa Guide</Text>
            </TouchableOpacity>
          )}
        </View>

        {country.applyAt && (
          <TouchableOpacity
            style={[s.card, { backgroundColor: catBg(resolved.category, colors), borderColor: catColor(resolved.category, colors) + '30', flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => Linking.openURL(country.applyAt!)}
          >
            <Text style={{ fontFamily: FontFamily.condensedMedium, fontSize: FontSize.sm, color: catColor(resolved.category, colors), flex: 1 }}>
              Apply at {country.applyAt.startsWith('http') ? new URL(country.applyAt).hostname.replace('www.', '') : country.applyAt}
            </Text>
            <Text style={{ color: catColor(resolved.category, colors), fontSize: 16 }}>{'\u2197'}</Text>
          </TouchableOpacity>
        )}


        {/* ── DATA FRESHNESS ───────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: Spacing.md, marginTop: Spacing.sm }}>
          <Info size={12} color={colors.textMuted} style={{ opacity: 0.6 }} />
          <Text style={{ flex: 1, fontFamily: FontFamily.condensed, fontSize: FontSize.xs, color: colors.textMuted }}>
            {country.lastVerified
              ? `Last verified: ${country.lastVerified}`
              : 'Data sourced from Henley Index & IATA Timatic, Mar 2026. Verify before travel.'}
          </Text>
        </View>
      </ScrollView>

      {/* ── Trip Planner Bottom Sheet ─────────────────────────── */}
      {country && resolved && (
        <TripPlannerSheet
          ref={tripSheetRef}
          country={country}
          meta={meta}
          travel={travel}
          resolved={resolved}
          heldVisas={heldSet}
          onTripCreated={(tripId) => router.replace(`/trip/${tripId}`)}
        />
      )}
      {country && resolved && (resolved.category === 'visa-required' || resolved.category === 'evisa') && (
        <VisaGuideSheet
          ref={guideSheetRef}
          countryCode={country.code}
          countryName={country.name}
          heldVisas={heldSet}
          onGuideCreated={(guideId) => router.replace(`/guide/${guideId}`)}
        />
      )}
    </View>
  );
}

// ── Quick Info Card ─────────────────────────────────────────────────────
function QuickCard({ icon, value, label, bg }: { icon: React.ReactNode; value: string; label: string; bg: string }) {
  return (
    <View style={{
      flex: 1, minWidth: '45%' as unknown as number,
      alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm,
      borderRadius: 20, backgroundColor: bg,
      gap: Spacing.xs, ...Shadows.card,
    }}>
      {icon}
      <Text numberOfLines={1} style={{ fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: '#FFFFFF' }}>{value}</Text>
      <Text style={{ fontFamily: FontFamily.semibold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.70)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
    back: { width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...Shadows.subtle },
    iconBtn: { width: 36, height: 36, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
    h1: { fontFamily: FontFamily.display, fontSize: FontSize['3xl'], lineHeight: 40, letterSpacing: 0.5 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    badgeTxt: { fontFamily: FontFamily.condensedMedium, fontSize: FontSize.xs, letterSpacing: 0.3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    card: { borderRadius: 20, padding: Spacing.lg, marginBottom: Spacing.md },
    label: { fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.xs, letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm },
    primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: 20 },
    primaryBtnTxt: { fontFamily: FontFamily.bold, fontSize: FontSize.base, letterSpacing: 0.5 },
    secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16, borderRadius: 20, borderWidth: 1.5 },
  });

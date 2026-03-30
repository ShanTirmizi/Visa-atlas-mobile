import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Plane, BookOpen, Star, Globe, Check,
  Clock, DollarSign, Languages, Banknote, Calendar,
  AlertTriangle, Info,
} from 'lucide-react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import {
  FontFamily, FontSize, Spacing, Radius, Shadows, type ThemeColors,
} from '@/constants/theme';
import { endpoints } from '@/constants/api';
import {
  visaData, resolveCountry, categoryLabels, availableVisas,
  type HeldVisaType, type VisaCategory,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';

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

// ── Constants ───────────────────────────────────────────────────────────
const DURATIONS = [3, 5, 7, 10, 14];
const VIBES = [{ v: 'relaxed', l: 'Relaxed' }, { v: 'balanced', l: 'Balanced' }, { v: 'packed', l: 'Action-packed' }];
const BUDGETS = [{ v: 'budget', l: 'Backpacker' }, { v: 'mid', l: 'Comfort' }, { v: 'luxury', l: 'Luxury' }];
const COMPANIONS = [{ v: 'solo', l: 'Solo' }, { v: 'partner', l: 'Partner' }, { v: 'friends', l: 'Friends' }, { v: 'family', l: 'Family' }];
const ACTIVITIES = [
  'Hidden gems', 'Thrill-seeking', 'Foodie', 'Romantic', 'Photography',
  'Nightlife', 'Wellness', 'History', 'Nature walks', 'Shopping',
];
const LOAD_MSGS = [
  'Researching your destination...', 'Planning your day-by-day itinerary...',
  'Finding the best local spots...', 'Scouting hidden gems & restaurants...',
  'Calculating budget breakdown...', 'Checking visa requirements...',
  'Packing your suitcase (virtually)...', 'Scouting car rental options...',
  'Finding the best time to visit...', 'Adding final touches...',
];

// ── Pill Button helper ──────────────────────────────────────────────────
function PillRow({ options, selected, onSelect, activeColor, colors }: {
  options: { v: string; l: string }[];
  selected: string;
  onSelect: (v: string) => void;
  activeColor: string;
  colors: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.v}
          onPress={() => onSelect(o.v)}
          style={{
            flex: 1, alignItems: 'center', paddingVertical: 8,
            borderRadius: Radius.sm, borderWidth: 1,
            borderColor: selected === o.v ? activeColor + '60' : colors.border,
            backgroundColor: selected === o.v ? activeColor + '18' : 'transparent',
          }}
        >
          <Text style={{
            fontFamily: FontFamily.condensedMedium, fontSize: FontSize.xs,
            color: selected === o.v ? activeColor : colors.textSecondary,
          }}>
            {o.l}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Main Screen
// ════════════════════════════════════════════════════════════════════════
export default function CountryDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { heldVisas, isFavorite, toggleFavorite, isVisited, toggleVisited } = useVisa();

  const country = useMemo(() => visaData.find((c) => c.code === code) ?? null, [code]);
  const meta = country ? countryMeta[country.code] : null;
  const travel = country ? travelData[country.code] : null;
  const heldSet = useMemo(() => new Set(heldVisas as HeldVisaType[]), [heldVisas]);
  const resolved = country ? resolveCountry(country, heldSet) : null;
  const upgraded = !!(resolved?.upgradedBy?.length) && resolved.category !== country?.category;

  // ── Trip planner state ────────────────────────────────────────────────
  const [showPlanner, setShowPlanner] = useState(false);
  const [step, setStep] = useState<'duration' | 'prefs' | 'loading'>('duration');
  const [days, setDays] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [vibe, setVibe] = useState('relaxed');
  const [budget, setBudget] = useState('mid');
  const [interests, setInterests] = useState('culture, food, sightseeing');
  const [party, setParty] = useState('solo');
  const [styles, setStyles] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const createTrip = useMutation(api.trips.createTrip);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== 'loading') { setTick(0); return; }
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== 'loading') { progressAnim.setValue(0); return; }
    Animated.timing(progressAnim, {
      toValue: 95 * (1 - Math.exp(-tick / 8)),
      duration: 2500, useNativeDriver: false,
    }).start();
  }, [tick, step, progressAnim]);

  const toggleStyle = useCallback((s: string) => {
    setStyles((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }, []);

  const generate = useCallback(async () => {
    if (!country || !days || !meta || !travel || !resolved) return;
    setStep('loading');
    setError('');
    try {
      const res = await fetch(endpoints.generateTrip, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: country.code, duration: days, heldVisas: [...heldSet],
          vibe, budget, interests, activityStyles: [...styles], travelParty: party,
        }),
      });
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      const tripId = await createTrip({
        ...data, status: 'planned' as const,
        companions: party !== 'solo' ? JSON.stringify({ party }) : undefined,
      });
      Animated.timing(progressAnim, { toValue: 100, duration: 400, useNativeDriver: false }).start(() => {
        router.push(`/trip/${tripId}`);
      });
    } catch {
      setError('Failed to generate trip. Please try again.');
      setStep('prefs');
    }
  }, [country, days, meta, travel, resolved, heldSet, vibe, budget, interests, styles, party, createTrip, progressAnim, router]);

  const flag = country ? toFlag(country.code) : '';
  const cost$ = travel ? '$'.repeat(travel.costLevel) : '';
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
            {travel && <QuickCard icon={<Clock size={16} color={colors.primary} />} value={`${travel.flightHoursFromLondon}h`} label="Flight" colors={colors} />}
            {travel && <QuickCard icon={<DollarSign size={16} color={colors.secondary} />} value={cost$} label="Cost" colors={colors} />}
            {meta && <QuickCard icon={<Banknote size={16} color={colors.accent} />} value={meta.currencyCode} label="Currency" colors={colors} />}
            {meta && <QuickCard icon={<Languages size={16} color={colors.info} />} value={meta.language} label="Language" colors={colors} />}
          </View>
        )}

        {/* ── VISA INFO ────────────────────────────────────────────── */}
        {resolved.days != null && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: catBg(resolved.category, colors), alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={20} color={catColor(resolved.category, colors)} />
              </View>
              <View>
                <Text style={{ fontFamily: FontFamily.condensedBold, fontSize: FontSize.xl, color: catColor(resolved.category, colors) }}>
                  {resolved.days} days
                </Text>
                <Text style={{ fontFamily: FontFamily.condensed, fontSize: FontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                  Maximum stay allowed
                </Text>
              </View>
            </View>
          </View>
        )}

        {resolved.notes && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Text style={[s.label, { color: colors.textMuted }]}>DETAILS</Text>
            <Text style={{ fontFamily: FontFamily.serif, fontSize: FontSize.sm, lineHeight: 22, color: colors.textSecondary }}>
              {resolved.notes}
            </Text>
          </View>
        )}

        {country.restrictions && (
          <View style={[s.card, { backgroundColor: colors.visaRequiredBg, borderColor: colors.visaRequired + '30' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={13} color={colors.visaRequired} />
              <Text style={[s.label, { color: colors.visaRequired, marginBottom: 0 }]}>RESTRICTIONS</Text>
            </View>
            <Text style={{ fontFamily: FontFamily.serif, fontSize: FontSize.sm, lineHeight: 22, color: colors.visaRequired, marginTop: Spacing.sm }}>
              {country.restrictions}
            </Text>
          </View>
        )}

        {/* ── ACTION BUTTONS ───────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
          <TouchableOpacity
            onPress={() => { setShowPlanner(!showPlanner); if (!showPlanner) { setStep('duration'); setDays(null); setError(''); } }}
            style={[s.primaryBtn, { backgroundColor: colors.primary }, Shadows.glow(colors.primary, 0.2)]}
            activeOpacity={0.8}
          >
            <Plane size={18} color={colors.primaryButtonText} />
            <Text style={[s.primaryBtnTxt, { color: colors.primaryButtonText }]}>Plan Trip</Text>
          </TouchableOpacity>

          {(resolved.category === 'visa-required' || resolved.category === 'evisa') && (
            <TouchableOpacity
              onPress={() => router.push(`/guide/${country.code}`)}
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

        {/* ── TRIP PLANNER ─────────────────────────────────────────── */}
        {showPlanner && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Text style={[s.label, { color: colors.textMuted }]}>FULL TRIP PLAN</Text>
            <Text style={{ fontFamily: FontFamily.serif, fontSize: FontSize.xs, color: colors.textMuted, marginBottom: Spacing.sm }}>
              Generate an AI-powered itinerary with budget, packing list, and more
            </Text>

            {/* Duration picker */}
            {step === 'duration' && (
              <>
                <Text style={[s.field, { color: colors.textMuted }]}>How many days?</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                  {DURATIONS.map((d) => (
                    <TouchableOpacity key={d}
                      onPress={() => { setDays(d); setStep('prefs'); }}
                      style={{
                        flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
                        borderRadius: Radius.sm, borderWidth: 1,
                        borderColor: days === d ? colors.primary + '80' : colors.border,
                        backgroundColor: days === d ? colors.primaryBg : 'transparent',
                      }}
                    >
                      <Text style={{ fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.sm, color: days === d ? colors.primary : colors.textSecondary }}>
                        {d}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  <Text style={{ fontFamily: FontFamily.condensed, fontSize: FontSize.xs, color: colors.textMuted }}>Or custom:</Text>
                  <TextInput
                    style={{ width: 60, paddingVertical: 7, paddingHorizontal: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: FontFamily.condensedMedium, fontSize: FontSize.sm, color: colors.foreground, textAlign: 'center' }}
                    keyboardType="number-pad" maxLength={2} placeholder="Days" placeholderTextColor={colors.textMuted}
                    value={customDays} onChangeText={(t) => { setCustomDays(t); const n = parseInt(t); if (n > 0 && n <= 30) setDays(n); }}
                  />
                  <TouchableOpacity
                    onPress={() => { if (days && days > 0) setStep('prefs'); }}
                    disabled={!days}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.primary + '50', backgroundColor: days ? colors.primaryBg : 'transparent', opacity: days ? 1 : 0.4 }}
                  >
                    <Text style={{ fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.sm, color: colors.primary }}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Preferences */}
            {step === 'prefs' && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: FontFamily.condensedMedium, fontSize: FontSize.sm, color: colors.textSecondary }}>
                    {days}-day trip preferences
                  </Text>
                  <TouchableOpacity onPress={() => setStep('duration')}>
                    <Text style={{ fontFamily: FontFamily.condensed, fontSize: FontSize.xs, color: colors.textMuted, textDecorationLine: 'underline' }}>Change</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[s.field, { color: colors.textMuted }]}>Trip Pace</Text>
                <PillRow options={VIBES} selected={vibe} onSelect={setVibe} activeColor={colors.primary} colors={colors} />

                <Text style={[s.field, { color: colors.textMuted }]}>Budget Style</Text>
                <PillRow options={BUDGETS} selected={budget} onSelect={setBudget} activeColor={colors.secondary} colors={colors} />

                <Text style={[s.field, { color: colors.textMuted }]}>Interests</Text>
                <TextInput
                  style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: FontFamily.serif, fontSize: FontSize.sm, color: colors.foreground }}
                  value={interests} onChangeText={setInterests}
                  placeholder="e.g. food, history, hiking" placeholderTextColor={colors.textMuted}
                />

                <Text style={[s.field, { color: colors.textMuted }]}>Activity Style (pick any)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                  {ACTIVITIES.map((a) => (
                    <TouchableOpacity key={a} onPress={() => toggleStyle(a)}
                      style={{
                        paddingHorizontal: Spacing.sm, paddingVertical: 5,
                        borderRadius: Radius.full, borderWidth: 1,
                        borderColor: styles.has(a) ? colors.primary + '70' : colors.border,
                        backgroundColor: styles.has(a) ? colors.primaryBg : 'transparent',
                      }}
                    >
                      <Text style={{ fontFamily: FontFamily.condensedMedium, fontSize: FontSize.xs, color: styles.has(a) ? colors.primary : colors.textMuted }}>
                        {a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.field, { color: colors.textMuted }]}>Traveling with</Text>
                <PillRow options={COMPANIONS} selected={party} onSelect={setParty} activeColor={colors.accent} colors={colors} />

                <TouchableOpacity
                  onPress={generate} activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.primary + '60', backgroundColor: colors.primaryBg, marginTop: Spacing.lg }}
                >
                  <Plane size={18} color={colors.primary} />
                  <Text style={{ fontFamily: FontFamily.condensedBold, fontSize: FontSize.base, color: colors.primary }}>
                    Generate {days}-Day Trip
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface, marginTop: Spacing.md }}>
                <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: Spacing.md }} />
                <Text style={{ fontFamily: FontFamily.serif, fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center', minHeight: 20, marginBottom: Spacing.md }}>
                  {LOAD_MSGS[tick % LOAD_MSGS.length]}
                </Text>
                <View style={{ width: '100%', height: 3, borderRadius: 2, backgroundColor: colors.primaryBg, overflow: 'hidden' }}>
                  <Animated.View style={{
                    height: '100%', borderRadius: 2, backgroundColor: colors.primary,
                    width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                  }} />
                </View>
              </View>
            )}

            {error !== '' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: colors.danger + '30', backgroundColor: colors.dangerBg, marginTop: Spacing.sm }}>
                <Text style={{ flex: 1, fontFamily: FontFamily.serif, fontSize: FontSize.xs, color: colors.danger }}>{error}</Text>
                <TouchableOpacity onPress={() => { setError(''); setStep('duration'); setDays(null); }}
                  style={{ paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.xs, borderWidth: 1, borderColor: colors.danger + '40', marginLeft: Spacing.sm }}
                >
                  <Text style={{ fontFamily: FontFamily.condensedMedium, fontSize: FontSize.xs, color: colors.danger }}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
    </View>
  );
}

// ── Quick Info Card ─────────────────────────────────────────────────────
function QuickCard({ icon, value, label, colors }: { icon: React.ReactNode; value: string; label: string; colors: ThemeColors }) {
  return (
    <View style={{
      flex: 1, minWidth: '45%' as unknown as number,
      alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md, borderWidth: 1,
      borderColor: colors.borderSubtle, backgroundColor: colors.card,
      gap: Spacing.xs, ...Shadows.subtle,
    }}>
      {icon}
      <Text numberOfLines={1} style={{ fontFamily: FontFamily.condensedBold, fontSize: FontSize.lg, color: colors.foreground }}>{value}</Text>
      <Text style={{ fontFamily: FontFamily.condensed, fontSize: FontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
    back: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { width: 36, height: 36, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.lg },
    h1: { fontFamily: FontFamily.display, fontSize: FontSize['3xl'], lineHeight: 40, letterSpacing: 0.5 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    badgeTxt: { fontFamily: FontFamily.condensedMedium, fontSize: FontSize.xs, letterSpacing: 0.3 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    card: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md, ...Shadows.subtle },
    label: { fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.xs, letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm },
    field: { fontFamily: FontFamily.condensedSemibold, fontSize: FontSize.xs, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.xs, marginTop: Spacing.md },
    primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md },
    primaryBtnTxt: { fontFamily: FontFamily.condensedBold, fontSize: FontSize.base, letterSpacing: 0.5 },
    secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1 },
  });

/**
 * Onboarding — Building Screen (step 3 of 3)
 *
 * Data source : visa context (passport + heldVisas + residence) + endpoints.visaMap API
 * Context     : useVisa() — setVisaMap, setOnboarded
 * Navigation  : router.replace('/(tabs)')
 *
 * Business logic + animations preserved verbatim (globe float, typing dots,
 * rotating messages, retry). Visual shell replaced with OnboardingScaffold.
 *
 * Note: Since the CTA fires only after loading completes, the scaffold's onCta
 * maps to handleStartExploring. During loading, the CTA is labelled
 * "Building…" and is visually inert (the press does nothing until done).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { endpoints } from '@/constants/api';
import { passportCountries } from '@/data/passportCountries';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { VAStamp } from '@/components/auth/VAStamp';
import { Squiggle } from '@/components/ui/Squiggle';
import { TypingDots } from '@/components/ui/TypingDots';
import { Type } from '@/constants/typography';

// ── Alpha-3 → flag emoji ─────────────────────────────────────────────────
const A3_TO_A2: Record<string, string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',ETH:'ET',SWZ:'SZ',FJI:'FJ',FIN:'FI',
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
  ZAF:'ZA',SSD:'SS',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',
  TJK:'TJ',TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',
  TUV:'TV',UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',
  VNM:'VN',YEM:'YE',ZMB:'ZM',ZWE:'ZW',
};
function getFlag(a3: string): string {
  const a2 = A3_TO_A2[a3];
  if (!a2) return '';
  return String.fromCodePoint(...a2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// ── Loading messages — travel-flavoured rotation ───────────────────────
const LOAD_MSGS = [
  'Checking visa requirements',
  'Analysing 195 countries',
  'Applying your visa upgrades',
  'Cross-referencing borders',
  'Stamping your passport map',
  'Almost ready',
];

// ── Summary stats ────────────────────────────────────────────────────────
interface SummaryStats {
  visaFree: number;
  onArrival: number;
  evisa: number;
}

// ── Globe animation ──────────────────────────────────────────────────────
function useGlobeAnimation(isActive: boolean) {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      );
    } else {
      translateY.value = withTiming(0, { duration: 300 });
      rotate.value = withTiming(0, { duration: 300 });
    }
  }, [isActive, translateY, rotate]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
type ScreenState = 'loading' | 'summary';

export default function BuildingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [state, setState] = useState<ScreenState>('loading');
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SummaryStats>({ visaFree: 0, onArrival: 0, evisa: 0 });

  const globeStyle = useGlobeAnimation(state === 'loading');

  // Rotate loading messages every 3 s
  useEffect(() => {
    if (state !== 'loading') return;
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [state]);

  // Kick off visa-map generation on mount
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      setState('loading');
      setError('');
      setTick(0);
      try {
        const res = await fetch(endpoints.visaMap, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passports: visa.passports,
            heldVisas: visa.heldVisas,
            residence: visa.residence,
          }),
        });
        if (!res.ok) throw new Error('Generation failed');
        const data = await res.json();
        if (cancelled) return;
        visa.setVisaMap(data.countries);
        visa.setOnboarded(true);
        const countries = data.countries as Array<{ category: string }>;
        setStats({
          visaFree: countries.filter((c) => c.category === 'visa-free').length,
          onArrival: countries.filter((c) => c.category === 'visa-on-arrival').length,
          evisa: countries.filter((c) => c.category === 'evisa').length,
        });
        setState('summary');
      } catch {
        if (!cancelled) setError('Failed to build your visa map. Please try again.');
      }
    };
    generate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    setError('');
    setState('loading');
    setTick(0);
    (async () => {
      try {
        const res = await fetch(endpoints.visaMap, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passports: visa.passports,
            heldVisas: visa.heldVisas,
            residence: visa.residence,
          }),
        });
        if (!res.ok) throw new Error('Generation failed');
        const data = await res.json();
        visa.setVisaMap(data.countries);
        visa.setOnboarded(true);
        const countries = data.countries as Array<{ category: string }>;
        setStats({
          visaFree: countries.filter((c) => c.category === 'visa-free').length,
          onArrival: countries.filter((c) => c.category === 'visa-on-arrival').length,
          evisa: countries.filter((c) => c.category === 'evisa').length,
        });
        setState('summary');
      } catch {
        setError('Failed to build your visa map. Please try again.');
      }
    })();
  }, [visa]);

  const handleStartExploring = useCallback(() => {
    router.replace('/(tabs)/trips' as import('expo-router').Href);
  }, [router]);

  const passportFlags = visa.passports.map((code) => getFlag(code)).join('  ');

  const ctaLabel = state === 'loading' ? 'Building your map…' : 'Start exploring';

  return (
    <OnboardingScaffold
      step={3}
      totalSteps={3}
      title={state === 'loading' ? 'Building your atlas' : "You're all set"}
      body={
        state === 'loading'
          ? undefined
          : `${visa.passports.map((c) => passportCountries.find((p) => p.code === c)?.name ?? c).join(' + ')} passport${visa.passports.length > 1 ? 's' : ''} — and a world to explore.`
      }
      ctaLabel={ctaLabel}
      onCta={state === 'summary' ? handleStartExploring : () => undefined}
      ctaDisabled={state === 'loading'}
      showBack={state === 'loading' ? false : true}
    >
      {/* ── Loading state — VA stamp + rotating message + dots ─── */}
      {state === 'loading' && (
        <View style={styles.centerContent}>
          {/* Floating VA passport stamp — same logo as auth */}
          <Animated.View style={globeStyle}>
            <VAStamp size={140} />
          </Animated.View>

          {/* Rotating message — italic Fraunces ellipsis */}
          <Animated.Text
            key={tick}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 17,
              letterSpacing: -17 * 0.014,
              color: colors.inkSoft,
              textAlign: 'center',
              marginTop: 28,
            }}
          >
            {LOAD_MSGS[tick % LOAD_MSGS.length]}
            <Text style={{ color: colors.coral }}>…</Text>
          </Animated.Text>

          <View style={{ marginTop: 24 }}>
            <TypingDots color={colors.coral} gap={8} />
          </View>

          {/* Error card */}
          {error !== '' && (
            <View
              style={[
                styles.errorCard,
                Shadows.subtle,
                { backgroundColor: colors.dangerBg, borderColor: colors.danger },
              ]}
            >
              <AlertTriangle size={18} color={colors.danger} />
              <Text style={[Type.body13, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
              <TouchableOpacity
                onPress={handleRetry}
                activeOpacity={0.7}
                style={[styles.retryBtn, { backgroundColor: colors.danger }]}
              >
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: '#FFFFFF',
                  }}
                >
                  Try again
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Summary state — passport flags + editorial stats card ─── */}
      {state === 'summary' && (
        <View style={styles.summaryContent}>
          {/* Passport flag emojis (kept — emoji works well at this scale) */}
          <Text style={styles.passportFlags}>{passportFlags}</Text>

          {/* Mono kicker + squiggle above stats */}
          <View style={styles.statsKickerRow}>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 10 * 0.22,
                textTransform: 'uppercase',
                color: colors.inkMute,
              }}
            >
              YOUR ACCESS
            </Text>
            <Squiggle width={28} color={colors.coral} />
          </View>

          {/* Stats row — italic Fraunces values, mono kicker labels */}
          <View
            style={[
              styles.statsRow,
              Shadows.subtle,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <View style={styles.statItem}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 32,
                  lineHeight: 34,
                  letterSpacing: -32 * 0.022,
                  fontWeight: '500',
                  color: colors.visaFree,
                }}
              >
                {stats.visaFree}
                <Text style={{ color: colors.coral }}>.</Text>
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 9 * 0.22,
                  textTransform: 'uppercase',
                  color: colors.inkMute,
                  marginTop: 4,
                }}
              >
                VISA-FREE
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
            <View style={styles.statItem}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 32,
                  lineHeight: 34,
                  letterSpacing: -32 * 0.022,
                  fontWeight: '500',
                  color: colors.visaOnArrival,
                }}
              >
                {stats.onArrival}
                <Text style={{ color: colors.coral }}>.</Text>
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 9 * 0.22,
                  textTransform: 'uppercase',
                  color: colors.inkMute,
                  marginTop: 4,
                }}
              >
                ON ARRIVAL
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
            <View style={styles.statItem}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 32,
                  lineHeight: 34,
                  letterSpacing: -32 * 0.022,
                  fontWeight: '500',
                  color: colors.evisa,
                }}
              >
                {stats.evisa}
                <Text style={{ color: colors.coral }}>.</Text>
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 9,
                  fontWeight: '700',
                  letterSpacing: 9 * 0.22,
                  textTransform: 'uppercase',
                  color: colors.inkMute,
                  marginTop: 4,
                }}
              >
                E-VISA
              </Text>
            </View>
          </View>
        </View>
      )}
    </OnboardingScaffold>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  errorCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 4,
  },
  summaryContent: {
    alignItems: 'center',
    gap: 20,
  },
  passportFlags: {
    fontSize: 52,
    textAlign: 'center',
  },
  statsKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
  },
});

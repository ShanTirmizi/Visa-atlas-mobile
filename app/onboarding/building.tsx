import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, AlertTriangle } from 'lucide-react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { endpoints } from '@/constants/api';
import { passportCountries } from '@/data/passportCountries';

// ── Alpha-3 to flag emoji ────────────────────────────────────────────
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

function getFlag(alpha3: string): string {
  const a2 = A3_TO_A2[alpha3];
  if (!a2) return '';
  return String.fromCodePoint(
    ...a2.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

// ── Loading messages ─────────────────────────────────────────────────
const LOAD_MSGS = [
  'Checking visa requirements...',
  'Analyzing 195 countries...',
  'Applying your visa upgrades...',
  'Calculating access...',
  'Almost ready...',
];

// ── Summary stats shape ──────────────────────────────────────────────
interface SummaryStats {
  visaFree: number;
  onArrival: number;
  evisa: number;
}

// ── Globe animation (same pattern as VisaGuideSheet's shield) ────────
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
        -1,
        true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      translateY.value = withTiming(0, { duration: 300 });
      rotate.value = withTiming(0, { duration: 300 });
    }
  }, [isActive, translateY, rotate]);

  return useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));
}

// ── Typing dots (same as VisaGuideSheet) ─────────────────────────────
function TypingDots({ color }: { color: string }) {
  const dot1 = useSharedValue(0.4);
  const dot2 = useSharedValue(0.4);
  const dot3 = useSharedValue(0.4);

  useEffect(() => {
    const anim = (sv: { value: number }, delay: number) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: delay }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    };
    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ scale: dot1.value }], opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ scale: dot2.value }], opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ scale: dot3.value }], opacity: dot3.value }));

  const dotStyle = { width: 6, height: 6, borderRadius: 3, backgroundColor: color };

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.lg }}>
      <Animated.View style={[dotStyle, s1]} />
      <Animated.View style={[dotStyle, s2]} />
      <Animated.View style={[dotStyle, s3]} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Building Screen
// ══════════════════════════════════════════════════════════════════════
type ScreenState = 'loading' | 'summary';

export default function BuildingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const visa = useVisa();

  const [state, setState] = useState<ScreenState>('loading');
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SummaryStats>({ visaFree: 0, onArrival: 0, evisa: 0 });

  const globeStyle = useGlobeAnimation(state === 'loading');

  // Rotate loading messages every 3 seconds
  useEffect(() => {
    if (state !== 'loading') return;
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [state]);

  // Call the visa-map API on mount
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

        // Save to context
        visa.setVisaMap(data.countries);
        visa.setOnboarded(true);

        // Compute stats
        const countries = data.countries as Array<{ category: string }>;
        const visaFree = countries.filter((c) => c.category === 'visa-free').length;
        const onArrival = countries.filter((c) => c.category === 'visa-on-arrival').length;
        const evisa = countries.filter((c) => c.category === 'evisa').length;
        setStats({ visaFree, onArrival, evisa });
        setState('summary');
      } catch {
        if (!cancelled) {
          setError('Failed to build your visa map. Please try again.');
        }
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
        const visaFree = countries.filter((c) => c.category === 'visa-free').length;
        const onArrival = countries.filter((c) => c.category === 'visa-on-arrival').length;
        const evisa = countries.filter((c) => c.category === 'evisa').length;
        setStats({ visaFree, onArrival, evisa });
        setState('summary');
      } catch {
        setError('Failed to build your visa map. Please try again.');
      }
    })();
  }, [visa]);

  const handleStartExploring = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // Passport flag emojis
  const passportFlags = visa.passports.map((code) => getFlag(code)).join('  ');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      {/* ── Loading state ── */}
      {state === 'loading' && (
        <View style={styles.centerContent}>
          {/* Animated globe */}
          <Animated.View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }, globeStyle]}>
            <Globe size={36} color={colors.primary} />
          </Animated.View>

          {/* Title */}
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Building your visa map...
          </Text>

          {/* Rotating message */}
          <Animated.Text
            key={tick}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={[styles.loadingMsg, { color: colors.textSecondary }]}
          >
            {LOAD_MSGS[tick % LOAD_MSGS.length]}
          </Animated.Text>

          {/* Typing dots */}
          <TypingDots color={colors.primary} />

          {/* Error card */}
          {error !== '' && (
            <View
              style={[
                styles.errorCard,
                Shadows.card,
                { backgroundColor: colors.dangerBg, borderColor: colors.danger },
              ]}
            >
              <AlertTriangle size={18} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              <TouchableOpacity
                onPress={handleRetry}
                activeOpacity={0.7}
                style={[styles.retryBtn, { backgroundColor: colors.danger }]}
              >
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Summary state ── */}
      {state === 'summary' && (
        <View style={styles.centerContent}>
          {/* Title */}
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            You're all set!
          </Text>

          {/* Passport flags */}
          <Text style={styles.passportFlags}>{passportFlags}</Text>

          {/* Passport name(s) */}
          <Text style={[styles.passportNames, { color: colors.textSecondary }]}>
            {visa.passports
              .map((code) => passportCountries.find((c) => c.code === code)?.name ?? code)
              .join(' + ')}{' '}
            passport{visa.passports.length > 1 ? 's' : ''}
          </Text>

          {/* Stats row */}
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.visaFree }]}>{stats.visaFree}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>visa-free</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.visaOnArrival }]}>{stats.onArrival}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>on arrival</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.evisa }]}>{stats.evisa}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>e-visa</Text>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={handleStartExploring}
            activeOpacity={0.7}
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.ctaBtnText}>Start Exploring</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Loading ──
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  loadingTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xl,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  loadingMsg: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    textAlign: 'center',
    minHeight: 20,
  },
  errorCard: {
    marginTop: Spacing['2xl'],
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.xl,
    borderRadius: 20,
    marginTop: Spacing.xs,
  },
  retryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },

  // ── Summary ──
  summaryTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['5xl'],
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  passportFlags: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  passportNames: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    width: '100%',
    marginBottom: Spacing['2xl'],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
  },
  statLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  ctaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    width: '100%',
  },
  ctaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

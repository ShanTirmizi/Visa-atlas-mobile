/**
 * Onboarding — Building Screen (step 3 of 3)
 *
 * Data source : visa context (passport + heldVisas + residence) + endpoints.visaMap API
 * Context     : useVisa() — setVisaMap, setOnboarded
 * Navigation  : router.replace('/(tabs)')
 *
 * Three states drive the entire screen — title, body, CTA, and content all
 * shift together. The pinned CTA carries the action: 'Building…' (inert),
 * 'Try again' (retry), or 'Start exploring' (continue).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { toAlpha2 } from '@/utils/countryCode';

// ── Alpha-3 → flag emoji ─────────────────────────────────────────────────
function getFlag(a3: string): string {
  const a2 = toAlpha2(a3);
  if (!a2 || a2.length !== 2) return '';
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

// ── Stamp pulse for the error state ──────────────────────────────────────
// Slow opacity heartbeat — signals the registry is still reachable, not dead.
function useStampPulse(isActive: boolean) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    if (isActive) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.50, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.30, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, true,
      );
    } else {
      opacity.value = withTiming(0.35, { duration: 200 });
    }
  }, [isActive, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Screen
// ══════════════════════════════════════════════════════════════════════════════
type ScreenState = 'loading' | 'error' | 'summary';

export default function BuildingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const visa = useVisa();

  const [state, setState] = useState<ScreenState>('loading');
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<SummaryStats>({ visaFree: 0, onArrival: 0, evisa: 0 });

  const globeStyle = useGlobeAnimation(state === 'loading');
  const stampPulseStyle = useStampPulse(state === 'error');

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
        // Never persist an empty map — it would mark the account onboarded
        // with no atlas data behind it (the broken state the Atlas tab
        // crash grew from). Treat it like a failed generation instead.
        if (!Array.isArray(data.countries) || data.countries.length === 0) {
          throw new Error('Empty visa map');
        }
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
        if (!cancelled) setState('error');
      }
    };
    generate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
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
        // Same empty-map guard as the mount effect above.
        if (!Array.isArray(data.countries) || data.countries.length === 0) {
          throw new Error('Empty visa map');
        }
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
        setState('error');
      }
    })();
  }, [visa]);

  const handleStartExploring = useCallback(() => {
    router.replace('/(tabs)/trips' as import('expo-router').Href);
  }, [router]);

  const passportFlags = visa.passports.map((code) => getFlag(code)).join('  ');

  const ctaLabel =
    state === 'loading' ? 'Building your map…'
    : state === 'error' ? 'Try again'
    : 'Start exploring';

  const onCta =
    state === 'summary' ? handleStartExploring
    : state === 'error' ? handleRetry
    : () => undefined;

  const title =
    state === 'loading' ? 'Building your atlas'
    : state === 'error' ? "Couldn't build your atlas"
    : "You're all set";

  const body =
    state === 'summary'
      ? `${visa.passports.map((c) => passportCountries.find((p) => p.code === c)?.name ?? c).join(' + ')} passport${visa.passports.length > 1 ? 's' : ''} — and a world to explore.`
      : state === 'error'
      ? 'Our visa registry took longer than expected to respond. Give it another moment below.'
      : undefined;

  return (
    <OnboardingScaffold
      step={3}
      totalSteps={3}
      title={title}
      body={body}
      ctaLabel={ctaLabel}
      onCta={onCta}
      ctaDisabled={state === 'loading'}
      showBack={state !== 'loading'}
    >
      {/* ── Loading state — VA stamp + rotating message + dots ─── */}
      {state === 'loading' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.centerContent}>
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
        </Animated.View>
      )}

      {/* ── Error state — same editorial vocabulary as the rest of the app ─── */}
      {state === 'error' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.centerContent}>
          {/* Dimmed VA stamp — brand stays present, slow heartbeat signals
              we're still reachable, not dead. */}
          <Animated.View style={stampPulseStyle}>
            <VAStamp size={140} />
          </Animated.View>

          {/* Mono kicker · coral squiggle — flight-board / customs-stamp
              vocabulary. Mirrors the scaffold's "STEP 03 · OF 03" pattern. */}
          <View style={styles.errorKickerRow}>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 10 * 0.22,
                textTransform: 'uppercase',
                color: colors.coralDeep,
              }}
            >
              ATLAS · DELAYED
            </Text>
            <Squiggle width={28} color={colors.coral} />
          </View>

          {/* Italic Fraunces line with coral period — premium accent. */}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 19,
              lineHeight: 24,
              letterSpacing: -19 * 0.014,
              fontWeight: '500',
              color: colors.ink,
              textAlign: 'center',
              marginTop: 12,
              maxWidth: 280,
            }}
          >
            The registry didn&apos;t answer in time
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
        </Animated.View>
      )}

      {/* ── Summary state — passport flags + editorial stats card ─── */}
      {state === 'summary' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.summaryContent}>
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
        </Animated.View>
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
  errorKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
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

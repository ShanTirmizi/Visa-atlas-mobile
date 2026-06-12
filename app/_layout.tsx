import React, { useEffect, useMemo, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useConvexAuth } from 'convex/react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fonts
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_600SemiBold_Italic,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';

// Providers
import { ConvexProvider } from '@/contexts/ConvexProvider';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { VisaProvider, useVisa } from '@/contexts/visa-context';
import { CalendarProvider } from '@/contexts/calendar-context';
import { EmailProvider } from '@/contexts/email-context';
import { ToastProvider } from '@/contexts/toast-context';
import { OfflineProvider, useOffline } from '@/contexts/offline-context';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { MapPrewarm } from '@/components/map/MapPrewarm';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import type { ThemeColors } from '@/constants/theme';
import ErrorBoundary from '@/components/ErrorBoundary';

// ── Splash hand-off plumbing ─────────────────────────────────────────────
// Runs at module load — before the first React render — so the underlying
// iOS UIWindow / Android decor view is already painted cream by the time
// the native splash dismisses. Without this, the moment the splash leaves
// the system briefly exposes the window's *default* (white in light mode).
SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync('#F5EFE6').catch(() => {});

// Preload the splash hero image at module load. By the time AnimatedSplash
// mounts and renders <Image source={atlasHero} />, the asset is already in
// memory — no async decode pause that could delay the splash's first paint.
Asset.fromModule(require('@/assets/atlas-hero.png')).downloadAsync().catch(() => {});

// Note: we deliberately do NOT call SplashScreen.setOptions({ fade: true }).
// The cross-fade exposes the underlying surface during the dismiss window,
// which on a heavy provider tree (Convex + 8 contexts) is visible as a
// flicker because <AnimatedSplash> hasn't reached its first paint yet by
// the time the fade starts. The default cut transition swaps in a single
// frame and is perceptually smoother. Confirmed in zoontek/react-native-
// bootsplash#427 and matches the Bluesky pattern.

// ── Pending deep-link stash ──────────────────────────────────────────────
// Deep links that arrive while signed out (visaatlas://invite/CODE) hit the
// auth gate, which bounces to /sign-in — without this stash the tap is
// silently swallowed. The gate stores the concrete path here and replays it
// once auth (and, for brand-new accounts, onboarding) completes. Module
// scope on purpose: survives layout re-renders within a session but resets
// on a fresh launch, so a stale invite can never replay days later.
let pendingAuthRedirect: string | null = null;

// ── Cached-session probe (offline cold start) ────────────────────────────
// Convex auth needs a network round-trip, so offline `useConvexAuth()` never
// leaves isLoading and the splash gate would hold forever. This peeks at the
// same token @convex-dev/auth persists: key `__convexAuthJWT_${namespace}`
// where namespace defaults to the deployment URL with non-alphanumerics
// stripped (dist/react/client.js JWT_STORAGE_KEY + useNamespacedStorage;
// index.js `storageNamespace ?? client.address`). Same SecureStore →
// AsyncStorage fallback as contexts/ConvexProvider.tsx. A present token is
// treated optimistically — if it turns out expired, reconnecting resolves
// real auth and the normal gate routes to sign-in (Apple Mail behavior:
// show cached data offline, revalidate on reconnect).
async function hasCachedAuthSession(): Promise<boolean> {
  const namespace = (process.env.EXPO_PUBLIC_CONVEX_URL ?? '').replace(
    /[^a-zA-Z0-9]/g,
    '',
  );
  const key = `__convexAuthJWT_${namespace}`;
  try {
    const token = await SecureStore.getItemAsync(key);
    if (token) return true;
  } catch {
    // SecureStore unavailable (e.g. simulator keychain) — fall through.
  }
  try {
    return (await AsyncStorage.getItem(key)) !== null;
  } catch {
    return false;
  }
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { isAuthenticated, isLoading } = useConvexAuth();
  const { onboarded, loaded: visaLoaded, needsAtlasRebuild } = useVisa();
  const { isOffline } = useOffline();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  // Animated splash: plays once on first mount. We render it as long as it
  // hasn't finished yet OR auth hasn't resolved — whichever takes longer.
  const [splashFinished, setSplashFinished] = useState(false);

  // Cached-session probe for the offline cold-start path. Checked eagerly
  // (not only once offline is detected) so the answer is already settled by
  // the time NetInfo reports offline. `null` = probe still running.
  const [hasCachedSession, setHasCachedSession] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void hasCachedAuthSession().then((has) => {
      if (!cancelled) setHasCachedSession(has);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-link taps on trip-ready notifications → that trip's screen.
  // Lazily required + fully guarded: dev clients built before the
  // expo-notifications module was added must not crash at import time.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sub: any;
    try {
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response: any) => {
          const tripId =
            response?.notification?.request?.content?.data?.tripId;
          if (typeof tripId === 'string') {
            router.push(`/trip/${tripId}` as never);
          }
        },
      );
    } catch {
      // Native module absent in this binary — notifications are an
      // enhancement, never a crash.
    }
    return () => {
      try {
        sub?.remove();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth gate: redirect based on auth state
  useEffect(() => {
    // Widen the typed segment tuple — expo-router types `segments` per
    // route-tree depth, which rejects index 1 on single-segment routes.
    const seg = segments as string[];
    const inAuthGroup =
      seg[0] === 'sign-in' ||
      seg[0] === 'forgot-password';
    const inOnboarding = seg[0] === 'onboarding';
    const inPublicLegal =
      seg[0] === 'more' &&
      (seg[1] === 'terms' || seg[1] === 'privacy-policy');

    if (isLoading || !visaLoaded) {
      // ── Offline cold start ────────────────────────────────────────────
      // Convex auth can't settle without the network, so offline this gate
      // would wait forever (and the splash with it). Route on local
      // evidence instead: a cached session token means the user was signed
      // in — leave them where they are (index → tabs, served from the
      // SQLite offline cache + AsyncStorage visa cache); no token means
      // they're truly signed out — show sign-in rather than hanging.
      // Reconnecting resolves real auth and the normal gate takes over.
      if (isOffline && hasCachedSession !== null && visaLoaded) {
        if (!hasCachedSession && !inAuthGroup && !inPublicLegal) {
          router.replace('/sign-in');
        }
      }
      return;
    }

    if (!isAuthenticated && !inAuthGroup && !inPublicLegal) {
      // Stash invite deep links before bouncing to sign-in — the authed
      // branches below replay the path so the tap isn't swallowed.
      if (pathname.startsWith('/invite/')) {
        pendingAuthRedirect = pathname;
      }
      router.replace('/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      if (!onboarded || needsAtlasRebuild) {
        // Keep any pending invite stashed — it replays via the branch
        // below once onboarding lands the user on the tabs.
        router.replace('/onboarding');
      } else {
        const redirect = pendingAuthRedirect;
        pendingAuthRedirect = null;
        router.replace((redirect ?? '/(tabs)/trips') as never);
      }
    } else if (isAuthenticated && !inOnboarding && !inAuthGroup) {
      if (!onboarded || needsAtlasRebuild) {
        // `needsAtlasRebuild`: account is onboarded server-side but has no
        // server visa profile AND no local visa map (pre-sync account after
        // a reinstall) — the atlas would render grey and untappable. Send
        // them through onboarding: `building` regenerates the map, which
        // clears the flag (local visaMap non-null) and the visa-context
        // push effect persists it server-side so it never recurs.
        router.replace('/onboarding');
      } else if (pendingAuthRedirect) {
        // Deep link arrived signed-out and the user has just cleared auth
        // (and possibly onboarding) — land them on the stashed path.
        const redirect = pendingAuthRedirect;
        pendingAuthRedirect = null;
        router.replace(redirect as never);
      }
    }
  }, [
    isAuthenticated,
    isLoading,
    segments,
    pathname,
    onboarded,
    needsAtlasRebuild,
    visaLoaded,
    isOffline,
    hasCachedSession,
  ]);

  // Animated splash plays on first launch. The splash sticks around until
  // both the entry animation has played AND auth has resolved — so a slow
  // auth round-trip won't dump the user onto a half-loaded screen.
  //
  // Offline cold start can never satisfy `!isLoading` (Convex auth needs a
  // network round-trip), so it gets its own release: NetInfo says offline,
  // the local visa cache has loaded, and the cached-session probe has
  // settled. The auth gate above routes to the cached-data UI or sign-in
  // accordingly — no arbitrary timeout needed, every input is a real state
  // signal.
  if (!splashFinished) {
    const offlineRelease =
      isOffline && hasCachedSession !== null && visaLoaded;
    return (
      <View style={[styles.container, { backgroundColor: '#F5EFE6' }]}>
        <StatusBar style="dark" />
        <AnimatedSplash
          canFadeOut={(!isLoading && visaLoaded) || offlineRelease}
          onAnimationDone={() => setSplashFinished(true)}
        />
      </View>
    );
  }

  // Pre-warm the Atlas map once the user is past auth + onboarding so the
  // first tap on the Atlas tab finds a hot MapLibre tile cache and a hot
  // GeoJSON module cache. Renders a 1×1 hidden MapView and dynamically
  // imports the country GeoJSON pipeline. See `MapPrewarm` for details.
  const shouldPrewarmMap = isAuthenticated && onboarded && visaLoaded;

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineIndicator />
      {shouldPrewarmMap ? <MapPrewarm /> : null}
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="trip/[id]/index"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="guide/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="country/[code]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="chat/[tripId]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="visa-chat/[guideId]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="more/visas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/favorites" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/visited" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/passport" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/edit-passport" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/edit-residence" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/calendar" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/email" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/privacy-policy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/terms" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
          <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="email-connected" options={{ animation: 'none' }} />
          <Stack.Screen name="invite/[code]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="trip/invite" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ErrorBoundary>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Fraunces_700Bold,
  });

  // While fonts load, render a placeholder that's PIXEL-IDENTICAL to the
  // native splash and to <AnimatedSplash>'s at-rest state — same cream bg,
  // same Atlas image at the same 290px size, centered. If for any reason
  // the native splash dismisses early (race, dev-client weirdness, etc.),
  // what's underneath is visually identical to what was just on screen.
  // No flicker is possible because there's nothing for the eye to see
  // change. The image is preloaded at module load (Asset.downloadAsync) so
  // it renders synchronously without an async decode pause.
  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F5EFE6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('@/assets/atlas-hero.png')}
          style={{ width: 290, height: 290 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <ErrorBoundary>
      <ConvexProvider>
        <OfflineProvider>
          <ThemeProvider>
            <VisaProvider>
              <CalendarProvider>
                <EmailProvider>
                  <SafeAreaProvider>
                    <ToastProvider>
                      <BottomSheetModalProvider>
                        <ThemedApp />
                      </BottomSheetModalProvider>
                    </ToastProvider>
                  </SafeAreaProvider>
                </EmailProvider>
              </CalendarProvider>
            </VisaProvider>
          </ThemeProvider>
        </OfflineProvider>
      </ConvexProvider>
      </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

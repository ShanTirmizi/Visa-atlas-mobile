import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useConvexAuth } from 'convex/react';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

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

// Providers
import { ConvexProvider } from '@/contexts/ConvexProvider';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { VisaProvider, useVisa } from '@/contexts/visa-context';
import { CalendarProvider } from '@/contexts/calendar-context';
import { EmailProvider } from '@/contexts/email-context';
import { ToastProvider } from '@/contexts/toast-context';
import { OfflineProvider } from '@/contexts/offline-context';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { FontFamily, FontSize } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import ErrorBoundary from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { isAuthenticated, isLoading } = useConvexAuth();
  const { onboarded, loaded: visaLoaded } = useVisa();
  const segments = useSegments();
  const router = useRouter();

  // Auth gate: redirect based on auth state
  useEffect(() => {
    if (isLoading || !visaLoaded) return;
    const inAuthGroup = segments[0] === 'sign-in' || segments[0] === 'sign-in-email';
    const inOnboarding = segments[0] === 'onboarding';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      if (!onboarded) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !onboarded && !inOnboarding && !inAuthGroup) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, segments, onboarded, visaLoaded]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F0' }]}>
        <StatusBar style="dark" />
        <Image
          source={require('@/assets/icon.png')}
          style={{ width: 120, height: 120, borderRadius: 28 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineIndicator />
      <ErrorBoundary>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="trip/[id]"
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
          <Stack.Screen name="more/visas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/favorites" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/visited" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/edit-passport" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/edit-residence" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/calendar" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/email" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/privacy-policy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/terms" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
          <Stack.Screen name="sign-in-email" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="email-connected" options={{ animation: 'none' }} />
          <Stack.Screen name="invite/[code]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="trip/invite" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ErrorBoundary>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Diagnostic: log state + force-hide splash after 4s even if fonts hang,
  // so we can see what's actually rendering behind the native splash.
  const [forceReady, setForceReady] = React.useState(false);
  useEffect(() => {
    console.log('[RootLayout] mount, fontsLoaded=', fontsLoaded, 'fontsError=', fontsError);
    const t = setTimeout(() => {
      console.log('[RootLayout] 4s timeout, forcing splash hide');
      setForceReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      console.log('[RootLayout] fonts loaded, hiding splash');
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded && !forceReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

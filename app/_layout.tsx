import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import {
  Lora_400Regular,
  Lora_500Medium,
  Lora_600SemiBold,
  Lora_700Bold,
  Lora_400Regular_Italic,
} from '@expo-google-fonts/lora';
import {
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';

// Providers
import { ConvexProvider } from '@/contexts/ConvexProvider';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { VisaProvider } from '@/contexts/visa-context';
import { CalendarProvider } from '@/contexts/calendar-context';
import { EmailProvider } from '@/contexts/email-context';
import { ToastProvider } from '@/contexts/toast-context';
import { FontFamily, FontSize } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const router = useRouter();

  // Auth gate: redirect based on auth state
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'sign-in' || segments[0] === 'sign-in-email';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 36, color: colors.foreground }}>
          VISA ATLAS
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerBackTitleVisible: false,
          title: '',
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="trip/[id]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
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
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in-email" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="email-connected" options={{ animation: 'none' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    Lora_400Regular_Italic,
    BarlowCondensed_400Regular,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexProvider>
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
      </ConvexProvider>
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

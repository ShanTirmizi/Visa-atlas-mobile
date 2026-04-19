// ════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC LAYOUT — temporary. Original is preserved at _layout.tsx.backup.
//
// Strips every import and provider to answer one question: IS JS RUNNING?
//
// Expected: bright red full-screen with "DIAGNOSTIC OK" in white, after
// the native launch splash dismisses within ~500ms of launch.
//
// If you still see the peach splash: JS is not executing on the device.
// That tells us the crash is in module evaluation or bundle delivery,
// not in our provider stack.
// ════════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash from auto-hiding before we mount.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Log immediately when the module evaluates.
  // eslint-disable-next-line no-console
  console.log('[DIAGNOSTIC] RootLayout module evaluated');

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[DIAGNOSTIC] RootLayout mounted, hiding splash');
    SplashScreen.hideAsync().catch((e) => {
      // eslint-disable-next-line no-console
      console.log('[DIAGNOSTIC] hideAsync error:', e);
    });
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#D32F2F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 42,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        DIAGNOSTIC OK
      </Text>
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 15,
          marginTop: 24,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        JS is executing on device.{'\n'}
        Splash was dismissed successfully.{'\n'}
        The original hang is in a provider or font load, not in RN itself.
      </Text>
    </View>
  );
}

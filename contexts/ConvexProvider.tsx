import React from 'react';
import { Platform } from 'react-native';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// SecureStore with AsyncStorage fallback for simulator keychain issues
const storage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={
        Platform.OS === 'android' || Platform.OS === 'ios'
          ? storage
          : undefined
      }
    >
      {children}
    </ConvexAuthProvider>
  );
}

export { convex };

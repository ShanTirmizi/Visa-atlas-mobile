import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/navigation/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="compare" />
      <Tabs.Screen name="guides" />
    </Tabs>
  );
}

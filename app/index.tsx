/**
 * Root index — resolves the bare `/` URL. The auth gate in `_layout.tsx`
 * redirects to `/sign-in`, `/onboarding`, or `/(tabs)/trips` based on state.
 * This component just needs to render *something* so expo-router has a matched
 * route for `/` and actually calls our `_layout.tsx`.
 */
import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/trips" />;
}

import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Deep link handler for Gmail OAuth callback.
 * URL: visaatlas://email-connected?provider=gmail&email=user@gmail.com
 *
 * This screen is never visible — it immediately redirects to the More tab.
 * The EmailProvider context will pick up the new account via its Convex query.
 */
export default function EmailConnectedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    provider?: string;
    email?: string;
    error?: string;
  }>();

  useEffect(() => {
    // Navigate to More tab (which shows Email Sync section)
    // The EmailProvider will auto-detect the new account via Convex
    router.replace('/(tabs)/more');
  }, []);

  return null;
}

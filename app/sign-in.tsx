import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, Mail, Plane, MapPin } from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { makeRedirectUri } from 'expo-auth-session';
import { openAuthSessionAsync } from 'expo-web-browser';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

export default function SignInScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const redirectTo = makeRedirectUri();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { redirect } = await signIn('google', { redirectTo });
      if (Platform.OS === 'web') return;
      if (redirect) {
        const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
        if (result.type === 'success') {
          const code = new URL(result.url).searchParams.get('code');
          if (code) {
            await signIn('google', { code });
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error?.message || 'Google sign in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const { redirect } = await signIn('apple', { redirectTo });
      if (Platform.OS === 'web') return;
      if (redirect) {
        const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
        if (result.type === 'success') {
          const code = new URL(result.url).searchParams.get('code');
          if (code) {
            await signIn('apple', { code });
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Sign In Failed', error?.message || 'Apple sign in failed');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      {/* Hero section */}
      <View style={styles.heroSection}>
        {/* Decorative icons */}
        <View style={styles.iconRow}>
          <View style={[styles.decorIcon, { backgroundColor: colors.primaryBg }]}>
            <Globe color={colors.primary} size={20} />
          </View>
          <View style={[styles.decorIcon, { backgroundColor: colors.accentBg }]}>
            <Plane color={colors.accent} size={20} />
          </View>
          <View style={[styles.decorIcon, { backgroundColor: colors.secondaryBg }]}>
            <MapPin color={colors.secondary} size={20} />
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          VISA ATLAS
        </Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Plan smarter. Travel further.
        </Text>

        {/* Feature pills */}
        <View style={styles.featurePills}>
          {['195+ Countries', 'Visa Tracking', 'Trip Planning'].map((text) => (
            <View
              key={text}
              style={[styles.pill, { backgroundColor: colors.primary + '15' }]}
            >
              <Text style={[styles.pillText, { color: colors.primary }]}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Auth section */}
      <View
        style={[
          styles.authSection,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderColor: colors.border,
          },
          Shadows.card,
        ]}
      >
        <Text style={[styles.authTitle, { color: colors.foreground }]}>
          Get Started
        </Text>

        {/* Google button */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
          disabled={googleLoading || appleLoading}
          style={[
            styles.socialButton,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <View style={styles.googleLogoWrap}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={[styles.socialText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple button */}
        <TouchableOpacity
          onPress={handleAppleSignIn}
          activeOpacity={0.8}
          disabled={googleLoading || appleLoading}
          style={[styles.socialButton, styles.appleButton]}
        >
          {appleLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
              <Text style={[styles.socialText, { color: '#FFFFFF' }]}>
                Continue with Apple
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Email button — styled as a full button, not just a link */}
        <TouchableOpacity
          onPress={() => router.push('/sign-in-email')}
          activeOpacity={0.8}
          style={[styles.emailButton, { backgroundColor: colors.primary }]}
        >
          <Mail color="#FFFFFF" size={18} />
          <Text style={styles.emailButtonText}>
            Continue with Email
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        By continuing, you agree to our{' '}
        <Text
          style={[styles.footerLink, { color: colors.primary }]}
          onPress={() => router.push('/more/terms' as any)}
        >
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text
          style={[styles.footerLink, { color: colors.primary }]}
          onPress={() => router.push('/more/privacy-policy' as any)}
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  decorIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 52,
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.lg,
    marginTop: Spacing.xs,
  },
  featurePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  pillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Auth card
  authSection: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: 12,
  },
  authTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },

  // Social buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: Radius.md,
    gap: 10,
  },
  googleLogoWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleG: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  socialText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },

  // Email button
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: Radius.md,
    gap: 10,
  },
  emailButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  // Footer
  footer: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  footerLink: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
});

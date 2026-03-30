import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail } from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();

  const handleGoogleSignIn = async () => {
    try {
      await signIn('google');
    } catch (error) {
      console.error('Google sign in failed:', error);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signIn('apple');
    } catch (error) {
      console.error('Apple sign in failed:', error);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      {/* Top section — branding */}
      <View style={styles.topSection}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          VISA ATLAS
        </Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Plan smarter. Travel further.
        </Text>
      </View>

      {/* Bottom section — auth buttons */}
      <View style={styles.bottomSection}>
        {/* Google button */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
          style={[styles.socialButton, styles.googleButton]}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Apple button */}
        <TouchableOpacity
          onPress={handleAppleSignIn}
          activeOpacity={0.8}
          style={[styles.socialButton, styles.appleButton]}
        >
          <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
          <Text style={styles.appleText}>Continue with Apple</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>
            or
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Email link */}
        <TouchableOpacity
          onPress={() => router.push('/sign-in-email')}
          activeOpacity={0.7}
          style={styles.emailLink}
        >
          <Mail color={colors.primary} size={18} />
          <Text style={[styles.emailLinkText, { color: colors.primary }]}>
            Sign in with Email
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  // Top section
  topSection: {
    alignItems: 'center',
    marginTop: Spacing['5xl'],
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['5xl'],
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.lg,
    marginTop: Spacing.sm,
  },
  // Bottom section
  bottomSection: {
    gap: 14,
  },
  // Social buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Radius.sm,
    gap: 12,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleIcon: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: '#4285F4',
  },
  googleText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#1F1F1F',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleIcon: {
    fontSize: FontSize.xl,
    color: '#FFFFFF',
  },
  appleText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  // Email link
  emailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emailLinkText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
});

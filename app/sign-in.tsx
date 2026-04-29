import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { makeRedirectUri } from 'expo-auth-session';
import { openAuthSessionAsync } from 'expo-web-browser';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, ThemeColors } from '@/constants/theme';
import { tabSlideIn } from '@/utils/tabAnimation';
import { Guilloche } from '@/components/ui/Guilloche';
import { Squiggle } from '@/components/ui/Squiggle';
import { VAStamp } from '@/components/auth/VAStamp';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = 'signIn' | 'signUp';
const TAB_ORDER: Mode[] = ['signIn', 'signUp'];

// ─── UnderlineField ───────────────────────────────────────────────────────────
interface UnderlineFieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address';
  colors: ThemeColors;
}

function UnderlineField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  colors,
}: UnderlineFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 22 }}>
      <Text
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 10,
          fontWeight: '700',
          color: colors.inkMute,
          letterSpacing: 10 * 0.22,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: value ? FontFamily.displayItalic : FontFamily.regular,
          fontStyle: value ? 'italic' : 'normal',
          fontSize: 18,
          color: colors.ink,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: focused ? colors.coral : colors.line,
        }}
      />
    </View>
  );
}

// ─── Inline Error Banner ──────────────────────────────────────────────────────
function ErrorBanner({ error, colors }: { error: string | null; colors: ThemeColors }) {
  if (!error) return null;
  return (
    <View
      style={{
        backgroundColor: colors.coralBg,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.coralSoft,
      }}
    >
      <Text
        style={{
          fontFamily: FontFamily.medium,
          fontSize: 13,
          lineHeight: 19,
          color: colors.coralDeep,
        }}
      >
        {error}
      </Text>
    </View>
  );
}

// ─── Sign-In Form ─────────────────────────────────────────────────────────────
interface SignInFormProps {
  colors: ThemeColors;
  onForgotPassword: () => void;
  loading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
}

function SignInForm({ colors, onForgotPassword, loading, error, onSubmit }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View>
      <UnderlineField
        label="EMAIL"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        colors={colors}
      />
      <UnderlineField
        label="PASSWORD"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        colors={colors}
      />

      <ErrorBanner error={error} colors={colors} />

      {/* CTA */}
      <Pressable
        onPress={() => onSubmit(email, password)}
        disabled={loading}
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>SIGN IN →</Text>
        )}
      </Pressable>

      {/* Forgot password */}
      <Pressable
        onPress={onForgotPassword}
        hitSlop={8}
        style={{ alignItems: 'center', marginTop: 16 }}
      >
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 13,
            color: colors.coral,
          }}
        >
          Forgot your password?
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Sign-Up Form ─────────────────────────────────────────────────────────────
interface SignUpFormProps {
  colors: ThemeColors;
  loading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
}

function SignUpForm({ colors, loading, error, onSubmit }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <View>
      <UnderlineField
        label="EMAIL"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        colors={colors}
      />
      <UnderlineField
        label="PASSWORD"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        colors={colors}
      />

      {/* Password strength meter */}
      {password.length > 0 && <PasswordStrength password={password} />}

      <UnderlineField
        label="CONFIRM PASSWORD"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter your password"
        secureTextEntry
        colors={colors}
      />

      {/* Mismatch hint */}
      {confirmPassword.length > 0 && password !== confirmPassword ? (
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 12.5,
            color: colors.coralDeep,
            marginTop: -14,
            marginBottom: 12,
          }}
        >
          Passwords don't match
        </Text>
      ) : null}

      {/* Spacing before error / button */}
      <View style={{ height: 10 }} />

      <ErrorBanner error={error} colors={colors} />

      {/* CTA */}
      <Pressable
        onPress={() => onSubmit(email, password)}
        disabled={loading || (confirmPassword.length > 0 && password !== confirmPassword)}
        style={({ pressed }) => [
          styles.ctaButton,
          {
            backgroundColor: colors.primary,
            opacity:
              loading || (confirmPassword.length > 0 && password !== confirmPassword)
                ? 0.5
                : pressed
                  ? 0.88
                  : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>CREATE ACCOUNT →</Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();

  const [mode, setMode] = useState<Mode>('signIn');
  const prevModeRef = useRef<Mode>(mode);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const [signInError, setSignInError] = useState<string | null>(null);
  const [signUpError, setSignUpError] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const redirectTo = makeRedirectUri();

  // Compute slide direction before effect updates ref
  const dx =
    TAB_ORDER.indexOf(mode) >= TAB_ORDER.indexOf(prevModeRef.current) ? 1 : -1;
  useEffect(() => {
    prevModeRef.current = mode;
  }, [mode]);

  // ─── Auth handlers ────────────────────────────────
  const handleSignIn = async (email: string, password: string) => {
    if (!email.trim()) {
      setSignInError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setSignInError('Password must be at least 8 characters.');
      return;
    }
    setSignInError(null);
    setEmailLoading(true);
    try {
      await signIn('password', { email: email.trim().toLowerCase(), password, flow: 'signIn' });
    } catch (error: unknown) {
      const msg = String((error as any)?.message ?? error ?? '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('credentials')) {
        setSignInError('Email or password is incorrect.');
      } else {
        setSignInError('Could not sign in. Please try again.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    if (!email.trim()) {
      setSignUpError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setSignUpError('Password must be at least 8 characters.');
      return;
    }
    setSignUpError(null);
    setEmailLoading(true);
    try {
      const result = await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signUp',
      });
      if (result && typeof result === 'object' && 'signingIn' in result && !result.signingIn) {
        router.push({
          pathname: '/verify-email',
          params: { email: email.trim().toLowerCase(), password },
        } as never);
        return;
      }
    } catch (error: unknown) {
      const msg = String((error as any)?.message ?? error ?? '').toLowerCase();
      if (msg.includes('already exists')) {
        setSignUpError('An account with this email already exists. Try signing in instead.');
      } else if (msg.includes('password') || msg.includes('invalid')) {
        setSignUpError('Could not create your account. Check your details and try again.');
      } else {
        setSignUpError('Could not create your account. Please try again.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Google sign in failed';
      setSignInError(msg);
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Apple sign in failed';
      setSignInError(msg);
    } finally {
      setAppleLoading(false);
    }
  };

  const isLoading = emailLoading || googleLoading || appleLoading;

  // ─── Kicker text ──────────────────────────────────
  const kickerText = mode === 'signIn' ? 'WELCOME BACK' : 'JOIN THE ATLAS';
  const titleFirst = mode === 'signIn' ? 'Welcome ' : 'Get ';
  const titleItalic = mode === 'signIn' ? 'back' : 'started';
  const subtitle =
    mode === 'signIn'
      ? 'Your atlas is ready. Sign in to pick up where you left off.'
      : 'Track visas for 195 countries, plan trips, and never lose a confirmation again.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Guilloche background — absolutely positioned behind everything */}
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 22,
            },
          ]}
        >
          {/* ── Kicker row ─────────────────────────────── */}
          <View style={styles.kickerRow}>
            <Text style={[styles.kicker, { color: colors.inkMute }]}>{kickerText}</Text>
            <Squiggle width={60} height={8} color={colors.coral} strokeWidth={2} style={{ marginLeft: 8 }} />
          </View>

          {/* ── Passport stamp ─────────────────────────── */}
          <View style={styles.stampWrap}>
            <VAStamp size={120} />
          </View>

          {/* ── Title ──────────────────────────────────── */}
          <View style={styles.titleWrap}>
            <Text style={styles.titleLine}>
              <Text style={{ fontFamily: FontFamily.display, fontSize: 36, letterSpacing: -36 * 0.02 }}>
                {titleFirst}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 36,
                  letterSpacing: -36 * 0.02,
                }}
              >
                {titleItalic}
              </Text>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 36,
                  color: colors.coral,
                  letterSpacing: -36 * 0.02,
                }}
              >
                .
              </Text>
            </Text>
          </View>

          {/* ── Subtitle ───────────────────────────────── */}
          <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>

          {/* ── Tab pill ───────────────────────────────── */}
          <View
            style={[
              styles.tabPill,
              {
                backgroundColor: colors.surface,
                shadowColor: '#1F1A14',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.10,
                shadowRadius: 16,
                elevation: 4,
              },
            ]}
          >
            <Pressable
              onPress={() => setMode('signIn')}
              style={[
                styles.tabSeg,
                mode === 'signIn' && { backgroundColor: colors.ink },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'signIn' ? '#FFFFFF' : colors.inkSoft },
                ]}
              >
                SIGN IN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signUp')}
              style={[
                styles.tabSeg,
                mode === 'signUp' && { backgroundColor: colors.ink },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'signUp' ? '#FFFFFF' : colors.inkSoft },
                ]}
              >
                CREATE ACCOUNT
              </Text>
            </Pressable>
          </View>

          {/* Coral squiggle under active tab */}
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <View style={{ flex: 1, alignItems: 'center', opacity: mode === 'signIn' ? 1 : 0 }}>
              <Squiggle width={56} color={colors.coral} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', opacity: mode === 'signUp' ? 1 : 0 }}>
              <Squiggle width={56} color={colors.coral} />
            </View>
          </View>

          {/* ── Animated form ──────────────────────────── */}
          <View style={{ marginTop: 28, overflow: 'hidden' }}>
            <Animated.View key={mode} entering={tabSlideIn(dx * 18)}>
              {mode === 'signIn' ? (
                <SignInForm
                  colors={colors}
                  onForgotPassword={() => router.push('/forgot-password' as never)}
                  loading={emailLoading}
                  error={signInError}
                  onSubmit={handleSignIn}
                />
              ) : (
                <SignUpForm
                  colors={colors}
                  loading={emailLoading}
                  error={signUpError}
                  onSubmit={handleSignUp}
                />
              )}
            </Animated.View>
          </View>

          {/* ── Divider ────────────────────────────────── */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.line }]} />
            <Text style={[styles.dividerText, { color: colors.inkMute }]}>
              {mode === 'signIn' ? 'OR CONTINUE WITH' : 'OR'}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.line }]} />
          </View>

          {/* ── Social row ─────────────────────────────── */}
          <View style={styles.socialRow}>
            {/* Google */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.socialBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  borderWidth: 1,
                  opacity: pressed ? 0.84 : 1,
                },
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.ink} size="small" />
              ) : (
                <>
                  <View style={styles.googleLogoWrap}>
                    <Text style={styles.googleG}>G</Text>
                  </View>
                  <Text style={[styles.socialBtnText, { color: colors.ink }]}>Google</Text>
                </>
              )}
            </Pressable>

            {/* Apple */}
            <Pressable
              onPress={handleAppleSignIn}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: '#000000', opacity: pressed ? 0.84 : 1 },
              ]}
            >
              {appleLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.appleIcon}>{''}</Text>
                  <Text style={[styles.socialBtnText, { color: '#FFFFFF' }]}>Apple</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* ── ToS / Privacy footer ───────────────────── */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.inkMute }]}>
              {mode === 'signUp' ? 'By creating an account you agree to our ' : 'By signing in you agree to our '}
            </Text>
            <Pressable
              onPress={() => router.push('/more/terms' as never)}
              accessibilityRole="link"
              accessibilityLabel="Terms of Service"
              hitSlop={6}
            >
              <Text style={[styles.footerLink, { color: colors.inkSoft }]}>Terms</Text>
            </Pressable>
            <Text style={[styles.footerText, { color: colors.inkMute }]}> & </Text>
            <Pressable
              onPress={() => router.push('/more/privacy-policy' as never)}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              hitSlop={6}
            >
              <Text style={[styles.footerLink, { color: colors.inkSoft }]}>Privacy</Text>
            </Pressable>
            <Text style={[styles.footerText, { color: colors.inkMute }]}>.</Text>
          </View>

          {/* ── Bottom mono caps line ──────────────────── */}
          <Text style={[styles.estLine, { color: colors.inkFaint }]}>
            EST · 2026 · YOUR PASSPORT, ORGANIZED
          </Text>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Glass header overlay — always on top */}
      <TopSafeAreaBlur />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },

  // Kicker
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 10 * 0.22,
  },

  // Stamp
  stampWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },

  // Title
  titleWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  titleLine: {
    textAlign: 'center',
  },

  // Subtitle
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
    marginBottom: 24,
  },

  // Tab pill
  tabPill: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    marginTop: 4,
  },
  tabSeg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 11 * 0.14,
  },

  // CTA button
  ctaButton: {
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 13 * 0.18,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 10 * 0.18,
  },

  // Social row
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    gap: 8,
  },
  socialBtnText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 13 * 0.06,
  },
  googleLogoWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleG: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  appleIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  footerLink: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    textDecorationLine: 'underline',
  },

  // Bottom line
  estLine: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    letterSpacing: 9 * 0.32,
    textAlign: 'center',
    marginTop: 12,
  },
});

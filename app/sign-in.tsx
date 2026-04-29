import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';
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

// ─── Sign-In Form ─────────────────────────────────────────────────────────────
interface SignInFormProps {
  colors: ThemeColors;
  onForgotPassword: () => void;
  loading: boolean;
  onSubmit: (email: string, password: string) => void;
}

function SignInForm({ colors, onForgotPassword, loading, onSubmit }: SignInFormProps) {
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
  onSubmit: (name: string, email: string, password: string) => void;
}

function SignUpForm({ colors, loading, onSubmit }: SignUpFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View>
      <UnderlineField
        label="FULL NAME"
        value={name}
        onChangeText={setName}
        placeholder="As on passport"
        autoCapitalize="words"
        colors={colors}
      />
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

      {/* Spacing before button */}
      <View style={{ height: 24 }} />

      {/* CTA */}
      <Pressable
        onPress={() => onSubmit(name, email, password)}
        disabled={loading}
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
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
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setEmailLoading(true);
    try {
      await signIn('password', { email: email.trim().toLowerCase(), password, flow: 'signIn' });
    } catch (error) {
      console.error('Sign in failed:', error);
      Alert.alert('Sign In Failed', 'Invalid email or password. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setEmailLoading(true);
    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signUp',
        name: name.trim(),
      });
    } catch (_error) {
      // Signup may need email verification — route to existing OTP flow
      router.push('/sign-in-email' as never);
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
      Alert.alert('Sign In Failed', msg);
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
      Alert.alert('Sign In Failed', msg);
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Guilloche background — absolutely positioned behind everything */}
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <ScrollView
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
                onForgotPassword={() => router.push('/sign-in-email' as never)}
                loading={emailLoading}
                onSubmit={handleSignIn}
              />
            ) : (
              <SignUpForm colors={colors} loading={emailLoading} onSubmit={handleSignUp} />
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
                <Text style={styles.appleIcon}>{''}</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
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

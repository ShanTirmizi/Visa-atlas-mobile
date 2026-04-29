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
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, ThemeColors } from '@/constants/theme';
import { tabSlideIn } from '@/utils/tabAnimation';
import { Guilloche } from '@/components/ui/Guilloche';
import { Squiggle } from '@/components/ui/Squiggle';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { VAStamp } from '@/components/auth/VAStamp';
import { PasswordStrength } from '@/components/auth/PasswordStrength';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'request' | 'reset';
const STEPS: Step[] = ['request', 'reset'];

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

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ text, colors }: { text: string; colors: ThemeColors }) {
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
        {text}
      </Text>
    </View>
  );
}

// ─── Notice Banner ────────────────────────────────────────────────────────────
function NoticeBanner({ text, colors }: { text: string; colors: ThemeColors }) {
  return (
    <View
      style={{
        backgroundColor: colors.tealBg,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.tealSoft,
      }}
    >
      <Text
        style={{
          fontFamily: FontFamily.medium,
          fontSize: 13,
          lineHeight: 19,
          color: colors.teal,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();

  const [step, setStep] = useState<Step>('request');
  const prevStepRef = useRef<Step>(step);

  // Compute slide direction before effect updates the ref
  const dx = STEPS.indexOf(step) >= STEPS.indexOf(prevStepRef.current) ? 1 : -1;
  useEffect(() => {
    prevStepRef.current = step;
  }, [step]);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ─── Step 1: request code ─────────────────────────
  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { email: trimmedEmail });
      setStep('reset');
      setNotice('We sent a reset code to your email.');
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
      if (msg.includes('not found') || msg.includes('no user')) {
        setError("We couldn't find an account with that email.");
      } else {
        setError('Could not send the reset code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend (from step 2) ─────────────────────────
  const handleResend = async () => {
    if (!email.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { email: email.trim().toLowerCase() });
      setNotice('A new code has been sent.');
    } catch {
      setError('Could not resend. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: verify code + set password ──────────
  const handleReset = async () => {
    const cleanCode = code.replace(/\s/g, '').trim();
    if (cleanCode.length < 6) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { code: cleanCode, newPassword });
      // Success — Convex Auth flips isAuthenticated; the layout auth-gate
      // redirects to /(tabs)/trips automatically.
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('expired')) {
        setError('That code is invalid or has expired. Try resending a new one.');
      } else {
        setError('Could not reset your password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const codeValid = code.replace(/\s/g, '').trim().length >= 6;
  const canReset = codeValid && newPassword.length >= 8 && !loading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Guilloche background — absolutely positioned behind everything */}
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 22,
          }}
        >
          {/* Back button */}
          <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
            <CircleBtn solid onPress={() => router.back()} accessibilityLabel="Back">
              <ArrowLeft size={18} color={colors.ink} strokeWidth={2.25} />
            </CircleBtn>
          </View>

          {/* Mono kicker + squiggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 11,
                fontWeight: '700',
                color: colors.inkMute,
                letterSpacing: 11 * 0.22,
              }}
            >
              {step === 'request' ? 'RESET YOUR PASSWORD' : 'CHECK YOUR INBOX'}
            </Text>
            <Squiggle width={48} color={colors.coral} />
          </View>

          {/* VA stamp */}
          <View style={{ alignSelf: 'center', marginBottom: 24 }}>
            <VAStamp size={120} />
          </View>

          {/* Animated step content */}
          <Animated.View key={step} entering={tabSlideIn(dx * 18)}>
            {step === 'request' ? (
              <>
                {/* Title */}
                <Text style={titleStyle(colors)}>
                  {'Forgot your '}
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    password
                  </Text>
                  <Text style={{ color: colors.coral }}>?</Text>
                </Text>

                <Text style={sublineStyle(colors)}>
                  Enter your email and we'll send you a code to reset it.
                </Text>

                {error ? <ErrorBanner text={error} colors={colors} /> : null}

                <UnderlineField
                  label="EMAIL"
                  value={email}
                  onChangeText={(t) => {
                    setError(null);
                    setEmail(t);
                  }}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  colors={colors}
                />

                <Pressable
                  onPress={handleSendCode}
                  disabled={loading || !email.trim()}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: loading || !email.trim() ? 0.5 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.ctaText}>SEND CODE →</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => router.replace('/sign-in')}
                  hitSlop={8}
                  style={{ alignItems: 'center', marginTop: 18 }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: colors.coral,
                    }}
                  >
                    Back to sign in
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Title */}
                <Text style={titleStyle(colors)}>
                  {'Set a new '}
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    password
                  </Text>
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>

                <Text style={sublineStyle(colors)}>
                  {'We sent a 6-digit code to '}
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>{email}</Text>
                  {'. Enter it below with your new password.'}
                </Text>

                {error ? <ErrorBanner text={error} colors={colors} /> : null}
                {!error && notice ? <NoticeBanner text={notice} colors={colors} /> : null}

                {/* Code input — large mono, centered */}
                <View style={{ marginBottom: 18 }}>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 10,
                      fontWeight: '700',
                      color: colors.inkMute,
                      letterSpacing: 10 * 0.22,
                      marginBottom: 8,
                    }}
                  >
                    RESET CODE
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={(t) => {
                      setError(null);
                      setCode(t.replace(/[^0-9]/g, '').slice(0, 6));
                    }}
                    placeholder="••••••"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 24,
                      color: colors.ink,
                      letterSpacing: 8,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: codeValid ? colors.coral : colors.line,
                      textAlign: 'center',
                    }}
                  />
                </View>

                <UnderlineField
                  label="NEW PASSWORD"
                  value={newPassword}
                  onChangeText={(t) => {
                    setError(null);
                    setNewPassword(t);
                  }}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  colors={colors}
                />

                {newPassword.length > 0 && <PasswordStrength password={newPassword} />}

                <View style={{ height: 18 }} />

                <Pressable
                  onPress={handleReset}
                  disabled={!canReset}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: !canReset ? 0.5 : pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.ctaText}>RESET PASSWORD →</Text>
                  )}
                </Pressable>

                {/* Resend / use different email */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 14,
                    marginTop: 18,
                  }}
                >
                  <Pressable onPress={handleResend} hitSlop={8}>
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 13,
                        color: colors.coral,
                      }}
                    >
                      Resend code
                    </Text>
                  </Pressable>
                  <Text
                    style={{
                      color: colors.inkMute,
                      fontFamily: FontFamily.regular,
                      fontSize: 13,
                    }}
                  >
                    ·
                  </Text>
                  <Pressable
                    onPress={() => {
                      setStep('request');
                      setCode('');
                      setNewPassword('');
                      setError(null);
                      setNotice(null);
                    }}
                    hitSlop={8}
                  >
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 13,
                        color: colors.coral,
                      }}
                    >
                      Use a different email
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* Glass header overlay — always on top */}
      <TopSafeAreaBlur />
    </View>
  );
}

// ─── Shared style helpers ─────────────────────────────────────────────────────
const titleStyle = (colors: ThemeColors) => ({
  fontFamily: FontFamily.display,
  fontSize: 38,
  fontWeight: '500' as const,
  letterSpacing: -38 * 0.022,
  color: colors.ink,
  textAlign: 'center' as const,
  marginBottom: 12,
});

const sublineStyle = (colors: ThemeColors) => ({
  fontFamily: FontFamily.regular,
  fontSize: 14,
  lineHeight: 21,
  color: colors.inkSoft,
  textAlign: 'center' as const,
  marginBottom: 24,
  maxWidth: 320,
  alignSelf: 'center' as const,
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
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
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

type Mode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetCode';

export default function SignInEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  // ─── Handlers ───────────────────────────────────

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
    } catch (error) {
      console.error('Sign in failed:', error);
      Alert.alert('Sign In Failed', 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('password', { email, password, flow: 'signUp' });
      if (result && typeof result === 'object' && 'signingIn' in result && !result.signingIn) {
        setNeedsVerification(true);
      }
    } catch (error) {
      console.error('Sign up failed:', error);
      Alert.alert('Sign Up Failed', 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code.');
      return;
    }
    setLoading(true);
    try {
      await signIn('resend-otp', { code: verificationCode });
    } catch (error) {
      console.error('Verification failed:', error);
      Alert.alert('Verification Failed', 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { email });
      setMode('resetCode');
    } catch (error) {
      console.error('Forgot password failed:', error);
      Alert.alert('Error', 'Could not send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetCode.trim()) {
      Alert.alert('Error', 'Please enter the reset code.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { code: resetCode, newPassword });
    } catch (error) {
      console.error('Reset password failed:', error);
      Alert.alert('Error', 'Could not reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Title helpers ──────────────────────────────

  const getTitle = () => {
    if (needsVerification) return 'Verify Your Email';
    switch (mode) {
      case 'signIn':
        return 'Sign In';
      case 'signUp':
        return 'Create Account';
      case 'forgotPassword':
        return 'Forgot Password';
      case 'resetCode':
        return 'Reset Password';
    }
  };

  // ─── Verification screen ───────────────────────

  if (needsVerification) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => setNeedsVerification(false)}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {getTitle()}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We sent a verification code to your email.
          </Text>

          <View style={styles.formSection}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Verification code"
              placeholderTextColor={colors.textMuted}
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              autoFocus
            />

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryButtonText} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryButtonText }]}>
                  VERIFY
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Reset code screen ─────────────────────────

  if (mode === 'resetCode') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => setMode('signIn')}
            style={styles.backButton}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <ArrowLeft color={colors.foreground} size={24} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {getTitle()}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the code sent to your email and choose a new password.
          </Text>

          <View style={styles.formSection}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Reset code"
              placeholderTextColor={colors.textMuted}
              value={resetCode}
              onChangeText={setResetCode}
              keyboardType="number-pad"
              autoFocus
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryButtonText} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryButtonText }]}>
                  RESET PASSWORD
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Main sign in / sign up screen ─────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <ArrowLeft color={colors.foreground} size={24} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {getTitle()}
        </Text>

        {/* Segmented toggle — only for signIn/signUp */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <View
            style={[
              styles.segmentedControl,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => setMode('signIn')}
              style={[
                styles.segment,
                mode === 'signIn' && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: mode === 'signIn' ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('signUp')}
              style={[
                styles.segment,
                mode === 'signUp' && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: mode === 'signUp' ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign In / Sign Up form */}
        {(mode === 'signIn' || mode === 'signUp') && (
          <View style={styles.formSection}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {mode === 'signUp' && (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="Confirm password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}

            <TouchableOpacity
              onPress={mode === 'signIn' ? handleSignIn : handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryButtonText} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryButtonText }]}>
                  {mode === 'signIn' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </Text>
              )}
            </TouchableOpacity>

            {mode === 'signIn' && (
              <TouchableOpacity
                onPress={() => setMode('forgotPassword')}
                activeOpacity={0.7}
                style={styles.forgotLink}
              >
                <Text style={[styles.forgotText, { color: colors.textMuted }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Forgot password form */}
        {mode === 'forgotPassword' && (
          <View style={styles.formSection}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your email and we'll send you a reset code.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryButtonText} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryButtonText }]}>
                  SEND RESET CODE
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('signIn')}
              activeOpacity={0.7}
              style={styles.forgotLink}
            >
              <Text style={[styles.forgotText, { color: colors.textMuted }]}>
                Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  // Back button
  backButton: {
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  // Title
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  // Segmented control (same pattern as trips screen)
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xs,
  },
  segmentText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Form
  formSection: {
    gap: 14,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  // Submit button
  submitButton: {
    paddingVertical: 16,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Forgot password link
  forgotLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.sm,
  },
});

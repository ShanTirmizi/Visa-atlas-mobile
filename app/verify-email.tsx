import React, { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Guilloche } from '@/components/ui/Guilloche';
import { Squiggle } from '@/components/ui/Squiggle';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { VAStamp } from '@/components/auth/VAStamp';
import { CircleBtn } from '@/components/ui/CircleBtn';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const params = useLocalSearchParams<{ email?: string; password?: string }>();
  const email = (params.email ?? '').toString();
  const password = (params.password ?? '').toString();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const cleanCode = code.replace(/\s/g, '').trim();
  const canVerify = cleanCode.length >= 6 && !loading;

  const handleVerify = async () => {
    if (!canVerify) return;
    setError(null);
    setLoading(true);
    try {
      await signIn('resend-otp', { code: cleanCode });
      // Convex Auth flips isAuthenticated; root layout redirects to home automatically.
    } catch (err: unknown) {
      const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
      if (msg.includes('invalid') || msg.includes('expired')) {
        setError('That code is invalid or has expired. Try again or resend a new code.');
      } else {
        setError('Could not verify the code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || !password || resending) {
      setError('Missing context to resend. Go back and try again.');
      return;
    }
    setError(null);
    setResendNotice(null);
    setResending(true);
    try {
      await signIn('password', { email, password, flow: 'signUp' });
      setResendNotice('We sent you a new verification code.');
    } catch (err: unknown) {
      // Re-running signup may also throw "already exists" but that's harmless
      // here since we're really just asking for a fresh OTP.
      const msg = String((err as any)?.message ?? '').toLowerCase();
      if (msg.includes('already')) {
        setResendNotice('A new code has been sent.');
      } else {
        setError('Could not resend. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Guilloche variant="wavy" color={colors.ink} opacity={0.04} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 22,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
            <CircleBtn solid onPress={() => router.back()} accessibilityLabel="Back">
              <ArrowLeft size={18} color={colors.ink} strokeWidth={2.25} />
            </CircleBtn>
          </View>

          {/* Mono kicker + squiggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 11,
                fontWeight: '700',
                color: colors.inkMute,
                letterSpacing: 11 * 0.22,
              }}
            >
              CHECK YOUR INBOX
            </Text>
            <Squiggle width={48} color={colors.coral} />
          </View>

          {/* VA stamp */}
          <View style={{ alignSelf: 'center', marginBottom: 24 }}>
            <VAStamp size={120} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 38,
              fontWeight: '500',
              letterSpacing: -38 * 0.022,
              color: colors.ink,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            Verify{' '}
            <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>
              your email
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>

          {/* Subline */}
          <Text
            style={{
              fontFamily: FontFamily.regular,
              fontSize: 14,
              lineHeight: 21,
              color: colors.inkSoft,
              textAlign: 'center',
              marginBottom: 28,
              maxWidth: 320,
              alignSelf: 'center',
            }}
          >
            We sent a 6-digit code to{' '}
            <Text style={{ color: colors.ink, fontWeight: '600' }}>
              {email || 'your email'}
            </Text>
            . Enter it below to finish creating your account.
          </Text>

          {/* Inline error or success notice */}
          {error ? (
            <View
              style={{
                backgroundColor: colors.coralBg,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
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
          ) : resendNotice ? (
            <View
              style={{
                backgroundColor: colors.tealBg,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
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
                {resendNotice}
              </Text>
            </View>
          ) : null}

          {/* Code input */}
          <View style={{ marginBottom: 20 }}>
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
              VERIFICATION CODE
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
              autoFocus
              maxLength={6}
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 24,
                color: colors.ink,
                letterSpacing: 8,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: cleanCode.length === 6 ? colors.coral : colors.line,
                textAlign: 'center',
              }}
            />
          </View>

          {/* Verify CTA */}
          <Pressable
            onPress={handleVerify}
            disabled={!canVerify}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: colors.primary,
                opacity: !canVerify ? 0.5 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>VERIFY →</Text>
            )}
          </Pressable>

          {/* Resend */}
          <Pressable
            onPress={handleResend}
            disabled={resending}
            hitSlop={8}
            style={{ alignItems: 'center', marginTop: 18 }}
          >
            {resending ? (
              <ActivityIndicator color={colors.coral} size="small" />
            ) : (
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: colors.coral,
                }}
              >
                Resend the code
              </Text>
            )}
          </Pressable>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <TopSafeAreaBlur />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
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

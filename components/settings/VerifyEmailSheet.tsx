import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';

export interface VerifyEmailSheetRef {
  open: () => void;
  close: () => void;
}

interface Props {
  email: string | null;
  onVerified?: () => void;
}

type Step = 'request' | 'verify';

const VerifyEmailSheet = forwardRef<VerifyEmailSheetRef, Props>(
  ({ email, onVerified }, ref) => {
    const { colors } = useTheme();
    const sheetRef = useRef<BottomSheetModal>(null);

    const sendCode = useAction(api.emailVerification.sendVerificationCode);
    const verifyCode = useMutation(api.emailVerification.verifyCode);

    const [step, setStep] = useState<Step>('request');
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        // Reset state every time the sheet opens.
        setStep('request');
        setCode('');
        setError(null);
        setNotice(null);
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }));

    const handleSendCode = useCallback(async () => {
      setError(null);
      setNotice(null);
      setSending(true);
      try {
        const result = await sendCode({});
        if (result.status === 'alreadyVerified') {
          setNotice('Your email is already verified.');
          onVerified?.();
          setTimeout(() => sheetRef.current?.dismiss(), 900);
          return;
        }
        if (result.status === 'noEmail') {
          setError("We don't have an email on file for your account.");
          return;
        }
        setStep('verify');
        setNotice(`Code sent to ${email ?? 'your email'}.`);
      } catch (err) {
        const msg = String((err as Error)?.message ?? '').replace(/^Uncaught Error:\s*/i, '');
        setError(msg || 'Could not send the code. Try again.');
      } finally {
        setSending(false);
      }
    }, [sendCode, email, onVerified]);

    const handleVerify = useCallback(async () => {
      const cleanCode = code.replace(/\s/g, '').trim();
      if (cleanCode.length < 6) {
        setError('Enter the 6-digit code from your email.');
        return;
      }
      setError(null);
      setVerifying(true);
      try {
        await verifyCode({ code: cleanCode });
        setNotice('Email verified.');
        onVerified?.();
        setTimeout(() => sheetRef.current?.dismiss(), 600);
      } catch (err) {
        const msg = String((err as Error)?.message ?? '').replace(/^Uncaught Error:\s*/i, '');
        setError(msg || 'Could not verify the code. Try again.');
      } finally {
        setVerifying(false);
      }
    }, [code, verifyCode, onVerified]);

    return (
      <AppBottomSheet ref={sheetRef}>
        <BottomSheetView>
          <View style={styles.container}>
            {/* Mono kicker */}
            <Text
              style={[
                styles.kicker,
                { color: colors.inkMute, letterSpacing: 11 * 0.22 },
              ]}
            >
              {step === 'request' ? 'EMAIL VERIFICATION' : 'CHECK YOUR INBOX'}
            </Text>

            {/* Italic title with coral period */}
            <Text style={[styles.title, { color: colors.ink }]}>
              {step === 'request' ? 'Verify ' : 'Enter the '}
              <Text style={[styles.titleItalic]}>
                {step === 'request' ? 'your email' : 'code'}
              </Text>
              <Text style={{ color: colors.coral }}>.</Text>
            </Text>

            <Text style={[styles.subline, { color: colors.inkSoft }]}>
              {step === 'request'
                ? `We'll send a 6-digit code to ${email ?? 'your email'}. It expires in 10 minutes.`
                : `We sent a 6-digit code to ${email ?? 'your email'}. Enter it below to confirm your address.`}
            </Text>

            {error ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: colors.coralBg, borderColor: colors.coralSoft },
                ]}
              >
                <Text style={[styles.bannerText, { color: colors.coralDeep }]}>
                  {error}
                </Text>
              </View>
            ) : notice ? (
              <View
                style={[
                  styles.banner,
                  { backgroundColor: colors.tealBg, borderColor: colors.tealSoft },
                ]}
              >
                <Text style={[styles.bannerText, { color: colors.teal }]}>
                  {notice}
                </Text>
              </View>
            ) : null}

            {step === 'verify' ? (
              <View style={{ marginTop: 12, marginBottom: 18 }}>
                <Text
                  style={[
                    styles.fieldLabel,
                    { color: colors.inkMute, letterSpacing: 10 * 0.22 },
                  ]}
                >
                  CODE
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
                    borderBottomColor:
                      code.replace(/\s/g, '').length === 6
                        ? colors.coral
                        : colors.line,
                    textAlign: 'center',
                  }}
                />
              </View>
            ) : null}

            {/* Primary CTA */}
            <Pressable
              onPress={step === 'request' ? handleSendCode : handleVerify}
              disabled={
                step === 'request'
                  ? sending
                  : verifying || code.replace(/\s/g, '').length < 6
              }
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    (step === 'request' && sending) ||
                    (step === 'verify' &&
                      (verifying || code.replace(/\s/g, '').length < 6))
                      ? 0.5
                      : pressed
                      ? 0.88
                      : 1,
                },
              ]}
            >
              {(step === 'request' && sending) ||
              (step === 'verify' && verifying) ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>
                  {step === 'request' ? 'SEND CODE →' : 'VERIFY →'}
                </Text>
              )}
            </Pressable>

            {/* Secondary action — only on verify step */}
            {step === 'verify' ? (
              <Pressable
                onPress={handleSendCode}
                hitSlop={8}
                disabled={sending}
                style={{ alignItems: 'center', marginTop: 14 }}
              >
                {sending ? (
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
            ) : null}
          </View>
        </BottomSheetView>
      </AppBottomSheet>
    );
  },
);

VerifyEmailSheet.displayName = 'VerifyEmailSheet';
export default VerifyEmailSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 36,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -32 * 0.022,
    lineHeight: 36,
    marginBottom: 10,
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  subline: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  banner: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  bannerText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 8,
  },
  cta: {
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

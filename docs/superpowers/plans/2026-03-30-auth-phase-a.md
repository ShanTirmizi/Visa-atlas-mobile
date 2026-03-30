# Authentication Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user authentication (Google, Apple, Email/Password) via Convex Auth, with an auth gate so users must sign in before using the app.

**Architecture:** Convex Auth handles sessions, tokens, and user management server-side. ConvexAuthProvider wraps the app with AsyncStorage for token persistence (React Native has no localStorage). Auth gate in the root layout checks `useConvexAuth()` and shows either the Sign In screen or the tab navigator. Sign In screen is social-first (Google + Apple buttons), with email/password as a secondary option.

**Tech Stack:** @convex-dev/auth, @auth/core, expo-auth-session (for OAuth on mobile), expo-web-browser, resend (email delivery), @oslojs/crypto (OTP generation), AsyncStorage (token storage).

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/auth.config.ts` | **NEW** — Auth provider domain configuration |
| `convex/auth.ts` | **NEW** — Convex Auth setup with Google, Apple, Password providers |
| `convex/ResendOTP.ts` | **NEW** — Email verification OTP via Resend |
| `convex/ResendOTPPasswordReset.ts` | **NEW** — Password reset OTP via Resend |
| `convex/http.ts` | **NEW** — HTTP router for auth callback routes |
| `convex/schema.ts` | **MODIFY** — Add authTables spread |
| `contexts/ConvexProvider.tsx` | **MODIFY** — Replace ConvexProvider with ConvexAuthProvider + AsyncStorage |
| `app/_layout.tsx` | **MODIFY** — Add auth gate |
| `app/sign-in.tsx` | **NEW** — Sign In screen (social-first UI) |
| `app/sign-in-email.tsx` | **NEW** — Email sign in/sign up/reset form |
| `app/(tabs)/more.tsx` | **MODIFY** — Add sign-out button and user info |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Convex Auth and related packages**

Run:
```bash
npx expo install expo-auth-session expo-web-browser expo-crypto
npm install @convex-dev/auth @auth/core@0.37.0
```

Note: `resend` and `@oslojs/crypto` are Convex server-side deps — they get bundled with Convex, not in package.json. Install them as Convex node dependencies:
```bash
npm install resend @oslojs/crypto
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Convex Auth and auth dependencies"
```

---

### Task 2: Configure Convex Auth server-side

**Files:**
- Create: `convex/auth.config.ts`
- Create: `convex/auth.ts`
- Create: `convex/ResendOTP.ts`
- Create: `convex/ResendOTPPasswordReset.ts`
- Create: `convex/http.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Create convex/auth.config.ts**

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

- [ ] **Step 2: Create convex/ResendOTP.ts**

```typescript
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM || "Visa Atlas <noreply@visaatlas.app>",
      to: [email],
      subject: "Verify your email for Visa Atlas",
      text: `Your verification code is: ${token}`,
    });
  },
});
```

- [ ] **Step 3: Create convex/ResendOTPPasswordReset.ts**

```typescript
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import type { RandomReader } from "@oslojs/crypto/random";
import { generateRandomString } from "@oslojs/crypto/random";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM || "Visa Atlas <noreply@visaatlas.app>",
      to: [email],
      subject: "Reset your Visa Atlas password",
      text: `Your password reset code is: ${token}`,
    });
  },
});
```

- [ ] **Step 4: Create convex/auth.ts**

```typescript
import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Apple({
      profile: (appleInfo: any) => {
        const name = appleInfo.user
          ? `${appleInfo.user.name?.firstName ?? ""} ${appleInfo.user.name?.lastName ?? ""}`.trim()
          : undefined;
        return {
          id: appleInfo.sub,
          name: name || undefined,
          email: appleInfo.email,
        };
      },
    }),
    Password({
      verify: ResendOTP,
      reset: ResendOTPPasswordReset,
    }),
  ],
});
```

- [ ] **Step 5: Create convex/http.ts**

```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
```

- [ ] **Step 6: Update convex/schema.ts — add authTables**

At the top of `convex/schema.ts`, add the import:
```typescript
import { authTables } from "@convex-dev/auth/server";
```

Inside `defineSchema({`, add the spread at the very top:
```typescript
export default defineSchema({
  ...authTables,
  // existing tables below...
  trips: defineTable({
```

- [ ] **Step 7: Update convex/_generated/api.d.ts**

Add imports for the new modules:
```typescript
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
```

And add them to the `ApiFromModules` block.

- [ ] **Step 8: Commit**

```bash
git add convex/
git commit -m "feat: configure Convex Auth with Google, Apple, and Password providers"
```

---

### Task 3: Update ConvexProvider with auth support

**Files:**
- Modify: `contexts/ConvexProvider.tsx`

- [ ] **Step 1: Replace ConvexProvider with ConvexAuthProvider**

Rewrite `contexts/ConvexProvider.tsx`:

```typescript
import React from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// AsyncStorage adapter for React Native (no localStorage)
const tokenStorage = {
  getItem: async (key: string) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={tokenStorage}>
      {children}
    </ConvexAuthProvider>
  );
}

export { convex };
```

- [ ] **Step 2: Commit**

```bash
git add contexts/ConvexProvider.tsx
git commit -m "feat: replace ConvexProvider with ConvexAuthProvider for auth support"
```

---

### Task 4: Create the Sign In screen

**Files:**
- Create: `app/sign-in.tsx`

- [ ] **Step 1: Create the social-first sign in screen**

Create `app/sign-in.tsx`:

```tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { Mail } from 'lucide-react-native';

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
          paddingTop: insets.top + Spacing['3xl'],
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      {/* Branding */}
      <View style={styles.brandSection}>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          VISA ATLAS
        </Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          Plan smarter. Travel further.
        </Text>
      </View>

      {/* Social buttons */}
      <View style={styles.buttonSection}>
        {/* Google */}
        <TouchableOpacity
          style={[styles.socialButton, { backgroundColor: '#FFFFFF', borderColor: '#E0E0E0' }]}
          onPress={handleGoogleSignIn}
          activeOpacity={0.8}
        >
          <Text style={[styles.googleIcon]}>G</Text>
          <Text style={[styles.socialButtonText, { color: '#1F1F1F' }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity
          style={[styles.socialButton, { backgroundColor: '#000000' }]}
          onPress={handleAppleSignIn}
          activeOpacity={0.8}
        >
          <Text style={[styles.appleIcon]}>&#63743;</Text>
          <Text style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
            Continue with Apple
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Email link */}
        <TouchableOpacity
          style={styles.emailLink}
          onPress={() => router.push('/sign-in-email')}
          activeOpacity={0.7}
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
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },
  brandSection: {
    alignItems: 'center',
    marginTop: Spacing['5xl'],
  },
  appName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['5xl'],
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.lg,
    marginTop: Spacing.sm,
  },
  buttonSection: {
    gap: 14,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  googleIcon: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: '#4285F4',
  },
  appleIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  socialButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  emailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  emailLinkText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/sign-in.tsx
git commit -m "feat: add social-first Sign In screen"
```

---

### Task 5: Create the Email sign in/sign up form

**Files:**
- Create: `app/sign-in-email.tsx`

- [ ] **Step 1: Create the email form screen**

Create `app/sign-in-email.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

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

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password) return;
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn('password', { email, password, flow: 'signUp' });
      if (!result.signingIn) {
        setNeedsVerification(true);
      }
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Could not create account');
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setLoading(true);
    try {
      await signIn('resend-otp', { code: verificationCode });
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Invalid code');
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Enter your email address first');
      return;
    }
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', { email });
      setMode('resetCode');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not send reset code');
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) return;
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signIn('resend-otp-password-reset', {
        code: resetCode,
        newPassword,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not reset password');
    }
    setLoading(false);
  };

  // Verification code screen
  if (needsVerification) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.lg }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We sent a code to {email}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Enter code"
          placeholderTextColor={colors.textMuted}
          value={verificationCode}
          onChangeText={setVerificationCode}
          keyboardType="number-pad"
          autoFocus
        />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleVerifyCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Reset code screen
  if (mode === 'resetCode') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity onPress={() => setMode('signIn')} hitSlop={12}>
          <ArrowLeft color={colors.foreground} size={22} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Reset Password
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the code sent to {email} and your new password
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Reset code"
          placeholderTextColor={colors.textMuted}
          value={resetCode}
          onChangeText={setResetCode}
          keyboardType="number-pad"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="New password (min 8 chars)"
          placeholderTextColor={colors.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.foreground} size={22} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {mode === 'signIn' ? 'Sign In' : mode === 'signUp' ? 'Create Account' : 'Forgot Password'}
        </Text>

        {/* Mode toggle */}
        {mode !== 'forgotPassword' && (
          <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setMode('signIn')}
              style={[styles.toggleBtn, mode === 'signIn' && { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.toggleText, { color: mode === 'signIn' ? '#FFFFFF' : colors.textMuted }]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('signUp')}
              style={[styles.toggleBtn, mode === 'signUp' && { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.toggleText, { color: mode === 'signUp' ? '#FFFFFF' : colors.textMuted }]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Email field */}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Email address"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {/* Password fields */}
        {mode !== 'forgotPassword' && (
          <>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {mode === 'signUp' && (
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Confirm password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}
          </>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={
            mode === 'signIn'
              ? handleSignIn
              : mode === 'signUp'
              ? handleSignUp
              : handleForgotPassword
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'signIn' ? 'Sign In' : mode === 'signUp' ? 'Create Account' : 'Send Reset Code'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Forgot password link */}
        {mode === 'signIn' && (
          <TouchableOpacity onPress={() => setMode('forgotPassword')} style={styles.forgotLink}>
            <Text style={[styles.forgotText, { color: colors.textMuted }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>
        )}

        {mode === 'forgotPassword' && (
          <TouchableOpacity onPress={() => setMode('signIn')} style={styles.forgotLink}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.xs,
  },
  toggleText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: Radius.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  forgotLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  forgotText: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.sm,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/sign-in-email.tsx
git commit -m "feat: add email sign in/sign up/reset form"
```

---

### Task 6: Add auth gate to root layout

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add auth gate to ThemedApp**

Read `app/_layout.tsx`. Import `useConvexAuth` and add an auth gate inside `ThemedApp`:

Add import:
```typescript
import { useConvexAuth } from 'convex/react';
import { useRouter, useSegments } from 'expo-router';
```

Inside `ThemedApp`, add the auth gate before the return:

```typescript
function ThemedApp() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const router = useRouter();

  // Auth gate: redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'sign-in' || segments[0] === 'sign-in-email';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={{ fontFamily: FontFamily.display, fontSize: FontSize['3xl'], color: colors.foreground }}>
          VISA ATLAS
        </Text>
      </View>
    );
  }

  return (
    // ... existing return with Stack
  );
}
```

Add the sign-in screens to the Stack:
```tsx
<Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
<Stack.Screen name="sign-in-email" options={{ animation: 'slide_from_right' }} />
<Stack.Screen name="email-connected" options={{ animation: 'none' }} />
```

Add the `useEffect` import if not already present, and `Text` from react-native, and `FontFamily, FontSize` from theme constants.

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add auth gate to root layout"
```

---

### Task 7: Add sign-out to More screen

**Files:**
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Add sign-out button**

Read `app/(tabs)/more.tsx`. Add imports:
```typescript
import { useAuthActions } from '@convex-dev/auth/react';
import { LogOut } from 'lucide-react-native';
```

Inside the component, add:
```typescript
const { signOut } = useAuthActions();
```

In the `renderSettings` function, add a sign-out button AFTER the existing "Version" row:

```tsx
{/* Sign Out */}
<TouchableOpacity
  style={[styles.settingRow, { backgroundColor: colors.danger, borderWidth: 0, marginTop: Spacing.lg }]}
  onPress={() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  }}
>
  <View style={styles.settingInfo}>
    <LogOut color="#FFFFFF" size={20} />
    <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
      Sign Out
    </Text>
  </View>
  <ChevronRight color="#FFFFFF" size={18} />
</TouchableOpacity>
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/more.tsx"
git commit -m "feat: add sign-out button to More screen settings"
```

---

### Task 8: Verify everything compiles

**Files:** None (testing only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No new errors.

- [ ] **Step 2: Fix any issues found**

Address TypeScript errors.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: address issues found during auth verification"
```

---

## Environment Variables Required

Set these in the **Convex dashboard** (not .env.local):

```bash
npx convex env set AUTH_GOOGLE_ID <google-oauth-client-id>
npx convex env set AUTH_GOOGLE_SECRET <google-oauth-client-secret>
npx convex env set AUTH_APPLE_ID <apple-services-id>
npx convex env set AUTH_APPLE_SECRET <apple-jwt-secret>
npx convex env set AUTH_RESEND_KEY <resend-api-key>
npx convex env set AUTH_EMAIL_FROM "Visa Atlas <noreply@visaatlas.app>"
npx convex env set SITE_URL https://visa-atlas.vercel.app
npx convex env set JWT_PRIVATE_KEY <generated-rs256-key>
npx convex env set JWKS <generated-jwks-json>
```

Generate JWT keys with:
```bash
npx @convex-dev/auth generate-keys
```

## OAuth Callback URLs

Register these in provider consoles:
- **Google**: `https://ardent-pig-434.eu-west-1.convex.site/api/auth/callback/google`
- **Apple**: `https://ardent-pig-434.eu-west-1.convex.site/api/auth/callback/apple`

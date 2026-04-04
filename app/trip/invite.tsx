import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { ArrowLeft, Link, Mail } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

type Role = 'editor' | 'viewer';

export default function InviteScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [role, setRole] = useState<Role>('editor');
  const [email, setEmail] = useState('');
  const [sharingLink, setSharingLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const createInvite = useMutation(api.tripInvites.createInvite);

  const handleShareLink = async () => {
    if (!tripId) return;
    setSharingLink(true);
    try {
      const result = await createInvite({
        tripId: tripId as Id<'trips'>,
        role,
      });
      const deepLink = `visaatlas://invite/${result.inviteCode}`;
      await Share.share({
        message: `Join my trip on Visa Atlas! ${deepLink}`,
        url: deepLink,
        title: 'Invite to Trip',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create invite link.';
      Alert.alert('Error', message);
    } finally {
      setSharingLink(false);
    }
  };

  const handleSendEmail = async () => {
    if (!tripId) return;
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Enter an email', 'Please enter an email address to invite.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setSendingEmail(true);
    try {
      await createInvite({
        tripId: tripId as Id<'trips'>,
        role,
        invitedEmail: trimmed,
      });
      Alert.alert('Invite Sent', `An invite has been sent to ${trimmed}.`);
      setEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invite.';
      Alert.alert('Error', message);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.borderSubtle },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={styles.backBtn}
        >
          <ArrowLeft color={colors.foreground} size={20} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Invite Collaborators
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Role Picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Invite as
          </Text>
          <View style={[styles.rolePicker, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            {(['editor', 'viewer'] as Role[]).map((r) => {
              const active = role === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[
                    styles.roleBtn,
                    active && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleBtnText,
                      { color: active ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.roleHint, { color: colors.textSecondary }]}>
            {role === 'editor'
              ? 'Editors can add and edit content in this trip.'
              : 'Viewers can see the trip but cannot make changes.'}
          </Text>
        </View>

        {/* Share Link */}
        <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.cardIconRow, { backgroundColor: colors.primary + '20' }]}>
            <Link color={colors.primary} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Share Invite Link
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Anyone with this link can join as {role}.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleShareLink}
            disabled={sharingLink}
            style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: sharingLink ? 0.6 : 1 }]}
          >
            {sharingLink ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Email Invite */}
        <View style={[styles.emailSection, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <View style={[styles.cardIconRow, { backgroundColor: colors.primary + '20' }]}>
            <Mail color={colors.primary} size={20} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: Spacing.sm }]}>
            Invite by Email
          </Text>
          <View style={[styles.emailRow, { borderColor: colors.borderSubtle, backgroundColor: colors.background }]}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="colleague@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.emailInput, { color: colors.foreground, fontFamily: FontFamily.regular }]}
            />
            <TouchableOpacity
              onPress={handleSendEmail}
              disabled={sendingEmail}
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sendingEmail ? 0.6 : 1 }]}
            >
              {sendingEmail ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  rolePicker: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 4,
    gap: 4,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  roleBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  roleHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  emailSection: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 0,
  },
  cardIconRow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    flex: 1,
  },
  cardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emailInput: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: FontSize.sm,
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
});

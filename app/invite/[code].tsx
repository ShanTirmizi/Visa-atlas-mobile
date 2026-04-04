import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { UserPlus, Check, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

export default function InviteAcceptScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [accepting, setAccepting] = useState(false);

  const invite = useQuery(
    api.tripInvites.getInviteByCode,
    code ? { inviteCode: code } : 'skip',
  );

  const acceptInvite = useMutation(api.tripInvites.acceptInvite);

  const handleAccept = async () => {
    if (!invite || !code) return;
    setAccepting(true);
    try {
      await acceptInvite({ inviteCode: code });
      router.replace(`/trip/${invite.tripId}` as `${string}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite.';
      Alert.alert('Error', message);
      setAccepting(false);
    }
  };

  // Loading
  if (invite === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not found
  if (invite === null) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
          <X color={colors.danger} size={32} />
        </View>
        <Text style={[styles.title, { color: colors.foreground, marginTop: Spacing.lg }]}>
          Invite Not Found
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          This invite link is invalid or has expired.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.btnText, { color: colors.foreground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <UserPlus color={colors.primary} size={32} />
        </View>

        <Text style={[styles.title, { color: colors.foreground, marginTop: Spacing.lg }]}>
          You've been invited!
        </Text>
        <Text style={[styles.tripName, { color: colors.primary }]}>
          {invite.countryName ?? 'a trip'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Join as{' '}
          <Text style={{ fontFamily: FontFamily.semibold, color: colors.foreground }}>
            {invite.role}
          </Text>
        </Text>

        <TouchableOpacity
          onPress={handleAccept}
          disabled={accepting}
          style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary, opacity: accepting ? 0.6 : 1 }]}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Check color="#fff" size={18} />
              <Text style={[styles.btnText, { color: '#fff' }]}>Join Trip</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.btn, { backgroundColor: 'transparent', borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.btnText, { color: colors.textSecondary }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    textAlign: 'center',
  },
  tripName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
});

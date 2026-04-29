import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Globe,
  MapPin,
  CreditCard,
  Mail,
  Heart,
  Trash2,
  Download,
  UserX,
  Shield,
  FileText,
  LogOut,
} from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { useEmail } from '@/contexts/email-context';
import { passportCountries } from '@/data/passportCountries';
import { FontFamily, Spacing, type ThemeColors } from '@/constants/theme';
import { Type } from '@/constants/typography';
import BackButton from '@/components/ui/BackButton';
import { Squiggle } from '@/components/ui/Squiggle';
import VerifyEmailSheet, { type VerifyEmailSheetRef } from '@/components/settings/VerifyEmailSheet';

function getPassportName(code: string): string {
  return passportCountries.find((c) => c.code === code)?.name ?? code;
}

// ──────────────────────────────────────────────
// Section group with kicker + squiggle + sectioned card
// ──────────────────────────────────────────────
function GroupHeading({ label, colors }: { label: string; colors: ThemeColors }) {
  return (
    <View style={styles.groupHeading}>
      <Text
        style={[
          Type.kickerSm,
          { color: colors.inkMute, fontSize: 10, letterSpacing: 10 * 0.18 },
        ]}
      >
        {label}
      </Text>
      <Squiggle width={50} height={5} strokeWidth={2} color={colors.coral} />
    </View>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  isFirst?: boolean;
  destructive?: boolean;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  isFirst,
  destructive,
}: SettingsRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderTopWidth: isFirst ? 0 : 1,
          borderTopColor: colors.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.rowIconBox,
          {
            backgroundColor: destructive ? colors.dangerBg : colors.tealBg,
          },
        ]}
      >
        <View style={{ opacity: destructive ? 1 : 0.85 }}>{icon}</View>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FontFamily.semibold,
            fontSize: 13,
            fontWeight: '600',
            color: destructive ? colors.rose : colors.ink,
          }}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[
              Type.body12_5,
              { color: colors.inkMute, marginTop: 1, fontSize: 11 },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={destructive ? colors.rose : colors.inkMute} size={16} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setHeldVisas, passports, heldVisas, residence, favorites } = useVisa();
  const { gmailAccount } = useEmail();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const deleteAccount = useMutation(api.account.deleteAccount);
  const userData = useQuery(
    api.account.exportUserData,
    isAuthenticated ? {} : 'skip',
  );
  // Profile photo + name from the auth provider (Google supplies `image`,
  // Apple does not — we fall back to the passport-letter avatar in that case).
  const me = useQuery(
    api.trips.getCurrentUser,
    isAuthenticated ? {} : 'skip',
  );

  const passportInitial = passports[0] ? passports[0].slice(0, 1) : '?';

  const verifyEmailRef = useRef<VerifyEmailSheetRef>(null);
  const isEmailVerified = !!me?.emailVerificationTime;

  const handleClearLocal = () => {
    Alert.alert(
      'Clear Local Data',
      'This will reset your held visas, favorites, and visited countries. Trips and visa guides stored in Convex will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setHeldVisas([]);
            await AsyncStorage.multiRemove([
              '@visa_atlas_held_visas',
              '@visa_atlas_favorites',
              '@visa_atlas_visited',
              '@visa_atlas_expiry_dates',
            ]);
          },
        },
      ],
    );
  };

  const handleExport = async () => {
    try {
      if (!userData) {
        Alert.alert('Export', 'Loading your data, please try again in a moment.');
        return;
      }
      const json = JSON.stringify(userData, null, 2);
      const exportFile = new File(Paths.document, 'visa-atlas-export.json');
      exportFile.write(json);
      await Sharing.shareAsync(exportFile.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Your Data',
      });
    } catch {
      Alert.alert('Export Failed', 'Could not export your data. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and ALL your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount({});
              await AsyncStorage.multiRemove([
                '@visa_atlas_held_visas',
                '@visa_atlas_favorites',
                '@visa_atlas_visited',
                '@visa_atlas_expiry_dates',
              ]);
              signOut();
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDeep }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 22, marginBottom: 4 }}>
          <BackButton />
        </View>

        {/* Editorial header */}
        <View style={styles.header}>
          <Text
            style={[Type.kicker, { color: colors.inkMute }]}
          >
            YOU
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 26,
              fontWeight: '500',
              letterSpacing: -26 * 0.02,
              color: colors.ink,
              marginTop: 2,
              lineHeight: 26,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
              }}
            >
              Settings
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {/* Profile card — coral gradient avatar + italic name */}
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            {me?.image ? (
              <Image
                source={{ uri: me.image }}
                style={[styles.avatar, { backgroundColor: colors.coralBg }]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
                ]}
              >
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 22,
                    fontWeight: '600',
                    color: '#FFFFFF',
                  }}
                >
                  {(me?.name?.[0]?.toUpperCase()) ?? passportInitial}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                  fontSize: 17,
                  fontWeight: '500',
                  letterSpacing: -17 * 0.012,
                  color: colors.ink,
                }}
                numberOfLines={1}
              >
                {me?.name ?? 'Welcome back'}
              </Text>
              <Text
                style={[
                  Type.body12_5,
                  { color: colors.inkMute, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {me?.email ??
                  (passports.length > 0
                    ? `${passports.map(getPassportName).join(', ')} passport`
                    : 'Add your passport')}
              </Text>
            </View>
          </View>

          {/* Account — only the unverified-email row for now. Hidden once
              the email is verified (or if there's no signed-in user yet). */}
          {me && !isEmailVerified ? (
            <View>
              <GroupHeading label="ACCOUNT" colors={colors} />
              <View
                style={[
                  styles.groupCard,
                  { backgroundColor: colors.surface, borderColor: colors.line },
                ]}
              >
                <SettingsRow
                  isFirst
                  icon={<Mail size={16} color={colors.coralDeep} />}
                  label="Verify your email"
                  value="Unverified"
                  onPress={() => verifyEmailRef.current?.open()}
                />
              </View>
            </View>
          ) : null}

          {/* Travel documents */}
          <View>
            <GroupHeading label="TRAVEL DOCUMENTS" colors={colors} />
            <View
              style={[
                styles.groupCard,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <SettingsRow
                isFirst
                icon={<Globe size={16} color={colors.teal} />}
                label="Passports"
                value={
                  passports.length > 0
                    ? passports.map(getPassportName).join(', ')
                    : 'Not set'
                }
                onPress={() =>
                  router.push('/more/edit-passport' as import('expo-router').Href)
                }
              />
              <SettingsRow
                icon={<MapPin size={16} color={colors.teal} />}
                label="Country of residence"
                value={residence ? getPassportName(residence) : 'Not set'}
                onPress={() =>
                  router.push('/more/edit-residence' as import('expo-router').Href)
                }
              />
              <SettingsRow
                icon={<CreditCard size={16} color={colors.teal} />}
                label="Held visas"
                value={
                  heldVisas.length > 0
                    ? `${heldVisas.length} visa${heldVisas.length === 1 ? '' : 's'}`
                    : 'None'
                }
                onPress={() =>
                  router.push('/more/visas' as import('expo-router').Href)
                }
              />
              <SettingsRow
                icon={<Heart size={16} color={colors.coral} />}
                label="Saved countries"
                value={
                  favorites.length > 0
                    ? `${favorites.length} saved`
                    : 'None'
                }
                onPress={() =>
                  router.push('/more/favorites' as import('expo-router').Href)
                }
              />
            </View>
          </View>

          {/* Data */}
          <View>
            <GroupHeading label="DATA" colors={colors} />
            <View
              style={[
                styles.groupCard,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <SettingsRow
                isFirst
                icon={<Download size={16} color={colors.teal} />}
                label="Export my data"
                onPress={handleExport}
              />
              <SettingsRow
                icon={<Trash2 size={16} color={colors.rose} />}
                label="Clear local data"
                destructive
                onPress={handleClearLocal}
              />
            </View>
          </View>

          {/* Connections — Gmail import for parsing booking confirmations */}
          <View>
            <GroupHeading label="CONNECTIONS" colors={colors} />
            <View
              style={[
                styles.groupCard,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <SettingsRow
                isFirst
                icon={<Mail size={16} color={colors.teal} />}
                label="Gmail"
                value={
                  gmailAccount
                    ? `Connected · ${gmailAccount.email ?? 'syncing'}`
                    : 'Not connected'
                }
                onPress={() =>
                  router.push('/more/email' as import('expo-router').Href)
                }
              />
            </View>
          </View>

          {/* Legal */}
          <View>
            <GroupHeading label="LEGAL" colors={colors} />
            <View
              style={[
                styles.groupCard,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <SettingsRow
                isFirst
                icon={<Shield size={16} color={colors.teal} />}
                label="Privacy policy"
                onPress={() =>
                  router.push('/more/privacy-policy' as import('expo-router').Href)
                }
              />
              <SettingsRow
                icon={<FileText size={16} color={colors.teal} />}
                label="Terms of service"
                onPress={() =>
                  router.push('/more/terms' as import('expo-router').Href)
                }
              />
            </View>
          </View>

          {/* Danger zone — destructive rows in their own card */}
          <View
            style={[
              styles.groupCard,
              { backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          >
            <SettingsRow
              isFirst
              icon={<UserX size={16} color={colors.rose} />}
              label="Delete account"
              destructive
              onPress={handleDeleteAccount}
            />
            <SettingsRow
              icon={<LogOut size={16} color={colors.rose} />}
              label="Sign out"
              destructive
              onPress={handleSignOut}
            />
          </View>

          {/* Version footer */}
          <Text
            style={[
              Type.kickerSm,
              {
                color: colors.inkFaint,
                fontSize: 9,
                textAlign: 'center',
                marginTop: 12,
              },
            ]}
          >
            VISA ATLAS · 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Email verification sheet — opens via the "Verify your email" row */}
      <VerifyEmailSheet ref={verifyEmailRef} email={me?.email ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

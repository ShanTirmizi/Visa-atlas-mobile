import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, Info, LogOut, ChevronRight, Download, UserX, FileText, Shield, Globe, MapPin, CreditCard } from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { passportCountries } from '@/data/passportCountries';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

function getPassportName(code: string): string {
  return passportCountries.find(c => c.code === code)?.name || code;
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setHeldVisas, passports, heldVisas, residence } = useVisa();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const deleteAccount = useMutation(api.account.deleteAccount);
  const userData = useQuery(api.account.exportUserData, isAuthenticated ? {} : 'skip');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: colors.surface }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Settings
      </Text>

      {/* Travel Documents */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: FontSize.base, marginTop: Spacing.sm, marginBottom: Spacing.sm }]}>
        Travel Documents
      </Text>

      {/* Passports */}
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.primary, borderWidth: 0 }]}
        onPress={() => router.push('/more/edit-passport' as import('expo-router').Href)}
        activeOpacity={0.7}
      >
        <View style={styles.settingInfo}>
          <Globe color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Passports
          </Text>
        </View>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.solidTextSub }}>
          {passports.length > 0 ? passports.map(getPassportName).join(', ') : 'Not set'}
        </Text>
      </TouchableOpacity>

      {/* Residence */}
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.primary, borderWidth: 0 }]}
        onPress={() => router.push('/more/edit-residence' as import('expo-router').Href)}
        activeOpacity={0.7}
      >
        <View style={styles.settingInfo}>
          <MapPin color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Country of Residence
          </Text>
        </View>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.solidTextSub }}>
          {residence ? getPassportName(residence) : 'Not set'}
        </Text>
      </TouchableOpacity>

      {/* Held Visas */}
      <TouchableOpacity
        style={[styles.settingRow, { backgroundColor: colors.primary, borderWidth: 0 }]}
        onPress={() => router.push('/more/visas' as import('expo-router').Href)}
        activeOpacity={0.7}
      >
        <View style={styles.settingInfo}>
          <CreditCard color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Held Visas
          </Text>
        </View>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.solidTextSub }}>
          {heldVisas.length > 0 ? `${heldVisas.length} visa${heldVisas.length !== 1 ? 's' : ''}` : 'None'}
        </Text>
      </TouchableOpacity>

      {/* Clear data */}
      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.danger, borderWidth: 0 },
        ]}
        onPress={() => {
          Alert.alert(
            'Clear All Data',
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
        }}
      >
        <View style={styles.settingInfo}>
          <Trash2 color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Clear Local Data
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>

      {/* Export My Data */}
      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.info, borderWidth: 0 },
        ]}
        onPress={async () => {
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
        }}
      >
        <View style={styles.settingInfo}>
          <Download color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Export My Data
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.danger, borderWidth: 0 },
        ]}
        onPress={() => {
          Alert.alert(
            'Delete Account',
            'This will permanently delete your account and ALL your data (trips, bookings, visa guides, email connections, messages). This action cannot be undone.',
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
        }}
      >
        <View style={styles.settingInfo}>
          <UserX color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Delete Account
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>

      {/* About */}
      <View
        style={[
          styles.settingRow,
          { backgroundColor: colors.info, borderWidth: 0 },
        ]}
      >
        <View style={styles.settingInfo}>
          <Info color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Version
          </Text>
        </View>
        <Text style={[styles.settingValue, { color: colors.solidTextSub }]}>
          1.0.0
        </Text>
      </View>

      {/* Legal */}
      <Text style={[styles.legalHeading, { color: colors.textSecondary }]}>
        Legal
      </Text>

      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.primary, borderWidth: 0 },
        ]}
        onPress={() => router.push('/more/privacy-policy' as import('expo-router').Href)}
      >
        <View style={styles.settingInfo}>
          <Shield color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Privacy Policy
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.primary, borderWidth: 0 },
        ]}
        onPress={() => router.push('/more/terms' as import('expo-router').Href)}
      >
        <View style={styles.settingInfo}>
          <FileText color="#FFFFFF" size={20} />
          <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
            Terms of Service
          </Text>
        </View>
        <ChevronRight color="#FFFFFF" size={18} />
      </TouchableOpacity>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 0,
    marginBottom: Spacing.sm,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
  settingValue: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
  },
  legalHeading: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
});

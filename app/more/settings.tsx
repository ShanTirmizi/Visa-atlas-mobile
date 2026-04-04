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
import { ArrowLeft, Trash2, Info, LogOut, ChevronRight } from 'lucide-react-native';
import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setHeldVisas } = useVisa();
  const { signOut } = useAuthActions();

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
        <Text style={[styles.settingValue, { color: 'rgba(255,255,255,0.70)' }]}>
          1.0.0
        </Text>
      </View>

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
});

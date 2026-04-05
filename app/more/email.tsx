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
import { Mail, RefreshCw, Unlink, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useEmail } from '@/contexts/email-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';
import BackButton from '@/components/ui/BackButton';

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function EmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gmailAccount, isSyncing: isEmailSyncing, syncGmail, connectGmail, disconnectGmail } = useEmail();

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
        Email Sync
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Import booking confirmations from your Gmail inbox.
      </Text>

      {!gmailAccount?.isConnected ? (
        <TouchableOpacity
          style={[
            styles.settingRow,
            { backgroundColor: colors.primary, borderWidth: 0 },
          ]}
          onPress={() => connectGmail()}
        >
          <View style={styles.settingInfo}>
            <Mail color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              Connect Gmail
            </Text>
          </View>
          <ChevronRight color="#FFFFFF" size={18} />
        </TouchableOpacity>
      ) : (
        <>
          <View
            style={[
              styles.settingRow,
              { backgroundColor: colors.surface, borderWidth: 0 },
            ]}
          >
            <View style={styles.settingInfo}>
              <Mail color={colors.foreground} size={20} />
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                {gmailAccount.email}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.settingRow,
              {
                backgroundColor: colors.primary,
                borderWidth: 0,
                opacity: isEmailSyncing ? 0.6 : 1,
              },
            ]}
            onPress={() => syncGmail()}
            disabled={isEmailSyncing}
          >
            <View style={styles.settingInfo}>
              <RefreshCw color="#FFFFFF" size={20} />
              <View>
                <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
                  Scan Now
                </Text>
                {gmailAccount.lastScanTime && (
                  <Text style={[styles.settingValue, { color: 'rgba(255,255,255,0.70)' }]}>
                    Last scan: {formatRelativeTime(gmailAccount.lastScanTime)}
                  </Text>
                )}
              </View>
            </View>
            <ChevronRight color="#FFFFFF" size={18} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingRow,
              { backgroundColor: colors.danger, borderWidth: 0 },
            ]}
            onPress={() => {
              Alert.alert(
                'Disconnect Gmail',
                'This will stop scanning your Gmail for booking confirmations. Existing bookings will not be removed.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => disconnectGmail(),
                  },
                ],
              );
            }}
          >
            <View style={styles.settingInfo}>
              <Unlink color="#FFFFFF" size={20} />
              <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
                Disconnect Gmail
              </Text>
            </View>
            <ChevronRight color="#FFFFFF" size={18} />
          </TouchableOpacity>
        </>
      )}
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
  sectionSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
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

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
import { ArrowLeft, Calendar as CalendarIcon, RefreshCw, Unlink, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useCalendar } from '@/contexts/calendar-context';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

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

export default function CalendarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected, lastSyncTime, isSyncing, sync, connect, disconnect } = useCalendar();

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
        Calendar Sync
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        {isConnected
          ? 'Your calendar is connected. Visa expiry dates will be synced automatically.'
          : 'Connect your device calendar to sync visa expiry reminders.'}
      </Text>

      {!isConnected ? (
        <TouchableOpacity
          style={[
            styles.settingRow,
            { backgroundColor: colors.primary, borderWidth: 0 },
          ]}
          onPress={async () => {
            const granted = await connect();
            if (!granted) {
              Alert.alert(
                'Permission Denied',
                'Calendar access is required to sync visa expiry dates. Please enable it in your device settings.',
              );
            }
          }}
        >
          <View style={styles.settingInfo}>
            <CalendarIcon color="#FFFFFF" size={20} />
            <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
              Connect Calendar
            </Text>
          </View>
          <ChevronRight color="#FFFFFF" size={18} />
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[
              styles.settingRow,
              {
                backgroundColor: colors.primary,
                borderWidth: 0,
                opacity: isSyncing ? 0.6 : 1,
              },
            ]}
            onPress={() => sync()}
            disabled={isSyncing}
          >
            <View style={styles.settingInfo}>
              <RefreshCw color="#FFFFFF" size={20} />
              <View>
                <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
                  Sync Now
                </Text>
                {lastSyncTime && (
                  <Text style={[styles.settingValue, { color: 'rgba(255,255,255,0.70)' }]}>
                    Last sync: {formatRelativeTime(lastSyncTime)}
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
                'Disconnect Calendar',
                'This will stop syncing visa expiry dates to your calendar. Existing events will not be removed.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => disconnect(),
                  },
                ],
              );
            }}
          >
            <View style={styles.settingInfo}>
              <Unlink color="#FFFFFF" size={20} />
              <Text style={[styles.settingLabel, { color: '#FFFFFF' }]}>
                Disconnect Calendar
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

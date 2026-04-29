import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { useOffline } from '@/contexts/offline-context';
import { WifiOff } from 'lucide-react-native';

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OfflineIndicator() {
  const { colors } = useTheme();
  const { isOffline, lastSyncTime, pendingMutationCount, isSyncing, forceSyncNow } = useOffline();

  if (!isOffline && !isSyncing) return null;

  // Theme-token palette (was using hardcoded #F59E0B orange — out of palette).
  // Syncing: paper bg + ink text. Offline: warning amber bg + ink text.
  const backgroundColor = isSyncing ? colors.surface : colors.warningBg;
  const textColor = isSyncing ? colors.inkSoft : colors.warning;

  let message = '';
  if (isSyncing) {
    message = 'Syncing...';
  } else if (isOffline) {
    const syncInfo = lastSyncTime ? `Last synced ${formatTimeSince(lastSyncTime)}` : 'No cached data';
    const pendingInfo = pendingMutationCount > 0 ? ` · ${pendingMutationCount} pending` : '';
    message = `Offline · ${syncInfo}${pendingInfo}`;
  }

  return (
    <TouchableOpacity
      onPress={!isOffline ? forceSyncNow : undefined}
      activeOpacity={isOffline ? 1 : 0.7}
      style={[styles.container, { backgroundColor }]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={textColor} style={styles.icon} />
      ) : (
        <WifiOff size={14} color={textColor} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

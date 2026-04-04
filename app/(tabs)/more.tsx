import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CreditCard,
  Heart,
  MapPin,
  Settings,
  ChevronRight,
  Shield,
  Calendar as CalendarIcon,
  Mail,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { useCalendar } from '@/contexts/calendar-context';
import { useEmail } from '@/contexts/email-context';
import { FontFamily, FontSize, Spacing } from '@/constants/theme';

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

export default function MoreScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { heldVisas, favorites, visited } = useVisa();
  const { isConnected, lastSyncTime } = useCalendar();
  const { gmailAccount } = useEmail();

  const menuItems: Array<{
    route: string;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: number;
    tint: string;
  }> = [
    {
      route: '/more/visas',
      label: 'Held Visas',
      subtitle: `${heldVisas.length} visas configured`,
      icon: <CreditCard color="#FFFFFF" size={22} />,
      badge: heldVisas.length,
      tint: colors.primary,
    },
    {
      route: '/more/favorites',
      label: 'Favorites',
      subtitle: `${favorites.length} countries saved`,
      icon: <Heart color="#FFFFFF" size={22} />,
      badge: favorites.length,
      tint: colors.accent,
    },
    {
      route: '/more/visited',
      label: 'Visited',
      subtitle: `${visited.length} countries visited`,
      icon: <MapPin color="#FFFFFF" size={22} />,
      badge: visited.length,
      tint: colors.secondary,
    },
    {
      route: '/more/calendar',
      label: 'Calendar Sync',
      subtitle: isConnected
        ? `Last sync: ${lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Never'}`
        : 'Connect your calendar',
      icon: <CalendarIcon color="#FFFFFF" size={22} />,
      tint: colors.info,
    },
    {
      route: '/more/email',
      label: 'Email Sync',
      subtitle: gmailAccount?.isConnected
        ? `${gmailAccount.email} \u00B7 ${gmailAccount.lastScanTime ? formatRelativeTime(gmailAccount.lastScanTime) : 'Never synced'}`
        : 'Connect Gmail',
      icon: <Mail color="#FFFFFF" size={22} />,
      tint: colors.secondary,
    },
    {
      route: '/more/settings',
      label: 'Settings',
      subtitle: 'Theme, data, preferences',
      icon: <Settings color="#FFFFFF" size={22} />,
      tint: colors.warning,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>
        More
      </Text>

      <View style={styles.menuList}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={[
              styles.menuItem,
              { backgroundColor: item.tint },
            ]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                {item.icon}
              </View>
              <View>
                <Text style={[styles.menuLabel, { color: '#FFFFFF' }]}>
                  {item.label}
                </Text>
                <Text style={[styles.menuSub, { color: 'rgba(255,255,255,0.70)' }]}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
            <View style={styles.menuRight}>
              {item.badge != null && item.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                    {item.badge}
                  </Text>
                </View>
              )}
              <ChevronRight color="#FFFFFF" size={18} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Passport strength */}
      <View
        style={[
          styles.passportCard,
          { backgroundColor: colors.primary },
        ]}
      >
        <Shield color="rgba(255,255,255,0.8)" size={24} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.passportTitle, { color: '#FFFFFF' }]}>
            Passport Strength
          </Text>
          <Text style={[styles.passportSub, { color: 'rgba(255,255,255,0.80)' }]}>
            With your held visas, you have easy access to more destinations
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    marginBottom: Spacing.lg,
  },
  menuList: {
    gap: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
  },
  menuSub: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
  },
  passportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: 20,
  },
  passportTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
  passportSub: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});

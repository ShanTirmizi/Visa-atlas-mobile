import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CreditCard,
  Heart,
  MapPin,
  Settings,
  ArrowLeft,
  ChevronRight,
  Check,
  Shield,
  Info,
  Trash2,
  Calendar as CalendarIcon,
  RefreshCw,
  Unlink,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useCalendar } from '@/contexts/calendar-context';
import { useVisa } from '@/contexts/visa-context';
import { availableVisas } from '@/data/visaData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

type Section = 'main' | 'visas' | 'favorites' | 'visited' | 'settings' | 'calendar';

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
  const { heldVisas, toggleHeldVisa, favorites, visited, setHeldVisas } = useVisa();
  const { isConnected, lastSyncTime, isSyncing, sync, connect, disconnect } = useCalendar();
  const [activeSection, setActiveSection] = useState<Section>('main');

  // ── Held Visas Section ──
  const renderVisas = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setActiveSection('main')}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Held Visas
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Toggle visas you currently hold. This affects visa requirements shown for each country.
      </Text>

      <View style={styles.visaList}>
        {availableVisas.map((visa) => {
          const isHeld = heldVisas.includes(visa.id);
          return (
            <TouchableOpacity
              key={visa.id}
              style={[
                styles.visaItem,
                {
                  backgroundColor: isHeld ? colors.primary : colors.shimmer,
                  borderColor: isHeld ? colors.primary : colors.borderSubtle,
                  borderWidth: isHeld ? 0 : 1,
                },
              ]}
              onPress={() => toggleHeldVisa(visa.id)}
              activeOpacity={0.7}
            >
              <View style={styles.visaInfo}>
                <View
                  style={[
                    styles.visaDot,
                    { backgroundColor: isHeld ? '#FFFFFF' : colors.textMuted },
                  ]}
                />
                <View>
                  <Text style={[styles.visaName, { color: isHeld ? '#FFFFFF' : colors.foreground }]}>
                    {visa.label}
                  </Text>
                  <Text style={[styles.visaCount, { color: isHeld ? 'rgba(255,255,255,0.70)' : colors.textSecondary }]}>
                    {visa.description}
                  </Text>
                </View>
              </View>
              {isHeld ? (
                <Check color="#FFFFFF" size={20} />
              ) : (
                <View
                  style={[styles.uncheckedCircle, { borderColor: colors.textMuted }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Favorites Section ──
  const renderFavorites = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setActiveSection('main')}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Favorites
      </Text>

      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Heart color={colors.textMuted} size={40} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No favorites yet. Tap the star on any country to add it here.
          </Text>
        </View>
      ) : (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {favorites.length} countries saved
        </Text>
      )}
    </View>
  );

  // ── Visited Section ──
  const renderVisited = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setActiveSection('main')}
        hitSlop={12}
      >
        <ArrowLeft color={colors.foreground} size={20} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Visited Countries
      </Text>

      {visited.length === 0 ? (
        <View style={styles.emptyState}>
          <MapPin color={colors.textMuted} size={40} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No visited countries yet. Mark countries as visited from the country detail page.
          </Text>
        </View>
      ) : (
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {visited.length} countries visited
        </Text>
      )}
    </View>
  );

  // ── Settings Section ──
  const renderSettings = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setActiveSection('main')}
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
    </View>
  );

  // ── Calendar Section ──
  const renderCalendar = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setActiveSection('main')}
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
    </View>
  );

  // ── Main Menu ──
  const renderMain = () => {
    const menuItems: Array<{
      key: Section;
      label: string;
      subtitle: string;
      icon: React.ReactNode;
      badge?: number;
      tint: string;
    }> = [
      {
        key: 'visas',
        label: 'Held Visas',
        subtitle: `${heldVisas.length} visas configured`,
        icon: <CreditCard color="#FFFFFF" size={22} />,
        badge: heldVisas.length,
        tint: colors.primary,
      },
      {
        key: 'favorites',
        label: 'Favorites',
        subtitle: `${favorites.length} countries saved`,
        icon: <Heart color="#FFFFFF" size={22} />,
        badge: favorites.length,
        tint: colors.accent,
      },
      {
        key: 'visited',
        label: 'Visited',
        subtitle: `${visited.length} countries visited`,
        icon: <MapPin color="#FFFFFF" size={22} />,
        badge: visited.length,
        tint: colors.secondary,
      },
      {
        key: 'calendar' as Section,
        label: 'Calendar Sync',
        subtitle: isConnected
          ? `Last sync: ${lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Never'}`
          : 'Connect your calendar',
        icon: <CalendarIcon color="#FFFFFF" size={22} />,
        tint: colors.info,
      },
      {
        key: 'settings',
        label: 'Settings',
        subtitle: 'Theme, data, preferences',
        icon: <Settings color="#FFFFFF" size={22} />,
        tint: colors.warning,
      },
    ];

    return (
      <>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          More
        </Text>

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.menuItem,
                {
                  backgroundColor: item.tint,
                  borderWidth: 0,
                },
              ]}
              onPress={() => setActiveSection(item.key)}
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
            { backgroundColor: colors.primary, borderColor: colors.primary },
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
      </>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {activeSection === 'main' && renderMain()}
      {activeSection === 'visas' && renderVisas()}
      {activeSection === 'favorites' && renderFavorites()}
      {activeSection === 'visited' && renderVisited()}
      {activeSection === 'settings' && renderSettings()}
      {activeSection === 'calendar' && renderCalendar()}
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
    borderWidth: 0,
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
    borderWidth: 0,
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
  // Section navigation
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  sectionContent: {
    flex: 1,
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
  // Visas
  visaList: {
    gap: Spacing.sm,
  },
  visaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  visaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  visaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  visaName: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
  },
  visaCount: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  uncheckedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  // Settings
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
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    maxWidth: 280,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CreditCard,
  Heart,
  MapPin,
  Settings,
  Moon,
  Sun,
  ChevronRight,
  Check,
  X,
  Shield,
  Info,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { availableVisas } from '@/data/visaData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

type Section = 'main' | 'visas' | 'favorites' | 'visited' | 'settings';

export default function MoreScreen() {
  const { colors, mode, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { heldVisas, toggleHeldVisa, favorites, visited, setHeldVisas } = useVisa();
  const [activeSection, setActiveSection] = useState<Section>('main');

  // ── Held Visas Section ──
  const renderVisas = () => (
    <View style={styles.sectionContent}>
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => setActiveSection('main')}
      >
        <ChevronRight
          color={colors.textSecondary}
          size={18}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
        <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
          Back
        </Text>
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
                  backgroundColor: isHeld ? colors.primaryBg : colors.card,
                  borderColor: isHeld ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleHeldVisa(visa.id)}
              activeOpacity={0.7}
            >
              <View style={styles.visaInfo}>
                <View
                  style={[
                    styles.visaDot,
                    { backgroundColor: isHeld ? colors.primary : colors.textMuted },
                  ]}
                />
                <View>
                  <Text style={[styles.visaName, { color: colors.foreground }]}>
                    {visa.label}
                  </Text>
                  <Text style={[styles.visaCount, { color: colors.textSecondary }]}>
                    {visa.description}
                  </Text>
                </View>
              </View>
              {isHeld ? (
                <Check color={colors.primary} size={20} />
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
        style={styles.backRow}
        onPress={() => setActiveSection('main')}
      >
        <ChevronRight
          color={colors.textSecondary}
          size={18}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
        <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
          Back
        </Text>
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
        style={styles.backRow}
        onPress={() => setActiveSection('main')}
      >
        <ChevronRight
          color={colors.textSecondary}
          size={18}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
        <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
          Back
        </Text>
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
        style={styles.backRow}
        onPress={() => setActiveSection('main')}
      >
        <ChevronRight
          color={colors.textSecondary}
          size={18}
          style={{ transform: [{ rotate: '180deg' }] }}
        />
        <Text style={[styles.backLabel, { color: colors.textSecondary }]}>
          Back
        </Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Settings
      </Text>

      {/* Theme toggle */}
      <View
        style={[
          styles.settingRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.settingInfo}>
          {isDark ? (
            <Moon color={colors.primary} size={20} />
          ) : (
            <Sun color={colors.secondary} size={20} />
          )}
          <Text style={[styles.settingLabel, { color: colors.foreground }]}>
            Dark Mode
          </Text>
        </View>
        <Switch
          value={isDark}
          onValueChange={toggleTheme}
          trackColor={{ false: colors.border, true: colors.primaryBg }}
          thumbColor={isDark ? colors.primary : colors.textMuted}
        />
      </View>

      {/* Clear data */}
      <TouchableOpacity
        style={[
          styles.settingRow,
          { backgroundColor: colors.card, borderColor: colors.border },
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
          <Trash2 color={colors.danger} size={20} />
          <Text style={[styles.settingLabel, { color: colors.danger }]}>
            Clear Local Data
          </Text>
        </View>
        <ChevronRight color={colors.textMuted} size={18} />
      </TouchableOpacity>

      {/* About */}
      <View
        style={[
          styles.settingRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.settingInfo}>
          <Info color={colors.primary} size={20} />
          <Text style={[styles.settingLabel, { color: colors.foreground }]}>
            Version
          </Text>
        </View>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          1.0.0
        </Text>
      </View>
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
    }> = [
      {
        key: 'visas',
        label: 'Held Visas',
        subtitle: `${heldVisas.length} visas configured`,
        icon: <CreditCard color={colors.primary} size={22} />,
        badge: heldVisas.length,
      },
      {
        key: 'favorites',
        label: 'Favorites',
        subtitle: `${favorites.length} countries saved`,
        icon: <Heart color={colors.accent} size={22} />,
        badge: favorites.length,
      },
      {
        key: 'visited',
        label: 'Visited',
        subtitle: `${visited.length} countries visited`,
        icon: <MapPin color={colors.secondary} size={22} />,
        badge: visited.length,
      },
      {
        key: 'settings',
        label: 'Settings',
        subtitle: 'Theme, data, preferences',
        icon: <Settings color={colors.textSecondary} size={22} />,
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
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setActiveSection(item.key)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                {item.icon}
                <View>
                  <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.menuRight}>
                {item.badge != null && item.badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      {item.badge}
                    </Text>
                  </View>
                )}
                <ChevronRight color={colors.textMuted} size={18} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Passport strength */}
        <View
          style={[
            styles.passportCard,
            { backgroundColor: colors.primaryBg, borderColor: colors.primary },
          ]}
        >
          <Shield color={colors.primary} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.passportTitle, { color: colors.primary }]}>
              Passport Strength
            </Text>
            <Text style={[styles.passportSub, { color: colors.foreground }]}>
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
    borderRadius: Radius.md,
    borderWidth: 1,
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
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  backLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    borderRadius: Radius.md,
    borderWidth: 1,
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

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Plane, Trash2, Check, Globe, Clock, Wallet } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { getVisaCategoryColor } from '@/constants/theme';
import { getCostSymbol } from '@/data/travelData';

type SortBy = 'newest' | 'oldest' | 'name' | 'status';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
];

function countryCodeToFlag(code: string): string {
  if (!code || code.length < 2) return '';
  const chars = code
    .toUpperCase()
    .slice(0, 2)
    .split('')
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...chars);
}

function formatDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Skeleton card ──────────────────────────────────
function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
      <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: '60%', height: 20 }]} />
      <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: '40%', height: 14, marginTop: 8 }]} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 60, height: 24, borderRadius: 12 }]} />
        <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 50, height: 24, borderRadius: 12 }]} />
        <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 45, height: 24, borderRadius: 12 }]} />
      </View>
    </View>
  );
}

export default function TripsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const trips = useQuery(api.trips.listTrips);
  const deleteTrip = useMutation(api.trips.deleteTrip);
  const updateStatus = useMutation(api.trips.updateTripStatus);

  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!trips) return [];
    return [...trips].sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return a._creationTime - b._creationTime;
        case 'name': return a.countryName.localeCompare(b.countryName);
        case 'status': return (a.status || '').localeCompare(b.status || '');
        default: return b._creationTime - a._creationTime;
      }
    });
  }, [trips, sortBy]);

  const handleDelete = useCallback(
    (id: any, name: string) => {
      Alert.alert(
        'Delete trip',
        `Are you sure you want to delete your ${name} trip? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(id);
              await deleteTrip({ id });
              setDeletingId(null);
            },
          },
        ],
      );
    },
    [deleteTrip],
  );

  const handleToggleStatus = useCallback(
    async (id: any, currentStatus: string) => {
      await updateStatus({
        id,
        status: currentStatus === 'planned' ? 'completed' : 'planned',
      });
    },
    [updateStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const catColor = getVisaCategoryColor(item.visaCategory, colors);
      const isDeleting = deletingId === item._id;
      const isCompleted = item.status === 'completed';

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/trip/${item._id}`)}
          style={[styles.card, Shadows.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
        >
          {/* Left color accent bar */}
          <View style={[styles.colorBar, { backgroundColor: catColor }]} />

          <View style={styles.cardBody}>
            {/* Top row — country name + flag */}
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.countryName, { color: colors.foreground }]}>
                  {countryCodeToFlag(item.countryCode)}{' '}
                  {item.isMultiCountry ? item.routeTitle : item.countryName}
                </Text>
                <Text style={[styles.regionText, { color: colors.textMuted }]}>
                  {item.isMultiCountry ? 'Multi-country route' : `${item.region} \u00B7 ${item.capital}`}
                </Text>
              </View>
            </View>

            {/* Badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
                <Clock color={colors.primary} size={11} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {item.duration}d
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.secondaryBg }]}>
                <Wallet color={colors.secondary} size={11} />
                <Text style={[styles.badgeText, { color: colors.secondary }]}>
                  {getCostSymbol(item.costLevel as 1 | 2 | 3)} {item.dailyBudget}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.accentBg }]}>
                <Plane color={colors.accent} size={11} />
                <Text style={[styles.badgeText, { color: colors.accent }]}>
                  {item.flightHours}h
                </Text>
              </View>
            </View>

            {/* Footer — date + status + delete */}
            <View style={styles.footer}>
              <Text style={[styles.dateText, { color: colors.textMuted }]}>
                {formatDate(item._creationTime)}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => handleToggleStatus(item._id, item.status)}
                  style={[
                    styles.statusBtn,
                    {
                      backgroundColor: isCompleted ? colors.primaryBg : colors.shimmer,
                      borderColor: isCompleted ? colors.primary : colors.border,
                    },
                  ]}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  {isCompleted && <Check color={colors.primary} size={11} />}
                  <Text
                    style={[
                      styles.statusText,
                      { color: isCompleted ? colors.primary : colors.textMuted },
                    ]}
                  >
                    {isCompleted ? 'Done' : 'Planned'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(item._id, item.countryName)}
                  disabled={isDeleting}
                  style={[
                    styles.deleteBtn,
                    { backgroundColor: colors.shimmer, borderColor: colors.border, opacity: isDeleting ? 0.4 : 1 },
                  ]}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <Trash2 color={colors.textMuted} size={13} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, deletingId, handleDelete, handleToggleStatus, router],
  );

  // ─── Loading state ─────────────
  if (trips === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading your trips...</Text>
        <View style={{ marginTop: Spacing.lg, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      </View>
    );
  }

  // ─── Empty state ───────────────
  if (trips.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
          <Plane color={colors.textMuted} size={52} strokeWidth={1} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No trips yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Head to the map, pick a destination, and plan your next adventure.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={[styles.exploreBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}
          >
            <Globe color={colors.primary} size={16} />
            <Text style={[styles.exploreBtnText, { color: colors.primary }]}>Explore the Map</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main list ─────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
          </Text>
        </View>
      </View>

      {/* Sort pills */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setSortBy(opt.value)}
            style={[
              styles.sortPill,
              {
                backgroundColor: sortBy === opt.value ? colors.primaryBg : colors.shimmer,
                borderColor: sortBy === opt.value ? colors.primary : colors.borderSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.sortPillText,
                { color: sortBy === opt.value ? colors.primary : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sorted}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, gap: 12 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    marginBottom: Spacing.sm,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  // Sort pills
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  sortPillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Trip card
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  colorBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  countryName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    letterSpacing: 0.3,
  },
  regionText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 11,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 11,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
  },
  emptyBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  exploreBtnText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  // Skeleton
  skeletonBar: {
    borderRadius: Radius.xs,
    opacity: 0.6,
  },
});

import React, { useState, useCallback } from 'react';
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
import { Id } from '@/convex/_generated/dataModel';
import { BookOpen, Trash2, FileText, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
} from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  preparing: { label: 'Preparing', color: '#e9c46a', bg: 'rgba(233, 196, 106, 0.15)' },
  submitted: { label: 'Submitted', color: '#f4a261', bg: 'rgba(244, 162, 97, 0.15)' },
  approved:  { label: 'Approved',  color: '#2a9d8f', bg: 'rgba(42, 157, 143, 0.15)' },
  rejected:  { label: 'Rejected',  color: '#e76f51', bg: 'rgba(231, 111, 81, 0.15)' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChecklistProgress(json: string): { checked: number; total: number } {
  try {
    const items: ChecklistItem[] = JSON.parse(json);
    return { checked: items.filter((i) => i.checked).length, total: items.length };
  } catch {
    return { checked: 0, total: 0 };
  }
}

function countryCodeToFlag(code: string): string {
  // countryCode is alpha-3; take first 2 chars as rough alpha-2
  const a2 = code.slice(0, 2).toUpperCase();
  return a2
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.borderSubtle },
      ]}
    >
      <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer }]} />
      <View style={styles.cardBody}>
        <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.shimmer }]} />
        <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.shimmer, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: '80%', backgroundColor: colors.shimmer, marginTop: 16 }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GuidesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const guides = useQuery(api.visaGuides.listGuides);
  const deleteGuide = useMutation(api.visaGuides.deleteGuide);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: Id<'visaGuides'>, name: string) => {
      Alert.alert(
        'Delete visa guide',
        `Are you sure you want to delete the ${name} visa guide? Your checklist progress will be lost.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(id);
              await deleteGuide({ id });
              setDeletingId(null);
            },
          },
        ],
      );
    },
    [deleteGuide],
  );

  const renderGuide = useCallback(
    ({ item: guide }: { item: any }) => {
      const status = STATUS_CONFIG[guide.status] || STATUS_CONFIG.preparing;
      const progress = getChecklistProgress(guide.checklist);
      const pct = progress.total > 0
        ? Math.round((progress.checked / progress.total) * 100)
        : 0;
      const isDeleting = deletingId === guide._id;
      const flag = countryCodeToFlag(guide.countryCode);

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/guide/${guide._id}`)}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.borderSubtle,
              opacity: isDeleting ? 0.5 : 1,
            },
          ]}
        >
          {/* Status accent bar */}
          <View style={[styles.accentBar, { backgroundColor: status.color }]} />

          <View style={styles.cardBody}>
            {/* Top row */}
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={[styles.cardCountry, { color: colors.foreground }]}>
                  {flag} {guide.countryName}
                </Text>
                <Text style={[styles.cardVisaType, { color: colors.textMuted }]}>
                  {guide.visaType}
                </Text>
              </View>

              {/* Status badge */}
              <View style={[styles.badge, { backgroundColor: status.bg }]}>
                <Text style={[styles.badgeText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            {/* Progress */}
            {progress.total > 0 && (
              <View style={styles.progressWrap}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                    {progress.checked}/{progress.total} documents
                  </Text>
                  <Text
                    style={[
                      styles.progressPct,
                      { color: pct === 100 ? colors.success : colors.textMuted },
                    ]}
                  >
                    {pct}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.shimmer }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: pct === 100 ? colors.success : colors.secondary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Footer */}
            <View style={styles.cardFooter}>
              <TouchableOpacity
                onPress={() => handleDelete(guide._id as Id<'visaGuides'>, guide.countryName)}
                disabled={isDeleting}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                style={[styles.deleteBtn, { borderColor: colors.border }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size={14} color={colors.danger} />
                ) : (
                  <Trash2 color={colors.textMuted} size={15} strokeWidth={1.5} />
                )}
              </TouchableOpacity>
              <ChevronRight color={colors.textMuted} size={18} strokeWidth={1.5} />
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, deletingId, handleDelete, router],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <BookOpen color={colors.primary} size={24} strokeWidth={1.5} />
        <Text style={[styles.heading, { color: colors.foreground }]}>
          Visa Guides
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {guides === undefined
          ? 'Loading...'
          : guides.length > 0
            ? `${guides.length} guide${guides.length !== 1 ? 's' : ''} saved`
            : 'Your visa application guides will appear here'}
      </Text>

      {/* Loading */}
      {guides === undefined && (
        <View style={styles.listContent}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      )}

      {/* Empty state */}
      {guides && guides.length === 0 && (
        <View style={styles.emptyWrap}>
          <FileText color={colors.textMuted} size={52} strokeWidth={1} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No visa guides yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Start by exploring a country and creating a visa guide.
          </Text>
        </View>
      )}

      {/* Guide list */}
      {guides && guides.length > 0 && (
        <FlatList
          data={guides}
          keyExtractor={(g) => g._id}
          renderItem={renderGuide}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
  },
  subtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  listContent: {
    paddingBottom: 100,
    gap: Spacing.md,
  },

  // Card
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.card,
  },
  accentBar: {
    height: 4,
  },
  cardBody: {
    padding: Spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardCountry: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    lineHeight: 28,
  },
  cardVisaType: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Progress
  progressWrap: {
    marginBottom: Spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
  },
  progressPct: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Skeleton
  skeletonBar: {
    height: 4,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});

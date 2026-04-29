import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConvexAuth, useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { GuidesEmptyCard } from '@/components/guides/GuidesEmptyCard';
import { GuidesStatsRow } from '@/components/guides/GuidesStatsRow';
import {
  GuideApplicationCard,
  type GuideStatus,
} from '@/components/guides/GuideApplicationCard';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

function getChecklistProgress(json: string): { checked: number; total: number } {
  try {
    const items: ChecklistItem[] = JSON.parse(json);
    return {
      checked: items.filter((i) => i.checked).length,
      total: items.length,
    };
  } catch {
    return { checked: 0, total: 0 };
  }
}

export default function GuidesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { isAuthenticated } = useConvexAuth();
  const guides = useOfflineQuery(
    api.visaGuides.listGuides,
    isAuthenticated ? {} : 'skip',
  );
  const deleteGuide = useMutation(api.visaGuides.deleteGuide);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: Id<'visaGuides'>, countryName: string) => {
      Alert.alert(
        'Delete visa guide',
        `Are you sure you want to delete the ${countryName} visa guide? Your checklist progress will be lost.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(id);
              try {
                await deleteGuide({ id });
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [deleteGuide],
  );

  // Derived totals for the OPEN APPS / DOCS READY tiles.
  const stats = (() => {
    if (!guides) return { openApps: 0, docsReady: 0, totalDocs: 0 };
    const open = guides.filter(
      (g) => g.status === 'preparing' || g.status === 'submitted',
    ).length;
    let checked = 0;
    let total = 0;
    for (const g of guides) {
      const p = getChecklistProgress(g.checklist);
      checked += p.checked;
      total += p.total;
    }
    return { openApps: open, docsReady: checked, totalDocs: total };
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopSafeAreaBlur />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial header */}
        <View style={styles.header}>
          <Text
            style={[
              Type.kicker,
              { color: colors.inkMute, letterSpacing: 11 * 0.22 },
            ]}
          >
            EDITORIAL
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 32,
              fontWeight: '500',
              letterSpacing: -32 * 0.022,
              lineHeight: 34,
              color: colors.ink,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
              }}
            >
              Guides
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
        </View>

        {/* Loading */}
        {guides === undefined ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.inkMute} />
          </View>
        ) : guides.length === 0 ? (
          // ── Empty state ────────────────────────────────────────────
          <GuidesEmptyCard
            onStart={() => router.push('/(tabs)/explore' as never)}
          />
        ) : (
          // ── With-guides state ─────────────────────────────────────
          <>
            <GuidesStatsRow
              openApps={stats.openApps}
              docsReady={stats.docsReady}
              totalDocs={stats.totalDocs}
            />

            <View style={styles.applicationsHeader}>
              <Text
                style={[
                  Type.kicker,
                  {
                    color: colors.inkMute,
                    fontSize: 10,
                    letterSpacing: 10 * 0.22,
                  },
                ]}
              >
                YOUR APPLICATIONS
              </Text>
              <Squiggle width={50} color={colors.coral} />
            </View>

            <View style={styles.list}>
              {guides.map((guide) => {
                const progress = getChecklistProgress(guide.checklist);
                return (
                  <GuideApplicationCard
                    key={guide._id}
                    countryCode={guide.countryCode}
                    countryName={guide.countryName}
                    visaType={guide.visaType}
                    status={guide.status as GuideStatus}
                    checked={progress.checked}
                    total={progress.total}
                    deleting={deletingId === guide._id}
                    onPress={() => router.push(`/guide/${guide._id}` as never)}
                    onDelete={() =>
                      handleDelete(guide._id as Id<'visaGuides'>, guide.countryName)
                    }
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {},
  header: {
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  applicationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 22,
  },
  list: {
    gap: 10,
    paddingHorizontal: 16,
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
});

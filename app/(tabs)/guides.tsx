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
import { useMutation, useConvexAuth } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOffline } from '@/contexts/offline-context';
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
  preparing: { label: 'Preparing', color: '#E5A832', bg: 'rgba(229, 168, 50, 0.15)' },
  submitted: { label: 'Submitted', color: '#EB6D3A', bg: 'rgba(235, 109, 58, 0.15)' },
  approved:  { label: 'Approved',  color: '#2EAA6E', bg: 'rgba(46, 170, 110, 0.15)' },
  rejected:  { label: 'Rejected',  color: '#E05545', bg: 'rgba(224, 85, 69, 0.15)' },
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

/* prettier-ignore */
const A3_TO_A2: Record<string,string> = {
  AFG:'AF',ALB:'AL',DZA:'DZ',AND:'AD',AGO:'AO',ATG:'AG',ARG:'AR',ARM:'AM',AUS:'AU',AUT:'AT',
  AZE:'AZ',BHS:'BS',BHR:'BH',BGD:'BD',BRB:'BB',BLR:'BY',BEL:'BE',BLZ:'BZ',BEN:'BJ',BTN:'BT',
  BOL:'BO',BIH:'BA',BWA:'BW',BRA:'BR',BRN:'BN',BGR:'BG',BFA:'BF',BDI:'BI',KHM:'KH',CMR:'CM',
  CAN:'CA',CPV:'CV',CAF:'CF',TCD:'TD',CHL:'CL',CHN:'CN',COL:'CO',COM:'KM',COG:'CG',COD:'CD',
  CRI:'CR',CIV:'CI',HRV:'HR',CUB:'CU',CYP:'CY',CZE:'CZ',DNK:'DK',DJI:'DJ',DMA:'DM',DOM:'DO',
  ECU:'EC',EGY:'EG',SLV:'SV',GNQ:'GQ',ERI:'ER',EST:'EE',SWZ:'SZ',ETH:'ET',FJI:'FJ',FIN:'FI',
  FRA:'FR',GAB:'GA',GMB:'GM',GEO:'GE',DEU:'DE',GHA:'GH',GRC:'GR',GRD:'GD',GTM:'GT',GIN:'GN',
  GNB:'GW',GUY:'GY',HTI:'HT',HND:'HN',HUN:'HU',ISL:'IS',IND:'IN',IDN:'ID',IRN:'IR',IRQ:'IQ',
  IRL:'IE',ISR:'IL',ITA:'IT',JAM:'JM',JPN:'JP',JOR:'JO',KAZ:'KZ',KEN:'KE',KIR:'KI',PRK:'KP',
  KOR:'KR',KWT:'KW',KGZ:'KG',LAO:'LA',LVA:'LV',LBN:'LB',LSO:'LS',LBR:'LR',LBY:'LY',LIE:'LI',
  LTU:'LT',LUX:'LU',MDG:'MG',MWI:'MW',MYS:'MY',MDV:'MV',MLI:'ML',MLT:'MT',MHL:'MH',MRT:'MR',
  MUS:'MU',MEX:'MX',FSM:'FM',MDA:'MD',MCO:'MC',MNG:'MN',MNE:'ME',MAR:'MA',MOZ:'MZ',MMR:'MM',
  NAM:'NA',NRU:'NR',NPL:'NP',NLD:'NL',NZL:'NZ',NIC:'NI',NER:'NE',NGA:'NG',MKD:'MK',NOR:'NO',
  OMN:'OM',PAK:'PK',PLW:'PW',PAN:'PA',PNG:'PG',PRY:'PY',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',
  QAT:'QA',ROU:'RO',RUS:'RU',RWA:'RW',KNA:'KN',LCA:'LC',VCT:'VC',WSM:'WS',SMR:'SM',STP:'ST',
  SAU:'SA',SEN:'SN',SRB:'RS',SYC:'SC',SLE:'SL',SGP:'SG',SVK:'SK',SVN:'SI',SLB:'SB',SOM:'SO',
  ZAF:'ZA',ESP:'ES',LKA:'LK',SDN:'SD',SUR:'SR',SWE:'SE',CHE:'CH',SYR:'SY',TWN:'TW',TJK:'TJ',
  TZA:'TZ',THA:'TH',TLS:'TL',TGO:'TG',TON:'TO',TTO:'TT',TUN:'TN',TUR:'TR',TKM:'TM',TUV:'TV',
  UGA:'UG',UKR:'UA',ARE:'AE',GBR:'GB',USA:'US',URY:'UY',UZB:'UZ',VUT:'VU',VEN:'VE',VNM:'VN',
  YEM:'YE',ZMB:'ZM',ZWE:'ZW',PSE:'PS',XKX:'XK',
};
function countryCodeToFlag(code: string): string {
  const a2 = A3_TO_A2[code.toUpperCase()] || code.slice(0, 2).toUpperCase();
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

  const { isAuthenticated } = useConvexAuth();
  const guides = useOfflineQuery(api.visaGuides.listGuides, isAuthenticated ? {} : 'skip');
  const { isOffline } = useOffline();
  const deleteGuide = useMutation(api.visaGuides.deleteGuide);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    (id: Id<'visaGuides'>, name: string) => {
      if (isOffline) return;
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
              backgroundColor: status.color,
              borderWidth: 0,
              opacity: isDeleting ? 0.5 : 1,
            },
          ]}
        >
          {/* Status accent bar */}
          <View style={[styles.accentBar, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />

          <View style={styles.cardBody}>
            {/* Top row */}
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={[styles.cardCountry, { color: '#FFFFFF' }]}>
                  {flag} {guide.countryName}
                </Text>
                <Text style={[styles.cardVisaType, { color: 'rgba(255,255,255,0.70)' }]}>
                  {guide.visaType}
                </Text>
              </View>

              {/* Status badge */}
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            {/* Progress */}
            {progress.total > 0 && (
              <View style={styles.progressWrap}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.progressLabel, { color: 'rgba(255,255,255,0.70)' }]}>
                    {progress.checked}/{progress.total} documents
                  </Text>
                  <Text
                    style={[
                      styles.progressPct,
                      { color: '#FFFFFF' },
                    ]}
                  >
                    {pct}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: '#FFFFFF',
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
                style={[styles.deleteBtn, { borderColor: 'rgba(255,255,255,0.25)' }]}
              >
                {isDeleting ? (
                  <ActivityIndicator size={14} color={'#FFFFFF'} />
                ) : (
                  <Trash2 color="rgba(255,255,255,0.70)" size={15} strokeWidth={1.5} />
                )}
              </TouchableOpacity>
              <ChevronRight color="rgba(255,255,255,0.70)" size={18} strokeWidth={1.5} />
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
    borderRadius: 20,
    borderWidth: 0,
    overflow: 'hidden',
    ...Shadows.card,
  },
  accentBar: {
    height: 5,
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

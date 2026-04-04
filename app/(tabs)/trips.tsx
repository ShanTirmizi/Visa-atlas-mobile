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
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
import { useOffline } from '@/contexts/offline-context';
import { api } from '@/convex/_generated/api';
import { Plane, Trash2, Check, Globe, Clock, Wallet, MoveRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { getVisaCategoryColor } from '@/constants/theme';
import { getCostSymbol } from '@/data/travelData';
import BookingsListView from '@/components/booking/BookingsListView';
import SegmentedControl from '@/components/ui/SegmentedControl';

type SortBy = 'newest' | 'oldest' | 'name' | 'status';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
];

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
  if (!code || code.length < 2) return '';
  const a2 = A3_TO_A2[code.toUpperCase()] || code.slice(0, 2).toUpperCase();
  return a2.split('').map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');
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
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle, padding: Spacing.md }]}>
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

  const trips = useOfflineQuery(api.trips.listTrips, {});
  const deleteTrip = useMutation(api.trips.deleteTrip); // Keep online-only (cascading delete)
  const updateStatus = useOfflineMutation(api.trips.updateTripStatus);
  const { isOffline } = useOffline();

  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [activeTab, setActiveTab] = useState<'trips' | 'bookings'>('trips');
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
      if (isOffline) return;
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
          activeOpacity={0.8}
          onPress={() => router.push(`/trip/${item._id}`)}
          style={[styles.card, Shadows.card, { backgroundColor: catColor }]}
        >
          <View style={styles.cardBody}>
            {/* Top row — country name + flag */}
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  {item.isMultiCountry && item.routeTitle ? (
                    <>
                      <Text style={[styles.countryName, { color: '#FFFFFF' }]}>
                        {countryCodeToFlag(item.countryCode)}{' '}
                        {item.routeTitle.split(/\s*→\s*/)[0]}
                      </Text>
                      <MoveRight color="#FFFFFF" size={18} style={{ opacity: 0.8 }} />
                      <Text style={[styles.countryName, { color: '#FFFFFF' }]}>
                        {item.routeTitle.split(/\s*→\s*/).slice(1).join(' → ')}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.countryName, { color: '#FFFFFF' }]}>
                      {countryCodeToFlag(item.countryCode)}{' '}
                      {item.countryName}
                    </Text>
                  )}
                </View>
                <Text style={[styles.regionText, { color: 'rgba(255,255,255,0.70)' }]}>
                  {item.isMultiCountry ? 'Multi-country route' : `${item.region} \u00B7 ${item.capital}`}
                </Text>
              </View>
            </View>

            {/* Badges */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Clock color="#FFFFFF" size={11} />
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                  {item.duration}d
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Wallet color="#FFFFFF" size={11} />
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                  {getCostSymbol(item.costLevel as 1 | 2 | 3)} {item.dailyBudget}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Plane color="#FFFFFF" size={11} />
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                  {item.flightHours}h
                </Text>
              </View>
            </View>

            {/* Footer — date + status + delete */}
            <View style={styles.footer}>
              <Text style={[styles.dateText, { color: 'rgba(255,255,255,0.60)' }]}>
                {formatDate(item._creationTime)}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => handleToggleStatus(item._id, item.status)}
                  style={[
                    styles.statusBtn,
                    {
                      backgroundColor: 'rgba(255,255,255,0.20)',
                      borderColor: 'rgba(255,255,255,0.30)',
                    },
                  ]}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  {isCompleted && <Check color="#FFFFFF" size={11} />}
                  <Text
                    style={[
                      styles.statusText,
                      { color: '#FFFFFF' },
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
                    { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.20)', opacity: isDeleting ? 0.4 : 1 },
                  ]}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Trash2 color="rgba(255,255,255,0.80)" size={13} />
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

        <SegmentedControl
          tabs={['My Trips', 'Bookings']}
          activeIndex={activeTab === 'trips' ? 0 : 1}
          onTabPress={(i) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
        />

        {activeTab === 'trips' ? (
          <>
            <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 100, height: 14, marginTop: 4, borderRadius: 6 }]} />
            <View style={{ marginTop: Spacing.lg, gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} colors={colors} />
              ))}
            </View>
          </>
        ) : (
          <BookingsListView bottomInset={insets.bottom} />
        )}
      </View>
    );
  }

  // ─── Empty state ───────────────
  if (trips.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>

        <SegmentedControl
          tabs={['My Trips', 'Bookings']}
          activeIndex={activeTab === 'trips' ? 0 : 1}
          onTabPress={(i) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
        />

        {activeTab === 'trips' ? (
          <View style={[styles.emptyState, { backgroundColor: colors.primary }, Shadows.card]}>
            <Plane color="rgba(255,255,255,0.5)" size={52} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: '#FFFFFF' }]}>No trips yet</Text>
            <Text style={[styles.emptyBody, { color: 'rgba(255,255,255,0.80)' }]}>
              Head to the map, pick a destination, and plan your next adventure.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)')}
              style={[styles.exploreBtn, { backgroundColor: 'rgba(255,255,255,0.20)', borderColor: 'rgba(255,255,255,0.30)' }]}
            >
              <Globe color="#FFFFFF" size={16} />
              <Text style={[styles.exploreBtnText, { color: '#FFFFFF' }]}>Explore the Map</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <BookingsListView bottomInset={insets.bottom} />
        )}
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

      <SegmentedControl
        tabs={['My Trips', 'Bookings']}
        activeIndex={activeTab === 'trips' ? 0 : 1}
        onTabPress={(i) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
      />

      <Animated.View
        key={activeTab}
        entering={FadeIn.duration(200)}
        style={{ flex: 1 }}
      >
        {activeTab === 'trips' ? (
          <>
            {/* Sort pills */}
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSortBy(opt.value)}
                  style={[
                    styles.sortPill,
                    sortBy === opt.value
                      ? { backgroundColor: colors.accent, ...Shadows.glow(colors.accent, 0.2) }
                      : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      { color: sortBy === opt.value ? '#FFFFFF' : colors.textMuted },
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
          </>
        ) : (
          <BookingsListView bottomInset={insets.bottom} />
        )}
      </Animated.View>
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  sortPillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Trip card — vibrant solid color like HabitQuest
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  colorBar: {
    width: 0,
    display: 'none',
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
    borderRadius: 20,
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

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOfflineMutation } from '@/hooks/use-offline-mutation';
import { useOffline } from '@/contexts/offline-context';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  Plane,
  Check,
  Globe,
  Clock,
  Wallet,
  MoveRight,
  ArrowUpDown,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { getVisaCategoryColor } from '@/constants/theme';
import { getCostSymbol } from '@/data/travelData';
import BookingsListView from '@/components/booking/BookingsListView';
import SegmentedControl from '@/components/ui/SegmentedControl';

type SortBy = 'newest' | 'oldest' | 'name' | 'status';

const SORT_LABELS: Record<SortBy, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  name: 'By name',
  status: 'By status',
};

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

function formatTravelDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface HeroImageData {
  url: string;
  credit?: string;
  creditUrl?: string;
  link?: string;
}

function parseHeroImage(raw: string | null | undefined): HeroImageData | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'url' in parsed &&
      typeof (parsed as Record<string, unknown>).url === 'string'
    ) {
      return parsed as HeroImageData;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Skeleton card ----
function SkeletonCard({ colors }: { colors: Record<string, string> }) {
  return (
    <View style={[styles.card, Shadows.card, { backgroundColor: colors.card }]}>
      {/* Image skeleton */}
      <View style={[styles.heroArea, { backgroundColor: colors.shimmer }]} />
      {/* Bottom section skeleton */}
      <View style={styles.cardBottom}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 60, height: 24, borderRadius: 12 }]} />
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 50, height: 24, borderRadius: 12 }]} />
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 55, height: 24, borderRadius: 12 }]} />
          <View style={{ flex: 1 }} />
          <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 64, height: 24, borderRadius: 12 }]} />
        </View>
        <View style={[styles.skeletonBar, { backgroundColor: colors.shimmer, width: 130, height: 14, borderRadius: 6, marginTop: 10 }]} />
      </View>
    </View>
  );
}

export default function TripsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const trips = useOfflineQuery(api.trips.listTrips, {});
  const deleteTrip = useMutation(api.trips.deleteTrip);
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
    (id: string, name: string) => {
      if (isOffline) return;
      const tripData = trips?.find((t: { _id: string }) => t._id === id);
      if ((tripData as { _role?: string })?._role !== 'owner') return;
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
              await deleteTrip({ id: id as Id<'trips'> });
              setDeletingId(null);
            },
          },
        ],
      );
    },
    [deleteTrip, isOffline, trips],
  );

  const handleToggleStatus = useCallback(
    async (id: Id<'trips'>, currentStatus: string) => {
      await updateStatus({
        id,
        status: currentStatus === 'planned' ? 'completed' : 'planned',
      });
    },
    [updateStatus],
  );

  const showSortMenu = useCallback(() => {
    const options: SortBy[] = ['newest', 'oldest', 'name', 'status'];
    Alert.alert(
      'Sort trips',
      undefined,
      [
        ...options.map((opt) => ({
          text: `${sortBy === opt ? '\u2713 ' : ''}${SORT_LABELS[opt]}`,
          onPress: () => setSortBy(opt),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [sortBy]);

  const renderItem = useCallback(
    ({ item }: { item: Record<string, unknown> }) => {
      const catColor = getVisaCategoryColor(item.visaCategory as string, colors);
      const isDeleting = deletingId === (item._id as string);
      const isCompleted = item.status === 'completed';
      const heroImage = parseHeroImage(item.heroImage as string | null | undefined);
      const hasImage = heroImage !== null;

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/trip/${item._id as string}`)}
          onLongPress={() => handleDelete(item._id as string, item.countryName as string)}
          delayLongPress={500}
          style={[styles.card, Shadows.card, { backgroundColor: colors.card }]}
        >
          {/* Hero image area */}
          <View style={[styles.heroArea, { backgroundColor: catColor }]}>
            {hasImage && (
              <Image
                source={{ uri: heroImage.url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}
            {/* Gradient overlay at bottom of image */}
            <View style={styles.heroOverlay} />

            {/* Country info overlaid on the image */}
            <View style={styles.heroContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                {(item.isMultiCountry as boolean) && (item.routeTitle as string) ? (
                  <>
                    <Text style={styles.heroCountryName}>
                      {countryCodeToFlag(item.countryCode as string)}{' '}
                      {(item.routeTitle as string).split(/\s*\u2192\s*/)[0]}
                    </Text>
                    <MoveRight color="#FFFFFF" size={18} style={{ opacity: 0.8 }} />
                    <Text style={styles.heroCountryName}>
                      {(item.routeTitle as string).split(/\s*\u2192\s*/).slice(1).join(' \u2192 ')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.heroCountryName}>
                    {countryCodeToFlag(item.countryCode as string)}{' '}
                    {item.countryName as string}
                  </Text>
                )}
              </View>

              <Text style={styles.heroSubtitle}>
                {(item.isMultiCountry as boolean)
                  ? 'Multi-country route'
                  : `${item.region as string} \u00B7 ${item.capital as string}`}
              </Text>

              {(item._role as string) !== 'owner' && (
                <Text style={styles.heroSharedBadge}>
                  Shared \u00B7 {item._role as string}
                </Text>
              )}
            </View>
          </View>

          {/* Bottom card section */}
          <View style={[styles.cardBottom, { backgroundColor: colors.card }]}>
            {/* Stats row + status */}
            <View style={styles.statsRow}>
              <View style={[styles.statChip, { backgroundColor: colors.shimmer }]}>
                <Clock color={colors.textSecondary} size={11} />
                <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                  {item.duration as number}d
                </Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: colors.shimmer }]}>
                <Wallet color={colors.textSecondary} size={11} />
                <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                  {getCostSymbol((item.costLevel as 1 | 2 | 3) || 1)}
                </Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: colors.shimmer }]}>
                <Plane color={colors.textSecondary} size={11} />
                <Text style={[styles.statChipText, { color: colors.textSecondary }]}>
                  {item.flightHours as number}h
                </Text>
              </View>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                onPress={() => handleToggleStatus(item._id as Id<'trips'>, item.status as string)}
                style={[
                  styles.statusPill,
                  isCompleted
                    ? { backgroundColor: colors.visaFreeBg }
                    : { backgroundColor: colors.primaryBg },
                ]}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                {isCompleted && <Check color={colors.visaFree} size={11} />}
                <Text
                  style={[
                    styles.statusPillText,
                    { color: isCompleted ? colors.visaFree : colors.primary },
                  ]}
                >
                  {isCompleted ? 'Done' : 'Planned'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Travel dates or creation date */}
            <View style={styles.dateRow}>
              {(item.startDate as string | undefined) ? (
                <Text style={[styles.travelDate, { color: colors.textMuted }]}>
                  {formatTravelDate(item.startDate as string)}
                  {(item.endDate as string | undefined)
                    ? ` \u2013 ${formatTravelDate(item.endDate as string)}`
                    : ''}
                </Text>
              ) : (
                <Text style={[styles.travelDate, { color: colors.textMuted }]}>
                  Added {formatDate(item._creationTime as number)}
                </Text>
              )}

              {isDeleting && (
                <ActivityIndicator size="small" color={colors.danger} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, deletingId, handleDelete, handleToggleStatus, router],
  );

  // ---- Header component (reused across states) ----
  const renderHeader = (tripCount?: number) => (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.heading, { color: colors.foreground }]}>My Trips</Text>
        {tripCount !== undefined && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {tripCount} trip{tripCount !== 1 ? 's' : ''} planned
          </Text>
        )}
      </View>
      {tripCount !== undefined && tripCount > 1 && (
        <TouchableOpacity
          onPress={showSortMenu}
          style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <ArrowUpDown color={colors.textSecondary} size={16} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ---- Loading state ----
  if (trips === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
        {renderHeader()}

        <SegmentedControl
          tabs={['My Trips', 'Bookings']}
          activeIndex={activeTab === 'trips' ? 0 : 1}
          onTabPress={(i: number) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
        />

        {activeTab === 'trips' ? (
          <View style={{ marginTop: Spacing.md, gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} colors={colors} />
            ))}
          </View>
        ) : (
          <BookingsListView bottomInset={insets.bottom} />
        )}
      </View>
    );
  }

  // ---- Empty state ----
  if (trips.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
        {renderHeader()}

        <SegmentedControl
          tabs={['My Trips', 'Bookings']}
          activeIndex={activeTab === 'trips' ? 0 : 1}
          onTabPress={(i: number) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
        />

        {activeTab === 'trips' ? (
          <View style={styles.emptyContainer}>
            <Globe color={colors.textMuted} size={56} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No trips yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Start planning your next adventure
            </Text>
          </View>
        ) : (
          <BookingsListView bottomInset={insets.bottom} />
        )}
      </View>
    );
  }

  // ---- Main list ----
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
      {renderHeader(trips.length)}

      <SegmentedControl
        tabs={['My Trips', 'Bookings']}
        activeIndex={activeTab === 'trips' ? 0 : 1}
        onTabPress={(i: number) => setActiveTab(i === 0 ? 'trips' : 'bookings')}
      />

      <Animated.View
        key={activeTab}
        entering={FadeIn.duration(200)}
        style={{ flex: 1 }}
      >
        {activeTab === 'trips' ? (
          <FlatList
            data={sorted}
            renderItem={renderItem}
            keyExtractor={(item) => item._id as string}
            contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: insets.bottom + 100, gap: 16 }}
            showsVerticalScrollIndicator={false}
          />
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
  // ---- Header ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  heading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['3xl'],
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  sortButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  // ---- Trip card (postcard) ----
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroArea: {
    height: 200,
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    // Stronger at bottom via a tall bottom-weighted overlay
    // We use a single semi-transparent layer since LinearGradient isn't available
  },
  heroContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.md,
    zIndex: 1,
  },
  heroCountryName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  },
  heroSharedBadge: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.90)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  // ---- Card bottom section ----
  cardBottom: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statChipText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusPillText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  travelDate: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
  },
  // ---- Empty state ----
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
  },
  emptyBody: {
    fontFamily: 'Lora_400Regular_Italic',
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  // ---- Skeleton ----
  skeletonBar: {
    borderRadius: Radius.xs,
    opacity: 0.6,
  },
});

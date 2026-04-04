import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
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
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';
import { getVisaCategoryColor } from '@/constants/theme';
import { getCostSymbol } from '@/data/travelData';
import BookingsListView from '@/components/booking/BookingsListView';
import SegmentedControl from '@/components/ui/SegmentedControl';

type SortBy = 'newest' | 'oldest' | 'name' | 'status';

const SORT_LABELS: Record<SortBy, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  name: 'Name',
  status: 'Status',
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

// ---- Skeleton card (magazine style) ----
function SkeletonCard({ colors }: { colors: Record<string, string> }) {
  return (
    <View style={[styles.card, Shadows.card, { backgroundColor: colors.shimmer }]}>
      <View style={[styles.skeletonStatusPill, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
      <View style={styles.cardOverlay} />
      <View style={[styles.cardContent, { gap: 6 }]}>
        <View style={[styles.skeletonBar, { backgroundColor: 'rgba(255,255,255,0.2)', width: 160, height: 22, borderRadius: 4 }]} />
        <View style={[styles.skeletonBar, { backgroundColor: 'rgba(255,255,255,0.15)', width: 110, height: 14, borderRadius: 4 }]} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[60, 50, 55].map((w, i) => (
            <View key={i} style={[styles.skeletonBar, { backgroundColor: 'rgba(255,255,255,0.15)', width: w, height: 26, borderRadius: 999 }]} />
          ))}
        </View>
        <View style={[styles.skeletonBar, { backgroundColor: 'rgba(255,255,255,0.12)', width: 100, height: 12, borderRadius: 4 }]} />
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

  // ---- Sort pills ----
  const renderSortPills = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.sortPillsRow}
      contentContainerStyle={{ paddingVertical: 4 }}
    >
      {(['newest', 'oldest', 'name', 'status'] as const).map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => setSortBy(opt)}
          style={[
            styles.sortPill,
            sortBy === opt
              ? { backgroundColor: colors.accent }
              : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle },
          ]}
        >
          <Text
            style={[
              styles.sortPillText,
              { color: sortBy === opt ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            {SORT_LABELS[opt]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderItem = useCallback(
    ({ item }: { item: Record<string, unknown> }) => {
      const catColor = getVisaCategoryColor(item.visaCategory as string, colors);
      const isDeleting = deletingId === (item._id as string);
      const isCompleted = item.status === 'completed';
      const heroImage = parseHeroImage(item.heroImage as string | null | undefined);
      const hasImage = heroImage !== null;

      return (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push(`/trip/${item._id as string}`)}
          onLongPress={() => handleDelete(item._id as string, item.countryName as string)}
          delayLongPress={500}
          style={[styles.card, Shadows.card]}
        >
          {/* Background: hero image or category color */}
          {hasImage ? (
            <Image
              source={{ uri: heroImage.url }}
              style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: catColor }]}>
              {/* Decorative fallback: large semi-transparent globe */}
              <Globe
                color="rgba(255,255,255,0.12)"
                size={200}
                strokeWidth={1}
                style={{ position: 'absolute', right: -40, top: -20 }}
              />
            </View>
          )}

          {/* Dark gradient overlay at the bottom */}
          <View style={styles.cardOverlay} />

          {/* Status pill — top right */}
          <TouchableOpacity
            onPress={() => handleToggleStatus(item._id as Id<'trips'>, item.status as string)}
            style={styles.statusPillAbsolute}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {isCompleted && <Check color="#FFFFFF" size={10} />}
            <Text style={styles.statusPillAbsoluteText}>
              {isCompleted ? 'Done' : 'Planned'}
            </Text>
          </TouchableOpacity>

          {/* Main content pinned to bottom */}
          <View style={styles.cardContent}>
            {/* Country name + flag */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              {(item.isMultiCountry as boolean) && (item.routeTitle as string) ? (
                <>
                  <Text style={styles.cardCountryName}>
                    {countryCodeToFlag(item.countryCode as string)}{' '}
                    {(item.routeTitle as string).split(/\s*\u2192\s*/)[0]}
                  </Text>
                  <MoveRight color="#FFFFFF" size={16} style={{ opacity: 0.8 }} />
                  <Text style={styles.cardCountryName}>
                    {(item.routeTitle as string).split(/\s*\u2192\s*/).slice(1).join(' \u2192 ')}
                  </Text>
                </>
              ) : (
                <Text style={styles.cardCountryName}>
                  {countryCodeToFlag(item.countryCode as string)}{' '}
                  {item.countryName as string}
                </Text>
              )}
            </View>

            {/* Region / capital or multi-country label */}
            <Text style={styles.cardSubtitle}>
              {(item.isMultiCountry as boolean)
                ? 'Multi-country route'
                : `${item.region as string} \u00B7 ${item.capital as string}`}
            </Text>

            {/* Frosted stat pills */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={styles.frostedChip}>
                <Clock color="rgba(255,255,255,0.85)" size={11} />
                <Text style={styles.frostedChipText}>{item.duration as number}d</Text>
              </View>
              <View style={styles.frostedChip}>
                <Wallet color="rgba(255,255,255,0.85)" size={11} />
                <Text style={styles.frostedChipText}>
                  {getCostSymbol((item.costLevel as 1 | 2 | 3) || 1)}
                </Text>
              </View>
              <View style={styles.frostedChip}>
                <Plane color="rgba(255,255,255,0.85)" size={11} />
                <Text style={styles.frostedChipText}>{item.flightHours as number}h</Text>
              </View>
            </View>

            {/* Dates row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {(item.startDate as string | undefined) ? (
                <Text style={styles.cardDate}>
                  {formatTravelDate(item.startDate as string)}
                  {(item.endDate as string | undefined)
                    ? ` \u2013 ${formatTravelDate(item.endDate as string)}`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.cardDate}>
                  Added {formatDate(item._creationTime as number)}
                </Text>
              )}
              {isDeleting && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
            </View>

            {/* Shared badge */}
            {(item._role as string) !== 'owner' && (
              <Text style={styles.sharedBadge}>
                Shared \u00B7 {item._role as string}
              </Text>
            )}
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
            ListHeaderComponent={renderSortPills}
            contentContainerStyle={{ paddingTop: Spacing.xs, paddingBottom: insets.bottom + 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
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
  // ---- Sort pills ----
  sortPillsRow: {
    marginBottom: Spacing.sm,
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 8,
  },
  sortPillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ---- Magazine Cover card ----
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 280,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    gap: 6,
  },
  statusPillAbsolute: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  statusPillAbsoluteText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardCountryName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.80)',
  },
  frostedChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  frostedChipText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  cardDate: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  sharedBadge: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.90)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
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
  skeletonStatusPill: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 70,
    height: 26,
    borderRadius: 999,
    zIndex: 2,
  },
});

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { Globe, Heart, MoreHorizontal, MessageSquare, Trash2 } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { tabSlideIn } from '@/utils/tabAnimation';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { hapticImpact, hapticSuccess } from '@/utils/haptics';
import { Spacing, getVisaCategoryColor, FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';

// ── UI Primitives ──────────────────────────────────────────
import BackButton from '@/components/ui/BackButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Squiggle } from '@/components/ui/Squiggle';

// ── Trip Overview components ───────────────────────────────
import { TripOverviewHero } from '@/components/trip/overview/TripOverviewHero';
import { NextUpCard } from '@/components/trip/overview/NextUpCard';
import { HighlightsStrip, type HighlightItem } from '@/components/trip/overview/HighlightsStrip';
import { TripBriefReadout } from '@/components/trip/TripBriefReadout';
import { CountryTipsView } from '@/components/tips/CountryTipsView';

// ── Bookings ───────────────────────────────────────────────
import { BookingTimeline } from '@/components/trip/bookings/BookingTimeline';
import AddBookingSheet, { type AddBookingSheetRef } from '@/components/booking/AddBookingSheet';
import BookingDetailSheet, {
  type BookingDetailSheetRef,
  type BookingDetailData,
} from '@/components/booking/BookingDetailSheet';

// ── DayDeck (for Itinerary tab) ────────────────────────────
import DayDeck from '@/components/trip/DayDeck';

// ── Food tab — per-trip dining guide ───────────────────────
import { FoodTab } from '@/components/trip/food/FoodTab';
import { parseDiningGuide, type ItineraryDay } from '@/types/itinerary';

// ── Collaboration — overlapping avatars in the header ──────
import { CollabStack } from '@/components/trip/CollabStack';

// ── Share — public link sheet (3-dot menu → Share this trip) ──
import ShareTripSheet from '@/components/trip/ShareTripSheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

// ── Visa guide sheet — same flow used on country/[code] ────
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useVisa } from '@/contexts/visa-context';
import {
  visaData as staticVisaData,
  resolveCountry,
  type HeldVisaType,
} from '@/data/visaData';
import { toAlpha3 } from '@/utils/countryCode';
import { VisaHeroCardForCountry } from '@/components/visa/VisaHeroCardForCountry';
import { VisaDeadlineCard } from '@/components/visa/VisaDeadlineCard';
import { VisaChecklistCard } from '@/components/visa/VisaChecklistCard';

// ── Streaming-generation UI: progress strip, skeletons, retry ──
import { TripGenerationStrip } from '@/components/trip/TripGenerationStrip';
import { TripHeroSkeleton } from '@/components/trip/skeletons/TripHeroSkeleton';
import { HighlightsSkeleton } from '@/components/trip/skeletons/HighlightsSkeleton';
import { VisaTabSkeleton } from '@/components/trip/skeletons/VisaTabSkeleton';
import { SectionRetryCard } from '@/components/trip/skeletons/SectionRetryCard';
import { TripFailedScreen } from '@/components/trip/TripFailedScreen';
import {
  isGenerating,
  isSectionPending,
  hasFailed,
  isRetrying,
  getCompletedSectionCount,
  getTotalSectionCount,
  getTabDotIndicators,
  getStreamingDayIndex,
} from '@/utils/sectionState';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const s = new Date(startDate + 'T00:00:00');
  const startStr = `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  if (!endDate) return startStr;
  const e = new Date(endDate + 'T00:00:00');
  const endStr = `${MONTHS[e.getMonth()]} ${e.getDate()}`;
  return `${startStr} — ${endStr}`;
}

function getVisaLabel(category: string): string {
  const c = category?.toLowerCase() ?? '';
  if (c.includes('free')) return 'Visa Free';
  if (c.includes('arrival')) return 'On Arrival';
  if (c.includes('evisa') || c.includes('e-visa')) return 'e-Visa';
  if (c.includes('required')) return 'Visa Required';
  return category;
}

/**
 * Map the streamed (LLM) visaCategory vocabulary onto the static resolver's
 * category vocabulary used by the Visa tab. Generation receives the
 * traveler's actual passport(s), so when a streamed value exists it beats
 * the static table (which is not passport-aware yet). 'varies' and unknown
 * values return null → static resolution stays in charge.
 */
function normalizeStreamedVisaCategory(
  raw: string | undefined,
): 'visa-free' | 'visa-on-arrival' | 'evisa' | 'visa-required' | null {
  switch (raw) {
    case 'visa-free':
      return 'visa-free';
    case 'visa-on-arrival':
      return 'visa-on-arrival';
    case 'e-visa':
      return 'evisa';
    case 'embassy':
      return 'visa-required';
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────
// Tab options
// ──────────────────────────────────────────────────────────

type TabKey = 'Overview' | 'Itinerary' | 'Food' | 'Bookings' | 'Visa' | 'Tips';
const TABS: TabKey[] = ['Overview', 'Itinerary', 'Food', 'Bookings', 'Visa', 'Tips'];

// `tabSlideIn` lives in @/utils/tabAnimation — shared with country detail
// and any other tabbed surface that needs the same premium swap feel.

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addBookingRef = useRef<AddBookingSheetRef>(null);
  const bookingDetailRef = useRef<BookingDetailSheetRef>(null);
  const guideSheetRef = useRef<VisaGuideSheetRef>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);

  const { heldVisas, passports } = useVisa();
  const heldVisasSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  const { isAuthenticated } = useConvexAuth();
  const trip = useOfflineQuery(
    api.trips.getTrip,
    isAuthenticated && id ? { id: id as Id<'trips'> } : 'skip',
  );
  const heartbeatMutation = useMutation(api.tripPresence.heartbeat);
  const leaveMutation = useMutation(api.tripPresence.leave);
  const deleteTripMutation = useMutation(api.trips.deleteTrip);
  const undoDeleteTripMutation = useMutation(api.trips.undoDeleteTrip);

  // ── Trip-ready moment ─────────────────────────────────────
  // When generation settles while the user is watching, mark the moment:
  // a success haptic + quiet toast. Only fires on a transition observed in
  // THIS mount — opening an already-planned trip stays silent.
  const wasGeneratingRef = useRef(false);
  const { showToast } = useToast();
  useEffect(() => {
    const status = trip?.status;
    if (!status) return;
    if (wasGeneratingRef.current && status === 'planned') {
      hapticSuccess();
      showToast('success', 'Your trip is ready.');
    }
    wasGeneratingRef.current = status === 'generating';
  }, [trip?.status, showToast]);

  // Look up an existing visa guide for this country so the Visa tab's
  // "Start visa application" button either resumes it or kicks off the
  // VisaGuideSheet generator (mirrors the country/[code] page flow).
  const existingGuide = useQuery(
    api.visaGuides.getGuideByCountry,
    isAuthenticated && trip?.countryCode ? { countryCode: trip.countryCode } : 'skip',
  );

  const handleStartVisaApplication = () => {
    if (existingGuide) {
      router.push(`/guide/${existingGuide._id}` as never);
    } else {
      guideSheetRef.current?.present();
    }
  };

  const handleDelete = () => {
    // Apple Notes / Mail pattern: instant delete with an Undo toast instead
    // of a confirmation dialog. The server soft-deletes and only hard-deletes
    // after a 10s window, so Undo just clears the soft-delete flag.
    hapticImpact();
    // Navigate AWAY first so the live `getTrip` query stops re-running
    // against a record we're about to delete (which would throw "no
    // access" into render and surface as a Render Error).
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as never);
    }
    // Fire-and-forget the delete. The Convex mutation already enforces
    // ownership server-side; a failure here is almost certainly a
    // network issue, which is fine to swallow at this point since the
    // user has already left the screen.
    deleteTripMutation({ id: id as Id<'trips'> }).catch(() => {});
    // 6s toast < 10s server undo window, so Undo always lands while the
    // trip is still only soft-deleted. Past the window the mutation
    // no-ops silently server-side.
    showToast('info', 'Trip deleted', undefined, 6000, {
      label: 'Undo',
      onPress: () => {
        undoDeleteTripMutation({ id: id as Id<'trips'> }).catch(() => {});
      },
    });
  };

  const handleOpenMenu = () => {
    Alert.alert('Trip options', undefined, [
      {
        text: 'Share this trip',
        onPress: () => shareSheetRef.current?.present(),
      },
      {
        text: 'Chat with AI',
        onPress: () => router.push(`/chat/${id}` as never),
      },
      {
        text: 'Edit itinerary',
        onPress: () => router.push(`/trip/${id}/day/0` as never),
      },
      {
        text: 'Invite a travel partner',
        onPress: () => router.push(`/trip/invite?tripId=${id}` as never),
      },
      {
        text: 'Delete trip',
        style: 'destructive',
        onPress: handleDelete,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  // Deep-linkable tabs — `visaatlas://trip/<id>?tab=Food` lands on that tab
  // directly. Lets notifications, chat replies, and cross-screen links point
  // at a specific tab instead of always dropping the user on Overview.
  useEffect(() => {
    if (tab && TABS.includes(tab as TabKey)) setActiveTab(tab as TabKey);
  }, [tab]);
  // Track previous tab so the fade-slide knows which direction to come from.
  const prevTabRef = useRef<TabKey>('Overview');
  const tabDirection = TABS.indexOf(activeTab) >= TABS.indexOf(prevTabRef.current) ? 1 : -1;
  useEffect(() => {
    prevTabRef.current = activeTab;
  }, [activeTab]);
  // The heart toggles `trip.starred` via Convex — no local state. Reads the
  // live value off the trip document so the UI always matches the server.
  const setStarredMutation = useMutation(api.trips.setTripStarred);
  const saved = !!trip?.starred;

  // Presence heartbeat
  useEffect(() => {
    if (!id) return;
    const tripId = id as Id<'trips'>;
    heartbeatMutation({ tripId }).catch(() => {});
    const interval = setInterval(() => {
      heartbeatMutation({ tripId }).catch(() => {});
    }, 30_000);
    return () => {
      clearInterval(interval);
      leaveMutation({ tripId }).catch(() => {});
    };
  }, [id]);

  // ── Parsed data ──────────────────────────────────────────
  const itinerary = useMemo(() => {
    const parsed = safeParse<Array<ItineraryDay | null | undefined>>(
      trip?.itinerary,
      [],
    );
    // Out-of-order per-day patches during streaming can leave transient
    // null holes in the array (the server pads `days[idx] = …` past the
    // end, and a malformed day can be skipped entirely). Filtering is
    // render-safe: day labels come from `day.day`, not array position.
    return Array.isArray(parsed)
      ? parsed.filter((d): d is ItineraryDay => Boolean(d))
      : [];
  }, [trip?.itinerary]);

  // ── Streaming-generation derived state ───────────────────
  // getTabDotIndicators / getCompletedSectionCount / getStreamingDayIndex
  // each used to re-JSON.parse trip.itinerary (a multi-KB string) on every
  // render — 3x per render while streaming. Compute them once per trip-doc
  // change and hand them the already-parsed `itinerary` memo above. Keyed
  // on `trip` (Convex returns a referentially stable doc between updates),
  // which covers every field the helpers read: status, itinerary, the five
  // streamed sections, heroImage, duration, failed/retryingSections.
  const sectionDerived = useMemo<{
    dotIndicators: Record<string, boolean>;
    completedSections: number;
    streamingDayIndex: number | null;
  }>(
    () => ({
      dotIndicators: trip ? getTabDotIndicators(trip, itinerary) : {},
      completedSections: trip ? getCompletedSectionCount(trip, itinerary) : 0,
      streamingDayIndex: trip ? getStreamingDayIndex(trip, itinerary) : null,
    }),
    [trip, itinerary],
  );

  const heroImage = useMemo(
    () =>
      safeParse<{ url: string; credit: string; creditUrl: string } | null>(
        trip?.heroImage,
        null,
      ),
    [trip?.heroImage],
  );

  const dayImages = useMemo(
    () =>
      safeParse<
        Array<{ url: string; thumb: string; credit: string; creditUrl: string } | null>
      >(trip?.dayImages, []),
    [trip?.dayImages],
  );

  const activityImages = useMemo(
    () =>
      safeParse<
        Array<{ url: string; thumb: string; credit: string; source: string } | null>
      >(trip?.activityImages, []),
    [trip?.activityImages],
  );

  const diningGuide = useMemo(
    () => parseDiningGuide(trip?.diningGuide),
    [trip?.diningGuide],
  );

  // Day number → position in the FILTERED itinerary array. The day route
  // resolves its `idx` param against this same filtered array, so chips and
  // links must navigate by filtered position — `day.day - 1` is wrong the
  // moment a null hole was filtered out mid-stream.
  const dayIndexByNumber = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    itinerary.forEach((d, idx) => {
      map[d.day ?? idx + 1] = idx;
    });
    return map;
  }, [itinerary]);

  // ── Derived: NextUpCard data ─────────────────────────────
  const firstActivity = useMemo(() => {
    if (itinerary.length === 0) return null;
    const day0 = itinerary[0];
    return {
      title: day0.morning,
      place: day0.morningPlace,
      imageUri: activityImages[0]?.thumb ?? activityImages[0]?.url ?? undefined,
    };
  }, [itinerary, activityImages]);

  // ── Derived: HighlightsStrip data ───────────────────────
  const highlights = useMemo<HighlightItem[]>(() => {
    if (itinerary.length === 0) return [];
    return itinerary.slice(0, 6).map((day, idx) => {
      // Index images by the authoritative day number, not array position —
      // identical in the steady state (server stamps day = idx + 1), but
      // stays aligned if a null hole was filtered out mid-stream.
      const imgIdx = (day.day ?? idx + 1) - 1;
      return {
        label: day.morning,
        dayStamp: `DAY ${day.day ?? idx + 1}`,
        imageUri: dayImages[imgIdx]?.thumb ?? dayImages[imgIdx]?.url ?? undefined,
        onPress: () => router.push(`/trip/${id}/day/${idx}` as never),
      };
    });
  }, [itinerary, dayImages, id, router]);

  // ── Destination label ────────────────────────────────────
  const destinationLabel = trip
    ? trip.isMultiCountry && trip.routeTitle
      ? trip.routeTitle.split(/\s*→\s*/)[0]
      : trip.countryName ?? 'Destination'
    : 'Destination';

  const cityLabel = trip?.capital ?? destinationLabel;

  // ── Handle booking press ─────────────────────────────────
  function handleBookingPress(data: BookingDetailData) {
    bookingDetailRef.current?.open(data);
  }

  // ── Loading ──────────────────────────────────────────────
  if (trip === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={[Type.body13, { color: colors.inkMute, marginTop: 12 }]}>Loading trip...</Text>
      </View>
    );
  }

  if (trip === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl }]}>
        <Globe color={colors.inkMute} size={40} />
        <Text style={[Type.title15, { color: colors.inkSoft, marginTop: 12 }]}>Trip not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={[Type.body13, { color: colors.ink }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Failed-generation early return ───────────────────────
  // Watchdog/timeout failure surface: full-screen error with Try Again /
  // Delete. Renders BEFORE the normal trip layout to avoid mounting hero,
  // tabs, sheets, etc. against an incomplete trip doc.
  if (trip.status === 'failed') {
    return <TripFailedScreen trip={trip} />;
  }

  const catColor = getVisaCategoryColor(trip.visaCategory, colors);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);

  // ── Streaming-generation derived state ───────────────────
  // dotIndicators / completedSections / streamingDayIndex come from the
  // `sectionDerived` memo above (computed once per trip-doc change against
  // the pre-parsed itinerary).
  const generating = isGenerating(trip);
  const { dotIndicators, completedSections, streamingDayIndex } = sectionDerived;
  const totalSections = getTotalSectionCount();
  const issueCount = (trip.failedSections ?? []).length;

  // ── Render ───────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TopSafeAreaBlur />
      {generating && (
        <TripGenerationStrip
          completed={completedSections}
          total={totalSections}
          issueCount={issueCount}
        />
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* ─── HEADER ─── */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8, paddingHorizontal: 22 },
          ]}
        >
          {/* Left: back */}
          <BackButton />

          {/* Center: italic Fraunces destination + mono date */}
          <View style={styles.headerCenter}>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 17,
                fontWeight: '500',
                letterSpacing: -17 * 0.012,
                color: colors.ink,
              }}
              numberOfLines={1}
            >
              {destinationLabel}
            </Text>
            {dateRange ? (
              <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
                {dateRange}
              </Text>
            ) : null}
          </View>

          {/* Right: collaborator avatars + heart save toggle + 3-dot menu
              (chat / edit / invite / delete). CollabStack renders nothing
              on solo trips, so the header stays unchanged for most users. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CollabStack tripId={trip._id} />
            <CircleBtn
              size={38}
              solid
              onPress={() => {
                if (!trip) return;
                setStarredMutation({
                  id: trip._id as Id<'trips'>,
                  starred: !saved,
                }).catch(() => {});
              }}
              accessibilityLabel={saved ? 'Unstar trip' : 'Star trip'}
            >
              <Heart
                size={17}
                color={colors.coral}
                fill={saved ? colors.coral : 'none'}
              />
            </CircleBtn>
            <CircleBtn
              size={38}
              solid
              onPress={handleOpenMenu}
              accessibilityLabel="Trip options"
            >
              <MoreHorizontal size={18} color={colors.ink} />
            </CircleBtn>
          </View>
        </View>

        {/* ─── SEGMENTED TABS — squiggle variant for trip tabs ─── */}
        <View style={{ paddingHorizontal: 16 }}>
          <SegmentedControl
            options={TABS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabKey)}
            variant="squiggle"
            dotIndicators={dotIndicators}
          />
        </View>

        {/* ─── TAB CONTENT ─── */}

        {/* ── Overview tab ── */}
        {activeTab === 'Overview' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)}>
            {/* Hero card — real card if heroImage is present, shimmer
                placeholder while it streams in, nothing once final state
                is reached without an image. */}
            {trip.heroImage ? (
              <TripOverviewHero
                tripName={trip.routeTitle ?? trip.countryName ?? ''}
                cityName={cityLabel}
                heroImageUrl={heroImage?.url}
                duration={typeof trip.duration === 'number' ? trip.duration : undefined}
              />
            ) : generating ? (
              <TripHeroSkeleton />
            ) : null}

            {/* Next up card (only if itinerary has data) */}
            {firstActivity && (
              <NextUpCard
                title={firstActivity.title}
                meta={firstActivity.place ?? destinationLabel}
                imageUri={firstActivity.imageUri}
                onPress={() => router.push(`/trip/${id}/day/0` as const)}
              />
            )}

            {/* Editorial readout of the user's brief — italic Fraunces with
                coral curly quotes. Renders nothing when userNotes is empty
                so it takes zero space for trips without notes. Sits above
                the day deck so it explains *why* the trip looks the way it
                does before the user sees the day breakdown. */}
            <TripBriefReadout
              notes={trip.userNotes}
              answers={trip.refinementAnswers}
            />

            {/* Highlights strip — driven by itinerary days (the strip maps
                first 6 days to cards). Show skeleton while no days have
                streamed yet; show real strip as soon as Day 1 lands. */}
            {itinerary.length > 0 ? (
              <HighlightsStrip
                items={highlights}
                onSeeAll={() => setActiveTab('Itinerary')}
              />
            ) : generating ? (
              <HighlightsSkeleton />
            ) : null}

            {/* AI chat — opens the conversational tweaker for the itinerary */}
            <Pressable
              onPress={() => router.push(`/chat/${id}` as never)}
              style={({ pressed }) => [
                styles.chatCta,
                {
                  backgroundColor: colors.ink,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.chatCtaIcon, { backgroundColor: colors.coral }]}>
                <MessageSquare size={16} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Type.kickerSm,
                    { color: colors.coral, fontSize: 9, letterSpacing: 9 * 0.18 },
                  ]}
                >
                  AI ASSISTANT
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#FFFFFF',
                    marginTop: 2,
                  }}
                >
                  Tweak this trip
                </Text>
              </View>
              <Text
                style={[
                  Type.body12_5,
                  { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
                ]}
              >
                Chat →
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Itinerary tab ── */}
        {activeTab === 'Itinerary' && (() => {
          // Mirrors the Visa tab's failure surface: if the itinerary stream
          // failed, show a retry card below whatever partial days made it
          // through. With zero days the deck's "No itinerary available"
          // empty state would just duplicate the card's message, so the
          // card stands alone in that case.
          const itineraryFailed = hasFailed(trip, 'itinerary');
          return (
            <Animated.View entering={tabSlideIn(tabDirection * 18)} style={{ paddingTop: 8 }}>
              {(itinerary.length > 0 || !itineraryFailed) && (
                <DayDeck
                  tripId={String(trip._id)}
                  days={itinerary}
                  dayImages={dayImages}
                  tripHeroImage={heroImage}
                  tripStartDate={trip.startDate}
                  destination={trip.countryName}
                  streamingDayIndex={streamingDayIndex}
                  expectedDayCount={trip.duration}
                />
              )}
              {itineraryFailed && (
                <SectionRetryCard
                  tripId={trip._id}
                  section="itinerary"
                  label="itinerary"
                  retrying={isRetrying(trip, 'itinerary')}
                />
              )}
            </Animated.View>
          );
        })()}

        {/* ── Food tab — per-trip dining guide. FoodTab derives its own
            pending / failed / retrying / absent / loaded state from the
            live trip doc via the sectionState helpers. ── */}
        {activeTab === 'Food' && (
          <Animated.View
            entering={tabSlideIn(tabDirection * 18)}
            style={{ paddingHorizontal: 16, paddingTop: 8 }}
          >
            <FoodTab
              tripId={trip._id}
              guide={diningGuide}
              trip={trip}
              countryName={trip.countryName}
              dayIndexByNumber={dayIndexByNumber}
              role={trip._role}
            />
          </Animated.View>
        )}

        {/* ── Bookings tab ── */}
        {activeTab === 'Bookings' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)} style={{ paddingTop: 8, paddingBottom: 20 }}>
            <BookingTimeline
              tripId={String(trip._id)}
              onBookingPress={handleBookingPress}
              onAddBooking={() => addBookingRef.current?.open(String(trip._id))}
            />
          </Animated.View>
        )}

        {/* ── Visa tab — hero card + editorial framing + value cards ── */}
        {activeTab === 'Visa' && (() => {
          // While visa-related streamed sections are still arriving, show
          // a shimmer skeleton instead of the editorial layout. If either
          // visaChecklist or visaNotes failed during generation, surface
          // a retry card so the user can re-run just that slice.
          const visaPending =
            isSectionPending(trip, 'visaChecklist') ||
            isSectionPending(trip, 'visaNotes');
          const visaFailed =
            hasFailed(trip, 'visaChecklist') || hasFailed(trip, 'visaNotes');

          if (visaPending) {
            return (
              <Animated.View
                entering={tabSlideIn(tabDirection * 18)}
                style={styles.visaStub}
              >
                <VisaTabSkeleton />
              </Animated.View>
            );
          }
          if (visaFailed) {
            return (
              <Animated.View
                entering={tabSlideIn(tabDirection * 18)}
                style={styles.visaStub}
              >
                <SectionRetryCard
                  tripId={trip._id}
                  section="visaChecklist"
                  label="visa info"
                  retrying={isRetrying(trip, 'visaChecklist')}
                />
              </Animated.View>
            );
          }

          // Trip docs store the country code in EITHER alpha-2 ('PT') or
          // alpha-3 ('VNM') depending on the creation path, while the
          // static table is keyed alpha-3 — normalize before looking up.
          // (Unnormalized, Portugal's Visa tab rendered completely blank:
          // 'PT' missed the 'PRT' row and the tab returned null.)
          const lookupCode = toAlpha3(trip.countryCode) || trip.countryCode;
          const country = staticVisaData.find((c) => c.code === lookupCode);
          const resolved = country ? resolveCountry(country, heldVisasSet) : null;

          // Status-derived editorial copy. Prefer the streamed category —
          // generation receives the traveler's actual passport(s), while the
          // static table is not passport-aware yet — and fall back to the
          // static resolution for older trips / off-vocabulary values.
          // Never blank the tab: streamed category first, static fallback,
          // and visa-required (the most conservative copy) as a floor for
          // trips whose country code matches nothing.
          const c =
            normalizeStreamedVisaCategory(trip.visaCategory) ??
            resolved?.category ??
            'visa-required';
          const editorial = (() => {
            if (c === 'visa-free' || c === 'home') {
              return {
                headerKicker: 'YOU’RE COVERED',
                headerTitle: 'Set to go',
                checklistTitle: 'Bring with you',
                checklist: [
                  'Passport with 6+ months validity',
                  'Onward or return ticket',
                  'Proof of accommodation',
                ],
                tipKicker: 'TRAVELLER’S TIP',
                tipTitle: 'Pack light',
                tipBody:
                  'No paperwork to chase. Confirm passport validity once and you’re free to fly.',
              };
            }
            if (c === 'visa-on-arrival') {
              return {
                headerKicker: 'PAY AT THE GATE',
                headerTitle: 'Quick stop',
                checklistTitle: 'Bring with you',
                checklist: [
                  'Passport with 6+ months validity',
                  'Visa fee in fresh USD cash',
                  '1–2 passport-size photos',
                  'Return ticket and accommodation proof',
                ],
                tipKicker: 'TRAVELLER’S TIP',
                tipTitle: 'Crisp bills only',
                tipBody:
                  'Visa-on-arrival counters reject torn or marked notes. Get fresh USD before you leave.',
              };
            }
            if (c === 'evisa') {
              return {
                headerKicker: 'APPLY ONLINE',
                headerTitle: 'Apply ahead',
                checklistTitle: 'Bring with you',
                checklist: [
                  'Printed eVisa approval (don’t rely on your phone)',
                  'Passport with 6+ months validity',
                  'Proof of funds and accommodation',
                ],
                tipKicker: 'TRAVELLER’S TIP',
                tipTitle: 'Print, don’t screenshot',
                tipBody:
                  'Some entry desks won’t accept a phone-screen eVisa. Bring a paper copy as a backup.',
              };
            }
            return {
              headerKicker: 'EMBASSY · IN PERSON',
              headerTitle: 'Plan ahead',
              checklistTitle: 'Before you book flights',
              checklist: [
                'Start the embassy application 4–6 weeks ahead',
                'Gather supporting docs (bank, employer, itinerary)',
                'Book biometrics + interview slot',
                'Carry the physical visa with your passport',
              ],
              tipKicker: 'TRAVELLER’S TIP',
              tipTitle: 'Don’t buy refundable',
              tipBody:
                'Hold off on flights until your visa is approved. Embassies sometimes ask for proof of paid bookings only at the very end.',
            };
          })();

          return (
            <Animated.View entering={tabSlideIn(tabDirection * 18)} style={styles.visaStub}>
              {/* Editorial header — mono kicker + italic title with coral period */}
              <View style={{ paddingHorizontal: 4, paddingTop: 6, marginBottom: 14 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 11,
                      fontWeight: '700',
                      color: colors.inkMute,
                      letterSpacing: 11 * 0.22,
                    }}
                  >
                    {editorial.headerKicker} · {trip.countryName.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.display,
                    fontSize: 26,
                    fontWeight: '500',
                    lineHeight: 30,
                    letterSpacing: -26 * 0.022,
                    color: colors.ink,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {editorial.headerTitle}
                  </Text>
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>
                <Squiggle
                  width={64}
                  color={colors.coral}
                  style={{ marginTop: 6 }}
                />
              </View>

              {/* Visa hero card — same streamed-first category as the
                  editorial. Skipped (not the whole tab) when the country is
                  missing from the static table — the editorial header,
                  checklist, and tip above/below carry the essentials. */}
              {country && resolved && (
                <VisaHeroCardForCountry
                  country={country}
                  category={c}
                  days={resolved.days}
                  passports={passports}
                  hasGuide={!!existingGuide}
                  onCreateGuide={handleStartVisaApplication}
                />
              )}

              {/* Apply-by deadline — startDate − (processing + 2-week buffer).
                  Renders only for action-required categories on dated trips
                  whose processing time actually parses (no fake deadlines). */}
              <VisaDeadlineCard
                category={c}
                startDate={trip.startDate}
                processingTime={trip.visaProcessingTime}
                fallbackProcessingTime={country?.processingTime}
              />

              {/* Bring-with-you checklist — checkable rows, progress persisted
                  on the trip doc (checklistProgress, keyed by item text) */}
              <VisaChecklistCard
                tripId={trip._id}
                title={editorial.checklistTitle}
                items={editorial.checklist}
                checkedItems={trip.checklistProgress ?? []}
              />

              {/* Traveller's tip — dark ink editorial card with quote glyph */}
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: colors.ink,
                  borderRadius: 18,
                  padding: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 22,
                      lineHeight: 22,
                      color: colors.coral,
                      marginTop: -4,
                    }}
                  >
                    “
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 10,
                      fontWeight: '700',
                      color: colors.coral,
                      letterSpacing: 10 * 0.22,
                    }}
                  >
                    {editorial.tipKicker}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.display,
                    fontSize: 22,
                    fontWeight: '500',
                    lineHeight: 26,
                    letterSpacing: -22 * 0.022,
                    color: '#FFFFFF',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {editorial.tipTitle}
                  </Text>
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>
                <Text
                  style={{
                    fontFamily: FontFamily.regular,
                    fontSize: 14,
                    lineHeight: 21,
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  {editorial.tipBody}
                </Text>
              </View>

              {/* Country deep-dive link — replaces the plain Visiting row */}
              <Pressable
                onPress={() => router.push(`/country/${trip.countryCode}` as const)}
                style={({ pressed }) => [
                  styles.visitingRow,
                  {
                    marginTop: 12,
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="link"
                accessibilityLabel={`View ${trip.countryName} country page`}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.tealBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Globe size={18} color={colors.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FontFamily.monoMedium,
                      fontSize: 10,
                      fontWeight: '700',
                      color: colors.inkMute,
                      letterSpacing: 10 * 0.22,
                    }}
                  >
                    COUNTRY DEEP-DIVE
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.ink,
                      letterSpacing: -16 * 0.012,
                      marginTop: 2,
                    }}
                  >
                    {trip.countryName}
                    <Text style={{ color: colors.coral }}>.</Text>
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: colors.coral,
                  }}
                >
                  Open →
                </Text>
              </Pressable>
            </Animated.View>
          );
        })()}

        {/* ── Tips tab — shared CountryTipsView (same source as the country
            detail Tips tab so trip + country views stay in lockstep). While
            packing / accommodation tips are streaming, show a shimmer
            skeleton; if they failed, surface a retry card. ── */}
        {/* Tips tab — CountryTipsView handles all three data sources
            internally (static localInfo / Convex cache / skeleton)
            and renders its own loading state, so we just delegate. */}
        {activeTab === 'Tips' && (
          <Animated.View
            entering={tabSlideIn(tabDirection * 18)}
            style={{ paddingHorizontal: 16, paddingTop: 8 }}
          >
            <CountryTipsView
              countryCode={trip.countryCode}
              countryName={trip.countryName}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── Booking sheets ─── */}
      <AddBookingSheet ref={addBookingRef} />
      <BookingDetailSheet
        ref={bookingDetailRef}
        onEdit={(booking) => {
          addBookingRef.current?.openForEdit({
            id: booking.id,
            type: booking.type,
            title: booking.title,
            startDate: booking.startDate,
            endDate: booking.endDate,
            location: booking.location,
            countryCode: booking.countryCode,
            confirmationNumber: booking.confirmationNumber,
            cost: booking.cost,
            currency: booking.currency,
            notes: booking.notes,
            typeDetails: booking.typeDetails,
          });
        }}
      />
      {/* Visa guide generator — opens when the user taps "Start visa
          application" and there's no guide yet. Once created, the sheet's
          callback routes to the new guide page. */}
      {trip?.countryCode ? (
        <VisaGuideSheet
          ref={guideSheetRef}
          countryCode={trip.countryCode}
          countryName={trip.countryName ?? trip.countryCode}
          heldVisas={heldVisasSet}
          onGuideCreated={(guideId) => router.push(`/guide/${guideId}` as never)}
        />
      ) : null}
      {/* Public share-link sheet — opened from the 3-dot menu. For a
          still-generating trip it opens with the toggle disabled and
          explains why instead of erroring. */}
      <ShareTripSheet
        ref={shareSheetRef}
        tripId={id as Id<'trips'>}
        countryName={trip?.countryName ?? ''}
        tripStatus={trip?.status}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  visaStub: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  chatCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
  },
  chatCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
});

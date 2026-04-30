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

// ── Visa guide sheet — same flow used on country/[code] ────
import VisaGuideSheet, { type VisaGuideSheetRef } from '@/components/guides/VisaGuideSheet';
import { useVisa } from '@/contexts/visa-context';
import {
  visaData as staticVisaData,
  resolveCountry,
  type HeldVisaType,
} from '@/data/visaData';
import { VisaHeroCardForCountry } from '@/components/visa/VisaHeroCardForCountry';

// ── Streaming-generation UI: progress strip, skeletons, retry ──
import { TripGenerationStrip } from '@/components/trip/TripGenerationStrip';
import { TripHeroSkeleton } from '@/components/trip/skeletons/TripHeroSkeleton';
import { HighlightsSkeleton } from '@/components/trip/skeletons/HighlightsSkeleton';
import { VisaTabSkeleton } from '@/components/trip/skeletons/VisaTabSkeleton';
import { TipsTabSkeleton } from '@/components/trip/skeletons/TipsTabSkeleton';
import { SectionRetryCard } from '@/components/trip/skeletons/SectionRetryCard';
import { TripFailedScreen } from '@/components/trip/TripFailedScreen';
import {
  isGenerating,
  isSectionPending,
  hasFailed,
  getCompletedSectionCount,
  getTotalSectionCount,
  getTabDotIndicators,
  getStreamingDayIndex,
} from './_helpers/sectionState';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
  heroSubject?: string;
}

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

// ──────────────────────────────────────────────────────────
// Tab options
// ──────────────────────────────────────────────────────────

type TabKey = 'Overview' | 'Itinerary' | 'Bookings' | 'Visa' | 'Tips';
const TABS: TabKey[] = ['Overview', 'Itinerary', 'Bookings', 'Visa', 'Tips'];

// `tabSlideIn` lives in @/utils/tabAnimation — shared with country detail
// and any other tabbed surface that needs the same premium swap feel.

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const addBookingRef = useRef<AddBookingSheetRef>(null);
  const bookingDetailRef = useRef<BookingDetailSheetRef>(null);
  const guideSheetRef = useRef<VisaGuideSheetRef>(null);

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
    Alert.alert(
      'Delete trip',
      `Are you sure you want to delete this trip? This will also delete its bookings, messages, and itinerary. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
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
          },
        },
      ],
    );
  };

  const handleOpenMenu = () => {
    Alert.alert('Trip options', undefined, [
      {
        text: 'Chat with AI',
        onPress: () => router.push(`/chat/${id}` as never),
      },
      {
        text: 'Edit itinerary',
        onPress: () => router.push(`/trip/${id}/day/0` as never),
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
  const itinerary = useMemo(
    () => safeParse<ItineraryDay[]>(trip?.itinerary, []),
    [trip?.itinerary],
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
    return itinerary.slice(0, 6).map((day, idx) => ({
      label: day.morning,
      dayStamp: `DAY ${day.day ?? idx + 1}`,
      imageUri: dayImages[idx]?.thumb ?? dayImages[idx]?.url ?? undefined,
      onPress: () => router.push(`/trip/${id}/day/${idx}` as never),
    }));
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
  const generating = isGenerating(trip);
  const dotIndicators = getTabDotIndicators(trip);
  const completedSections = getCompletedSectionCount(trip);
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

          {/* Right: heart save toggle + 3-dot menu (chat / edit / delete) */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
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
        {activeTab === 'Itinerary' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)} style={{ paddingTop: 8 }}>
            <DayDeck
              tripId={String(trip._id)}
              days={itinerary}
              dayImages={dayImages}
              tripHeroImage={heroImage}
              tripStartDate={trip.startDate}
              destination={trip.countryName}
              streamingDayIndex={getStreamingDayIndex(trip)}
              expectedDayCount={trip.duration}
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
                />
              </Animated.View>
            );
          }

          const country = staticVisaData.find((c) => c.code === trip.countryCode);
          if (!country) return null;
          const resolved = resolveCountry(country, heldVisasSet);

          // Status-derived editorial copy.
          const c = resolved.category;
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

              {/* Visa hero card */}
              <VisaHeroCardForCountry
                country={country}
                category={resolved.category}
                days={resolved.days}
                passports={passports}
                hasGuide={!!existingGuide}
                onCreateGuide={handleStartVisaApplication}
              />

              {/* Bring-with-you checklist — paper card, coral check bullets */}
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.line,
                  padding: 18,
                }}
              >
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
                      fontSize: 10,
                      fontWeight: '700',
                      color: colors.inkMute,
                      letterSpacing: 10 * 0.22,
                    }}
                  >
                    PRE-FLIGHT CHECKLIST
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.display,
                    fontSize: 22,
                    fontWeight: '500',
                    lineHeight: 26,
                    letterSpacing: -22 * 0.022,
                    color: colors.ink,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {editorial.checklistTitle}
                  </Text>
                  <Text style={{ color: colors.coral }}>.</Text>
                </Text>
                <View style={{ gap: 10 }}>
                  {editorial.checklist.map((item) => (
                    <View
                      key={item}
                      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: colors.coralBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: colors.coralDeep,
                          }}
                        />
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: FontFamily.regular,
                          fontSize: 14,
                          lineHeight: 21,
                          color: colors.inkSoft,
                        }}
                      >
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

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
        {activeTab === 'Tips' && (() => {
          const tipsPending =
            isSectionPending(trip, 'packingSuggestions') ||
            isSectionPending(trip, 'accommodationTips');
          const tipsFailed =
            hasFailed(trip, 'packingSuggestions') ||
            hasFailed(trip, 'accommodationTips');

          if (tipsPending) {
            return (
              <Animated.View
                entering={tabSlideIn(tabDirection * 18)}
                style={{ paddingHorizontal: 16, paddingTop: 8 }}
              >
                <TipsTabSkeleton />
              </Animated.View>
            );
          }
          if (tipsFailed) {
            return (
              <Animated.View
                entering={tabSlideIn(tabDirection * 18)}
                style={{ paddingHorizontal: 16, paddingTop: 8 }}
              >
                <SectionRetryCard
                  tripId={trip._id}
                  section="packingSuggestions"
                  label="tips"
                />
              </Animated.View>
            );
          }

          return (
            <Animated.View
              entering={tabSlideIn(tabDirection * 18)}
              style={{ paddingHorizontal: 16, paddingTop: 8 }}
            >
              <CountryTipsView
                countryCode={trip.countryCode}
                countryName={trip.countryName}
              />
            </Animated.View>
          );
        })()}
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

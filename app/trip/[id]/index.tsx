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
import { useQuery, useMutation } from 'convex/react';
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

// ── Trip Overview components ───────────────────────────────
import { TripOverviewHero } from '@/components/trip/overview/TripOverviewHero';
import { NextUpCard } from '@/components/trip/overview/NextUpCard';
import { HighlightsStrip, type HighlightItem } from '@/components/trip/overview/HighlightsStrip';

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

type TabKey = 'Overview' | 'Itinerary' | 'Bookings' | 'Visa';
const TABS: TabKey[] = ['Overview', 'Itinerary', 'Bookings', 'Visa'];

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

  const trip = useOfflineQuery(api.trips.getTrip, { id: id as Id<'trips'> });
  const heartbeatMutation = useMutation(api.tripPresence.heartbeat);
  const leaveMutation = useMutation(api.tripPresence.leave);
  const deleteTripMutation = useMutation(api.trips.deleteTrip);

  // Look up an existing visa guide for this country so the Visa tab's
  // "Start visa application" button either resumes it or kicks off the
  // VisaGuideSheet generator (mirrors the country/[code] page flow).
  const existingGuide = useQuery(
    api.visaGuides.getGuideByCountry,
    trip?.countryCode ? { countryCode: trip.countryCode } : 'skip',
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
    if (itinerary.length === 0) {
      // Stub fallback
      return [
        { label: 'Kyoto temples', dayStamp: 'DAY 2', tone: 'sunset' },
        { label: 'Ramen tour', dayStamp: 'DAY 3', tone: 'forest' },
        { label: 'Mt. Fuji', dayStamp: 'DAY 5', tone: 'mountain' },
      ];
    }
    return itinerary.slice(0, 6).map((day, idx) => ({
      label: day.morning,
      dayStamp: `DAY ${day.day}`,
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

  const catColor = getVisaCategoryColor(trip.visaCategory, colors);
  const dateRange = formatDateRange(trip.startDate, trip.endDate);

  // ── Render ───────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TopSafeAreaBlur />
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
          />
        </View>

        {/* ─── TAB CONTENT ─── */}

        {/* ── Overview tab ── */}
        {activeTab === 'Overview' && (
          <Animated.View entering={tabSlideIn(tabDirection * 18)}>
            {/* Hero card */}
            <TripOverviewHero
              tripName={trip.routeTitle ?? trip.countryName ?? ''}
              cityName={cityLabel}
              heroImageUrl={heroImage?.url}
              duration={typeof trip.duration === 'number' ? trip.duration : undefined}
            />

            {/* Next up card (only if itinerary has data) */}
            {firstActivity && (
              <NextUpCard
                title={firstActivity.title}
                meta={firstActivity.place ?? destinationLabel}
                imageUri={firstActivity.imageUri}
                onPress={() => router.push(`/trip/${id}/day/0` as const)}
              />
            )}

            {/* Highlights strip */}
            <HighlightsStrip
              items={highlights}
              onSeeAll={() => setActiveTab('Itinerary')}
            />

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

        {/* ── Visa tab — same hero card used on country detail ── */}
        {activeTab === 'Visa' && (() => {
          const country = staticVisaData.find((c) => c.code === trip.countryCode);
          if (!country) return null;
          const resolved = resolveCountry(country, heldVisasSet);

          return (
            <Animated.View entering={tabSlideIn(tabDirection * 18)} style={styles.visaStub}>
              <VisaHeroCardForCountry
                country={country}
                category={resolved.category}
                days={resolved.days}
                passports={passports}
                hasGuide={!!existingGuide}
                onCreateGuide={handleStartVisaApplication}
              />

              {/* "Visiting" row — flag + italic country name. Tap to drill into country detail. */}
              <Pressable
                onPress={() => router.push(`/country/${trip.countryCode}` as const)}
                style={({ pressed }) => [
                  styles.visitingRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Globe size={20} color={colors.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.body13, { color: colors.inkMute, fontSize: 12 }]}>
                    Visiting
                  </Text>
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.ink,
                      letterSpacing: -16 * 0.012,
                      marginTop: 1,
                    }}
                  >
                    {trip.countryName}
                  </Text>
                </View>
              </Pressable>
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

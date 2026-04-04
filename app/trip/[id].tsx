import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { CollaboratorAvatars } from '@/components/CollaboratorAvatars';
import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  Wallet,
  Plane,
  Sun,
  Moon,
  Coffee,
  Lightbulb,
  Shield,
  Phone,
  Wifi,
  Droplets,
  Plug,
  CreditCard,
  Shirt,
  Smartphone,
  Package,
  Compass,
  Star,
  Bed,
  BarChart3,
  ClipboardList,
  Car,
  Check,
  AlertCircle,
  Info,
  UserPlus,
  MessageCircle,
  MoreHorizontal,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadows,
  getVisaCategoryColor,
} from '@/constants/theme';
import TripBookingsTimeline from '@/components/booking/TripBookingsTimeline';
import AddBookingSheet, { type AddBookingSheetRef } from '@/components/booking/AddBookingSheet';
import BookingDetailSheet, { type BookingDetailSheetRef, type BookingDetailData } from '@/components/booking/BookingDetailSheet';
import SegmentedControl from '@/components/ui/SegmentedControl';

// ─── Types ──────────────────────────────────────────
interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
  tip: string;
}
interface BudgetBreakdown {
  accommodation: string;
  food: string;
  transport: string;
  activities: string;
  totalPerDay: string;
  totalTrip: string;
  flightEstimate: string;
}
interface PackingSuggestions {
  essentials: string[];
  clothing: string[];
  tech: string[];
  regionSpecific: string[];
}
interface VisaChecklistItem {
  status: 'done' | 'action' | 'info';
  label: string;
  detail?: string;
}
interface AccommodationTips {
  areas: string[];
  budgetOption: string;
  midRange: string;
  luxury: string;
}
interface LocalEssentials {
  emergencyNumber: string;
  policeNumber: string;
  ambulanceNumber: string;
  ukEmbassy: string;
  nearestHospital: string;
}
interface SeasonalPeriod {
  months: string;
  note: string;
}
interface SeasonalGuide {
  bestWeather: SeasonalPeriod;
  bestValue: SeasonalPeriod;
  fewestCrowds: SeasonalPeriod;
  festivals: SeasonalPeriod;
  sweetSpot: string;
  avoid: string;
}
interface CarRentalCompany {
  name: string;
  url: string;
  notes: string;
}
interface CarRental {
  recommended: boolean;
  summary: string;
  companies: CarRentalCompany[];
  idpRequired: boolean;
  drivingSide: 'left' | 'right';
  roadConditions: string;
  fuelCost: string;
  insurance: string;
  tolls: string;
  parkingTips: string;
  tips: string[];
}

type Tab = 'overview' | 'itinerary' | 'logistics';

// ─── Helpers ────────────────────────────────────────
function safeParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function getVisaLabel(category: string): string {
  const c = category?.toLowerCase() ?? '';
  if (c.includes('free')) return 'Visa Free';
  if (c.includes('arrival')) return 'On Arrival';
  if (c.includes('evisa') || c.includes('e-visa')) return 'e-Visa';
  if (c.includes('required')) return 'Visa Required';
  return category;
}

// ─── Main Component ─────────────────────────────────
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const addBookingRef = useRef<AddBookingSheetRef>(null);
  const bookingDetailRef = useRef<BookingDetailSheetRef>(null);

  const trip = useOfflineQuery(api.trips.getTrip, { id: id as Id<'trips'> });
  const collaborators = useQuery(api.trips.getCollaborators, id ? { tripId: id as Id<'trips'> } : 'skip');
  const presenceUsers = useQuery(api.tripPresence.getPresence, id ? { tripId: id as Id<'trips'> } : 'skip');
  const heartbeatMutation = useMutation(api.tripPresence.heartbeat);
  const leaveMutation = useMutation(api.tripPresence.leave);

  const [activeTab, setActiveTab] = useState<Tab>('overview');

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

  // Parsed data
  const itinerary = useMemo(
    () => safeParse<ItineraryDay[]>(trip?.itinerary, []),
    [trip?.itinerary],
  );
  const budget = useMemo(
    () => safeParse<BudgetBreakdown>(trip?.budgetBreakdown, {} as BudgetBreakdown),
    [trip?.budgetBreakdown],
  );
  const packing = useMemo(
    () =>
      safeParse<PackingSuggestions>(trip?.packingSuggestions, {
        essentials: [],
        clothing: [],
        tech: [],
        regionSpecific: [],
      }),
    [trip?.packingSuggestions],
  );
  const visaChecklist = useMemo(
    () => safeParse<VisaChecklistItem[]>(trip?.visaChecklist, []),
    [trip?.visaChecklist],
  );
  const highlights = useMemo(
    () => safeParse<string[]>(trip?.highlights, []),
    [trip?.highlights],
  );
  const accommodation = useMemo(
    () =>
      safeParse<AccommodationTips>(trip?.accommodationTips, {
        areas: [],
        budgetOption: '',
        midRange: '',
        luxury: '',
      }),
    [trip?.accommodationTips],
  );
  const localEssentials = useMemo(
    () => safeParse<LocalEssentials | null>(trip?.localEssentials, null),
    [trip?.localEssentials],
  );
  const seasonalGuide = useMemo(
    () => safeParse<SeasonalGuide | null>(trip?.seasonalGuide, null),
    [trip?.seasonalGuide],
  );
  const carRental = useMemo(
    () => safeParse<CarRental | null>(trip?.carRental, null),
    [trip?.carRental],
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

  // ─── Loading ──────────────────
  if (trip === undefined) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading trip...
        </Text>
      </View>
    );
  }

  // ─── Not found ────────────────
  if (trip === null) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background, paddingTop: insets.top + Spacing.xl },
        ]}
      >
        <Globe color={colors.textMuted} size={40} />
        <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
          Trip not found
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catColor = getVisaCategoryColor(trip.visaCategory, colors);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Compass color={activeTab === 'overview' ? colors.primary : colors.textMuted} size={14} /> },
    { key: 'itinerary', label: 'Itinerary', icon: <Calendar color={activeTab === 'itinerary' ? colors.primary : colors.textMuted} size={14} /> },
    { key: 'logistics', label: 'Logistics', icon: <ClipboardList color={activeTab === 'logistics' ? colors.primary : colors.textMuted} size={14} /> },
  ];

  // ─── Render ───────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ─── HERO ─── */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {heroImage?.url && (
            <Image
              source={{ uri: heroImage.url }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: heroImage?.url
                  ? 'rgba(0,0,0,0.45)'
                  : colors.surface,
              },
            ]}
          />

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn]}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <ArrowLeft color={colors.foreground} size={20} />
          </TouchableOpacity>

          {/* Hero content */}
          <View style={styles.heroContent}>
            <Text
              style={[
                styles.heroTitle,
                { color: heroImage?.url ? '#fff' : colors.foreground },
              ]}
            >
              {trip.isMultiCountry && trip.routeTitle
                ? trip.routeTitle.split(/\s*→\s*/)[0]
                : trip.countryName}
            </Text>
            {trip.isMultiCountry && trip.routeTitle && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {trip.routeTitle.split(/\s*→\s*/).map((country: string, idx: number) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowLeft color="#fff" size={10} style={{ transform: [{ rotate: '180deg' }] }} />
                      </View>
                    )}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontFamily: FontFamily.condensedSemibold, fontSize: 12, color: '#fff' }}>{country}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
            <Text
              style={[
                styles.heroSubtitle,
                { color: heroImage?.url ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
              ]}
            >
              {trip.isMultiCountry ? 'Multi-country route' : `${trip.region} \u00B7 ${trip.capital}`}
            </Text>

            {/* Hero badges */}
            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Clock color="#fff" size={12} />
                <Text style={styles.heroBadgeText}>{trip.duration} days</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Globe color="#fff" size={12} />
                <Text style={styles.heroBadgeText}>{getVisaLabel(trip.visaCategory)}</Text>
              </View>
              {trip.startDate && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Calendar color="#fff" size={12} />
                  <Text style={styles.heroBadgeText}>
                    {new Date(trip.startDate + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {trip.endDate
                      ? ` \u2013 ${new Date(trip.endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </Text>
                </View>
              )}
            </View>

            {collaborators && collaborators.length > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <CollaboratorAvatars
                  collaborators={collaborators}
                  presenceUsers={presenceUsers ?? []}
                />
                <TouchableOpacity onPress={() => router.push(`/trip/invite?tripId=${id}`)}>
                  <UserPlus size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ─── TAB BAR ─── */}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <SegmentedControl
            tabs={tabs.map((t) => t.label.toUpperCase())}
            activeIndex={tabs.findIndex((t) => t.key === activeTab)}
            onTabPress={(index) => setActiveTab(tabs[index].key)}
          />
        </View>

        {/* ─── TAB CONTENT ─── */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <OverviewContent
              trip={trip}
              highlights={highlights}
              seasonalGuide={seasonalGuide}
              colors={colors}
              catColor={catColor}
              tripId={trip._id}
              onAddBooking={() => addBookingRef.current?.open(trip._id)}
              onBookingPress={(raw) => {
                const booking = raw as Record<string, unknown>;
                let typeDetails: Record<string, string> | undefined;
                if (booking.typeDetails && typeof booking.typeDetails === 'object') {
                  typeDetails = booking.typeDetails as Record<string, string>;
                }
                const data: BookingDetailData = {
                  id: booking._id as string,
                  type: booking.type as BookingDetailData['type'],
                  title: booking.title as string,
                  startDate: booking.startDate as string,
                  endDate: booking.endDate as string | undefined,
                  location: booking.location as string | undefined,
                  provider: booking.provider as string | undefined,
                  status: booking.status as BookingDetailData['status'],
                  confirmationNumber: booking.confirmationNumber as string | undefined,
                  cost: booking.cost as number | undefined,
                  currency: booking.currency as string | undefined,
                  notes: booking.notes as string | undefined,
                  tripId: booking.tripId as string | undefined,
                  typeDetails,
                };
                bookingDetailRef.current?.open(data);
              }}
            />
          )}
          {activeTab === 'itinerary' && (
            <ItineraryContent
              itinerary={itinerary}
              dayImages={dayImages}
              colors={colors}
            />
          )}
          {activeTab === 'logistics' && (
            <LogisticsContent
              trip={trip}
              budget={budget}
              packing={packing}
              visaChecklist={visaChecklist}
              carRental={carRental}
              accommodation={accommodation}
              localEssentials={localEssentials}
              colors={colors}
            />
          )}
        </View>
      </ScrollView>

      {/* ─── Floating action bar ─── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.actionBarBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push(`/chat/${id}`)}
          activeOpacity={0.8}
        >
          <MessageCircle size={20} color={colors.primary} />
          <Text style={[styles.actionBarLabel, { color: colors.foreground }]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBarBtn, { backgroundColor: colors.card }]}
          onPress={() => router.push(`/trip/invite?tripId=${id}`)}
          activeOpacity={0.8}
        >
          <UserPlus size={20} color={colors.accent} />
          <Text style={[styles.actionBarLabel, { color: colors.foreground }]}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBarBtn, { backgroundColor: colors.card }]}
          onPress={() => {
            Alert.alert(
              trip.countryName,
              undefined,
              [
                {
                  text: trip.status === 'planned' ? 'Mark as Done' : 'Mark as Planned',
                  onPress: () => {
                    // Status toggle would go here via mutation
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          }}
          activeOpacity={0.8}
        >
          <MoreHorizontal size={20} color={colors.textSecondary} />
          <Text style={[styles.actionBarLabel, { color: colors.foreground }]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Booking sheets */}
      <AddBookingSheet ref={addBookingRef} />
      <BookingDetailSheet ref={bookingDetailRef} />
    </View>
  );
}

// =====================================================================
// OVERVIEW TAB
// =====================================================================
function OverviewContent({
  trip,
  highlights,
  seasonalGuide,
  colors,
  catColor,
  tripId,
  onAddBooking,
  onBookingPress,
}: {
  trip: { visaCategory: string; currency: string; language: string; timezone: string; capital: string; dailyBudget: string; _id: string; [key: string]: unknown };
  highlights: string[];
  seasonalGuide: SeasonalGuide | null;
  colors: Record<string, string>;
  catColor: string;
  tripId: string;
  onAddBooking: () => void;
  onBookingPress: (booking: unknown) => void;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Highlights */}
      {highlights.length > 0 && (
        <SectionCard title="Highlights" icon={<Star color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.secondary}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <Text style={[styles.highlightBullet, { color: 'rgba(255,255,255,0.80)' }]}>{'\u2022'}</Text>
              <Text style={[styles.highlightText, { color: '#FFFFFF' }]}>{h}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Bookings Timeline */}
      <TripBookingsTimeline
        tripId={tripId}
        onBookingPress={onBookingPress}
        onAddBooking={onAddBooking}
      />

      {/* Seasonal Guide */}
      {seasonalGuide && (
        <SectionCard title="Best Time to Visit" icon={<Sun color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.accent}>
          <View style={{ gap: 10 }}>
            {[
              { label: 'Best Weather', data: seasonalGuide.bestWeather, color: colors.primary },
              { label: 'Best Value', data: seasonalGuide.bestValue, color: colors.secondary },
              { label: 'Fewest Crowds', data: seasonalGuide.fewestCrowds, color: colors.accent },
              { label: 'Festivals', data: seasonalGuide.festivals, color: colors.danger },
            ].map((item) => (
              <View key={item.label} style={[styles.seasonRow, { borderLeftColor: 'rgba(255,255,255,0.40)' }]}>
                <Text style={[styles.seasonLabel, { color: 'rgba(255,255,255,0.80)' }]}>{item.label}</Text>
                <Text style={[styles.seasonMonths, { color: '#FFFFFF' }]}>
                  {item.data.months}
                </Text>
                <Text style={[styles.seasonNote, { color: 'rgba(255,255,255,0.70)' }]}>
                  {item.data.note}
                </Text>
              </View>
            ))}
          </View>
          {seasonalGuide.sweetSpot ? (
            <View style={[styles.sweetSpot, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.20)' }]}>
              <Text style={[styles.sweetSpotLabel, { color: 'rgba(255,255,255,0.80)' }]}>Sweet Spot</Text>
              <Text style={[styles.sweetSpotText, { color: '#FFFFFF' }]}>
                {seasonalGuide.sweetSpot}
              </Text>
            </View>
          ) : null}
        </SectionCard>
      )}

      {/* Quick Stats */}
      <SectionCard title="Quick Stats" icon={<Info color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.info}>
        <View style={styles.statsGrid}>
          <StatItem label="Visa" value={getVisaLabel(trip.visaCategory)} color={catColor} colors={colors} />
          <StatItem label="Currency" value={trip.currency} color={colors.secondary} colors={colors} />
          <StatItem label="Language" value={trip.language} color={colors.accent} colors={colors} />
          <StatItem label="Timezone" value={trip.timezone} color={colors.warning} colors={colors} />
          <StatItem label="Capital" value={trip.capital} color={'#D95E8A'} colors={colors} />
          <StatItem label="Budget" value={trip.dailyBudget} color={colors.secondary} colors={colors} />
        </View>
      </SectionCard>
    </View>
  );
}

function StatItem({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <View style={[styles.statItem, { backgroundColor: color }]}>
      <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.70)' }]}>{label}</Text>
      <Text style={[styles.statValue, { color: '#FFFFFF' }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// =====================================================================
// ITINERARY TAB
// =====================================================================
function ItineraryContent({
  itinerary,
  dayImages,
  colors,
}: {
  itinerary: ItineraryDay[];
  dayImages: Array<{ url: string; thumb: string; credit: string; creditUrl: string } | null>;
  colors: any;
}) {
  if (itinerary.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Calendar color={colors.textMuted} size={32} />
        <Text style={[styles.emptyTabText, { color: colors.textMuted }]}>
          No itinerary available
        </Text>
      </View>
    );
  }

  const dayColors = [colors.primary, colors.secondary, colors.accent, '#D95E8A', colors.warning, colors.info, '#8B5CF6'];

  return (
    <View style={{ gap: Spacing.md }}>
      {itinerary.map((day, idx) => {
        const img = dayImages[idx];
        const dayAccent = dayColors[idx % dayColors.length];
        return (
          <View
            key={day.day}
            style={[styles.dayCard, Shadows.card, { backgroundColor: dayAccent, borderColor: 'transparent' }]}
          >
            {/* Day image */}
            {img?.url && (
              <Image
                source={{ uri: img.thumb || img.url }}
                style={styles.dayImage}
                resizeMode="cover"
              />
            )}

            {/* Day header */}
            <View style={styles.dayHeader}>
              <View style={[styles.dayBadge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
                <Text style={[styles.dayBadgeText, { color: '#FFFFFF' }]}>
                  Day {day.day}
                </Text>
              </View>
              <Text style={[styles.dayTitle, { color: '#FFFFFF' }]} numberOfLines={2}>
                {day.title}
              </Text>
            </View>

            {/* Time slots */}
            <View style={styles.timeSlots}>
              <TimeSlot
                icon={<Coffee color="rgba(255,255,255,0.80)" size={14} />}
                label="Morning"
                text={day.morning}
                colors={colors}
                labelColor="rgba(255,255,255,0.80)"
              />
              <TimeSlot
                icon={<Sun color="rgba(255,255,255,0.80)" size={14} />}
                label="Afternoon"
                text={day.afternoon}
                colors={colors}
                labelColor="rgba(255,255,255,0.80)"
              />
              <TimeSlot
                icon={<Moon color="rgba(255,255,255,0.80)" size={14} />}
                label="Evening"
                text={day.evening}
                colors={colors}
                labelColor="rgba(255,255,255,0.80)"
              />
            </View>

            {/* Tip */}
            {day.tip ? (
              <View style={[styles.tipRow, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Lightbulb color="#FFFFFF" size={13} />
                <Text style={[styles.tipText, { color: '#FFFFFF' }]}>{day.tip}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function TimeSlot({
  icon,
  label,
  text,
  colors,
  labelColor,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  colors: any;
  labelColor?: string;
}) {
  if (!text) return null;
  return (
    <View style={styles.timeSlot}>
      <View style={styles.timeSlotHeader}>
        {icon}
        <Text style={[styles.timeSlotLabel, { color: 'rgba(255,255,255,0.80)' }]}>{label}</Text>
      </View>
      <Text style={[styles.timeSlotText, { color: '#FFFFFF' }]}>{text}</Text>
    </View>
  );
}

// =====================================================================
// LOGISTICS TAB
// =====================================================================
function LogisticsContent({
  trip,
  budget,
  packing,
  visaChecklist,
  carRental,
  accommodation,
  localEssentials,
  colors,
}: {
  trip: any;
  budget: BudgetBreakdown;
  packing: PackingSuggestions;
  visaChecklist: VisaChecklistItem[];
  carRental: CarRental | null;
  accommodation: AccommodationTips;
  localEssentials: LocalEssentials | null;
  colors: any;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Budget Breakdown */}
      {budget.totalPerDay && (
        <SectionCard title="Budget Breakdown" icon={<BarChart3 color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.secondary}>
          <View style={{ gap: 8 }}>
            {[
              { label: 'Accommodation', value: budget.accommodation },
              { label: 'Food', value: budget.food },
              ...(!budget.transport || typeof budget.transport === 'string'
                ? [{ label: 'Transport', value: budget.transport }]
                : []),
              { label: 'Activities', value: budget.activities },
            ].filter((item) => typeof item.value === 'string' && item.value).map((item) => (
              <View key={item.label} style={styles.budgetRow}>
                <Text style={[styles.budgetLabel, { color: 'rgba(255,255,255,0.70)' }]}>{item.label}</Text>
                <Text style={[styles.budgetValue, { color: '#FFFFFF' }]}>{item.value}</Text>
              </View>
            ))}
            {/* Multi-country transport legs */}
            {typeof budget.transport === 'object' && Array.isArray(budget.transport) && (
              <View style={{ gap: 4 }}>
                <Text style={[styles.budgetLabel, { color: 'rgba(255,255,255,0.70)', marginBottom: 2 }]}>Transport</Text>
                {(budget.transport as any[]).map((leg: any, i: number) => (
                  <View key={i} style={[styles.budgetRow, { paddingLeft: 8 }]}>
                    <Text style={[styles.budgetValue, { color: 'rgba(255,255,255,0.85)', flex: 1 }]} numberOfLines={1}>
                      {leg.from} → {leg.to}
                    </Text>
                    <Text style={[styles.budgetValue, { color: '#FFFFFF' }]}>{leg.cost}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.budgetDivider, { backgroundColor: 'rgba(255,255,255,0.20)' }]} />
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetTotalLabel, { color: 'rgba(255,255,255,0.80)' }]}>Per Day</Text>
              <Text style={[styles.budgetTotalValue, { color: '#FFFFFF' }]}>
                {budget.totalPerDay}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetTotalLabel, { color: '#FFFFFF' }]}>Total Trip</Text>
              <Text style={[styles.budgetTotalValue, { color: '#FFFFFF' }]}>
                {budget.totalTrip}
              </Text>
            </View>
            {budget.flightEstimate ? (
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetLabel, { color: 'rgba(255,255,255,0.60)' }]}>
                  Flights (est.)
                </Text>
                <Text style={[styles.budgetValue, { color: 'rgba(255,255,255,0.60)' }]}>
                  {budget.flightEstimate}
                </Text>
              </View>
            ) : null}
          </View>
        </SectionCard>
      )}

      {/* Visa Checklist */}
      {visaChecklist.length > 0 && (
        <SectionCard title="Visa Checklist" icon={<Shield color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.primary}>
          <View style={{ gap: 8 }}>
            {visaChecklist.map((item, i) => (
              <View key={i} style={styles.checklistRow}>
                <View
                  style={[
                    styles.checklistIcon,
                    {
                      backgroundColor: 'rgba(255,255,255,0.20)',
                    },
                  ]}
                >
                  {item.status === 'done' ? (
                    <Check color="#FFFFFF" size={12} />
                  ) : item.status === 'action' ? (
                    <AlertCircle color="#FFFFFF" size={12} />
                  ) : (
                    <Info color="#FFFFFF" size={12} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checklistLabel, { color: '#FFFFFF' }]}>
                    {item.label}
                  </Text>
                  {item.detail ? (
                    <Text style={[styles.checklistDetail, { color: 'rgba(255,255,255,0.60)' }]}>
                      {item.detail}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </SectionCard>
      )}

      {/* Packing Suggestions */}
      {(packing.essentials.length > 0 ||
        packing.clothing.length > 0 ||
        packing.tech.length > 0 ||
        packing.regionSpecific.length > 0) && (
        <SectionCard title="Packing List" icon={<Package color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.accent}>
          <View style={{ gap: Spacing.md }}>
            <PackingCategory
              label="Essentials"
              icon={<Package color="rgba(255,255,255,0.80)" size={13} />}
              items={packing.essentials}
              colors={colors}
              tintColor={colors.primary}
            />
            <PackingCategory
              label="Clothing"
              icon={<Shirt color="rgba(255,255,255,0.80)" size={13} />}
              items={packing.clothing}
              colors={colors}
              tintColor={colors.secondary}
            />
            <PackingCategory
              label="Tech"
              icon={<Smartphone color="rgba(255,255,255,0.80)" size={13} />}
              items={packing.tech}
              colors={colors}
              tintColor={colors.accent}
            />
            <PackingCategory
              label="Region Specific"
              icon={<Compass color="rgba(255,255,255,0.80)" size={13} />}
              items={packing.regionSpecific}
              colors={colors}
              tintColor={colors.danger}
            />
          </View>
        </SectionCard>
      )}

      {/* Car Rental */}
      {carRental && (
        <SectionCard title="Car Rental" icon={<Car color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.info}>
          <Text style={[styles.carSummary, { color: '#FFFFFF' }]}>
            {carRental.summary}
          </Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            <InfoRow label="Driving Side" value={carRental.drivingSide} colors={colors} />
            <InfoRow label="IDP Required" value={carRental.idpRequired ? 'Yes' : 'No'} colors={colors} />
            <InfoRow label="Road Conditions" value={carRental.roadConditions} colors={colors} />
            <InfoRow label="Fuel Cost" value={carRental.fuelCost} colors={colors} />
            <InfoRow label="Insurance" value={carRental.insurance} colors={colors} />
            <InfoRow label="Parking" value={carRental.parkingTips} colors={colors} />
          </View>
          {carRental.tips.length > 0 && (
            <View style={{ marginTop: 12, gap: 4 }}>
              <Text style={[styles.packingCatLabel, { color: '#FFFFFF' }]}>
                Driving Tips
              </Text>
              {carRental.tips.map((tip, i) => (
                <View key={i} style={styles.highlightRow}>
                  <Text style={[styles.highlightBullet, { color: 'rgba(255,255,255,0.80)' }]}>{'\u2022'}</Text>
                  <Text style={[styles.packingItem, { color: 'rgba(255,255,255,0.70)' }]}>{tip}</Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      )}

      {/* Accommodation */}
      {(accommodation.areas.length > 0 || accommodation.budgetOption) && (
        <SectionCard title="Accommodation" icon={<Bed color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.primary}>
          {accommodation.areas.length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <Text style={[styles.packingCatLabel, { color: '#FFFFFF' }]}>
                Best Areas to Stay
              </Text>
              {accommodation.areas.map((area, i) => (
                <View key={i} style={styles.highlightRow}>
                  <Text style={[styles.highlightBullet, { color: 'rgba(255,255,255,0.80)' }]}>{'\u2022'}</Text>
                  <Text style={[styles.packingItem, { color: 'rgba(255,255,255,0.70)' }]}>{area}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ gap: 6 }}>
            {accommodation.budgetOption ? (
              <InfoRow label="Budget" value={accommodation.budgetOption} colors={colors} />
            ) : null}
            {accommodation.midRange ? (
              <InfoRow label="Mid-Range" value={accommodation.midRange} colors={colors} />
            ) : null}
            {accommodation.luxury ? (
              <InfoRow label="Luxury" value={accommodation.luxury} colors={colors} />
            ) : null}
          </View>
        </SectionCard>
      )}

      {/* Local Essentials */}
      {localEssentials && (
        <SectionCard title="Emergency Info" icon={<Phone color="#FFFFFF" size={15} />} colors={colors} tintColor={colors.danger}>
          <View style={{ gap: 6 }}>
            <InfoRow label="Emergency" value={localEssentials.emergencyNumber} colors={colors} />
            <InfoRow label="Police" value={localEssentials.policeNumber} colors={colors} />
            <InfoRow label="Ambulance" value={localEssentials.ambulanceNumber} colors={colors} />
            <InfoRow label="UK Embassy" value={localEssentials.ukEmbassy} colors={colors} />
            <InfoRow label="Hospital" value={localEssentials.nearestHospital} colors={colors} />
          </View>
        </SectionCard>
      )}
    </View>
  );
}

function PackingCategory({
  label,
  icon,
  items,
  colors,
  tintColor,
}: {
  label: string;
  icon: React.ReactNode;
  items: string[];
  colors: any;
  tintColor?: string;
}) {
  if (items.length === 0) return null;
  const pillBg = 'rgba(255,255,255,0.20)';
  const pillText = '#FFFFFF';
  return (
    <View>
      <View style={styles.packingCatHeader}>
        {icon}
        <Text style={[styles.packingCatLabel, { color: '#FFFFFF' }]}>{label}</Text>
      </View>
      <View style={styles.packingItems}>
        {items.map((item, i) => (
          <View key={i} style={[styles.packingPill, { backgroundColor: pillBg, borderWidth: 0, borderColor: 'transparent' }]}>
            <Text style={[styles.packingItem, { color: pillText }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: 'rgba(255,255,255,0.60)' }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: '#FFFFFF' }]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

// ─── Shared section card component ──────────────────
function SectionCard({
  title,
  icon,
  colors,
  children,
  tintColor,
}: {
  title: string;
  icon: React.ReactNode;
  colors: any;
  children: React.ReactNode;
  tintColor?: string;
}) {
  const bgColor = tintColor
    ? tintColor
    : colors.shimmer;
  return (
    <View style={[styles.sectionCard, Shadows.card, { backgroundColor: bgColor, borderColor: 'transparent' }]}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color: '#FFFFFF' }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// =====================================================================
// STYLES
// =====================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Loading / not found
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
  },
  notFoundText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.lg,
    marginTop: Spacing.md,
  },
  backLink: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  // Hero
  hero: {
    minHeight: 220,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Shadows.card,
  },
  heroContent: {
    padding: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.sm,
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['4xl'],
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  heroBadgeText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: 12,
    color: '#fff',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  // Section card
  sectionCard: {
    borderRadius: 20,
    borderWidth: 0,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: 0.5,
  },
  // Highlights
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3,
  },
  highlightBullet: {
    fontSize: 16,
    lineHeight: 20,
  },
  highlightText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
    flex: 1,
  },
  // Seasonal guide
  seasonRow: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  seasonLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seasonMonths: {
    fontFamily: FontFamily.serifSemibold,
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  seasonNote: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  sweetSpot: {
    marginTop: 12,
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  sweetSpotLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  sweetSpotText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  // Quick stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '47%' as any,
    padding: 10,
    borderRadius: Radius.sm,
  },
  statLabel: {
    fontFamily: FontFamily.condensed,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  statValue: {
    fontFamily: FontFamily.serifMedium,
    fontSize: FontSize.sm,
  },
  // Itinerary
  dayCard: {
    borderRadius: 20,
    borderWidth: 0,
    overflow: 'hidden',
  },
  dayImage: {
    width: '100%',
    height: 140,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dayBadgeText: {
    fontFamily: FontFamily.condensedBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    flex: 1,
    letterSpacing: 0.3,
  },
  timeSlots: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.xs,
    gap: 16,
  },
  timeSlot: {
    gap: 4,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeSlotLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeSlotText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginLeft: 19,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  tipText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    flex: 1,
  },
  // Budget
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
  },
  budgetValue: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
  },
  budgetDivider: {
    height: 1,
    marginVertical: 8,
  },
  budgetTotalLabel: {
    fontFamily: FontFamily.serifSemibold,
    fontSize: FontSize.sm,
  },
  budgetTotalValue: {
    fontFamily: FontFamily.condensedBold,
    fontSize: FontSize.base,
  },
  // Visa checklist
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checklistIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checklistLabel: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  checklistDetail: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  // Packing
  packingCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  packingCatLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packingItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  packingPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  packingItem: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
  },
  // Car rental
  carSummary: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  // Info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    minWidth: 75,
  },
  infoValue: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    textAlign: 'left',
  },
  // Empty tab
  emptyTab: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
  },
  emptyTabText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionBarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  actionBarLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

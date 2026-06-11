import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, Sparkles, ChevronRight, Plane } from 'lucide-react-native';

import { useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { Spacing, Radius, FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';

import { Flag } from '@/components/ui/Flag';
import { BackButton } from '@/components/ui/BackButton';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import VisaBadge from '@/components/country/VisaBadge';
import { Section } from '@/components/ui/Section';

import {
  visaData,
  resolveCountry,
  type CountryVisa,
  type HeldVisaType,
} from '@/data/visaData';
import { countryMeta } from '@/data/countryMeta';
import { travelData } from '@/data/travelData';
import { toAlpha2 } from '@/utils/countryCode';

import TripPlannerSheet, {
  type TripPlannerSheetRef,
} from '@/components/trip/TripPlannerSheet';

/**
 * Wishlist — two distinct sections, each routing to where its source
 * actually lives:
 *
 *   • Saved trips    — anything the user hearted on a trip detail
 *                      screen (sets trip.starred). Card tap → trip page.
 *   • Saved countries — anything the user hearted on a country detail
 *                      screen (toggles useVisa().favorites). Card tap →
 *                      country page, with a "Plan a trip" CTA that opens
 *                      the planner pre-filled.
 *
 * Trips and countries are *not* merged into a single list — that was
 * confusing because tapping a trip-sourced card sent the user to the
 * country page (wrong) instead of the trip page (right). Two sections,
 * two routes.
 */
export default function FavoritesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites, heldVisas, toggleFavorite } = useVisa();
  const { isAuthenticated } = useConvexAuth();

  const trips = useOfflineQuery(
    api.trips.listTrips,
    isAuthenticated ? {} : 'skip',
  );

  // Saved trips — every trip with starred === true, newest first.
  const starredTrips = useMemo(() => {
    if (!trips) return [];
    return trips
      .filter((t) => t.starred)
      .slice()
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
  }, [trips]);

  // Saved countries — country-level favorites only. NOT merged with
  // starred-trip countries; those have their own section.
  const savedCountries = useMemo(() => {
    return favorites
      .map((code) => visaData.find((c) => c.code === code))
      .filter((c): c is CountryVisa => Boolean(c));
  }, [favorites]);

  // Planner sheet — re-presented for whichever country card the user
  // taps "Plan a trip" on.
  const tripSheetRef = useRef<TripPlannerSheetRef>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const heldSet = useMemo(
    () => new Set(heldVisas as HeldVisaType[]),
    [heldVisas],
  );

  const selectedCountry = useMemo(
    () =>
      selectedCode
        ? visaData.find((c) => c.code === selectedCode) ?? null
        : null,
    [selectedCode],
  );
  const selectedMeta = selectedCountry ? countryMeta[selectedCountry.code] ?? null : null;
  const selectedTravel = selectedCountry ? travelData[selectedCountry.code] ?? null : null;
  const selectedResolved = selectedCountry ? resolveCountry(selectedCountry, heldSet) : null;

  const onPlanTrip = useCallback((code: string) => {
    setSelectedCode(code);
    requestAnimationFrame(() => {
      tripSheetRef.current?.present();
    });
  }, []);

  const setTripStarred = useMutation(api.trips.setTripStarred);

  // Country REMOVE — only touches country-favorites. Doesn't unstar
  // trips, because trips have their own section + remove flow.
  const onRemoveCountry = useCallback(
    (code: string, name: string) => {
      Alert.alert(
        `Remove ${name}?`,
        'Removes it from your saved countries. Your trips and their hearts are unaffected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => toggleFavorite(code),
          },
        ],
      );
    },
    [toggleFavorite],
  );

  // Trip REMOVE — unstars the trip. Doesn't touch the country
  // favorite even if the same country is on both lists.
  const onUnstarTrip = useCallback(
    (id: Id<'trips'>, label: string) => {
      Alert.alert(
        `Remove this trip?`,
        `Unstars your ${label} trip. The trip itself stays in your trips list.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              setTripStarred({ id, starred: false }).catch(() => {});
            },
          },
        ],
      );
    },
    [setTripStarred],
  );

  const isPlannerReady = !!selectedCountry && !!selectedResolved;
  const totalCount = starredTrips.length + savedCountries.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: Spacing.xl }}>
          <BackButton />
        </View>

        <Section
          kicker={buildHeaderKicker(starredTrips.length, savedCountries.length)}
          title="Wishlist"
          squiggleWidth={130}
          size="lg"
        />

        {totalCount === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <>
            {starredTrips.length > 0 ? (
              <View style={{ marginTop: Spacing.lg }}>
                <SectionHeader
                  label={`SAVED TRIPS · ${starredTrips.length}`}
                  colors={colors}
                />
                <View style={{ gap: 12 }}>
                  {starredTrips.map((trip) => (
                    <TripWishlistCard
                      key={trip._id}
                      trip={trip}
                      onOpen={() =>
                        router.push(`/trip/${trip._id}` as never)
                      }
                      onRemove={() =>
                        onUnstarTrip(trip._id, trip.countryName ?? 'this')
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {savedCountries.length > 0 ? (
              <View
                style={{
                  marginTop:
                    starredTrips.length > 0 ? Spacing.xl : Spacing.lg,
                }}
              >
                <SectionHeader
                  label={`SAVED COUNTRIES · ${savedCountries.length}`}
                  colors={colors}
                />
                <View style={{ gap: 12 }}>
                  {savedCountries.map((country) => (
                    <CountryWishlistCard
                      key={country.code}
                      country={country}
                      heldSet={heldSet}
                      onOpen={() =>
                        router.push(`/country/${country.code}` as never)
                      }
                      onPlanTrip={() => onPlanTrip(country.code)}
                      onRemove={() =>
                        onRemoveCountry(country.code, country.name)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <TopSafeAreaBlur />

      {isPlannerReady && selectedCountry && selectedResolved && (
        <TripPlannerSheet
          ref={tripSheetRef}
          country={selectedCountry}
          meta={selectedMeta}
          travel={selectedTravel}
          resolved={selectedResolved}
          heldVisas={heldSet}
          onTripCreated={(tripId) =>
            router.replace(`/trip/${tripId}` as never)
          }
        />
      )}
    </View>
  );
}

// ─── Header kicker copy ──────────────────────────────────────────────

function buildHeaderKicker(tripCount: number, countryCount: number): string {
  const parts: string[] = [];
  if (tripCount > 0) {
    parts.push(`${tripCount} ${tripCount === 1 ? 'TRIP' : 'TRIPS'}`);
  }
  if (countryCount > 0) {
    parts.push(
      `${countryCount} ${countryCount === 1 ? 'COUNTRY' : 'COUNTRIES'}`,
    );
  }
  if (parts.length === 0) return 'NOTHING SAVED YET';
  return `${parts.join(' · ')} · SAVED TO PLAN LATER`;
}

// ─── Section header (intra-screen) ───────────────────────────────────

function SectionHeader({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Text
      style={[
        Type.kickerSm,
        {
          color: colors.inkMute,
          fontSize: 10,
          letterSpacing: 1.4,
          marginBottom: Spacing.sm,
        },
      ]}
    >
      {label}
    </Text>
  );
}

// ─── Trip card ───────────────────────────────────────────────────────

interface TripWishlistCardProps {
  trip: Doc<'trips'> & { _role?: string };
  onOpen: () => void;
  onRemove: () => void;
}

function TripWishlistCard({ trip, onOpen, onRemove }: TripWishlistCardProps) {
  const { colors } = useTheme();
  const alpha2 = trip.countryCode ? toAlpha2(trip.countryCode) : '';
  const dateRange = formatTripDates(trip.startDate, trip.endDate);

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onRemove}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.flagWrap}>
          {alpha2 ? <Flag code={alpha2} size={36} /> : null}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              Type.title18,
              {
                color: colors.ink,
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                letterSpacing: -0.18,
              },
            ]}
            numberOfLines={1}
          >
            {trip.countryName ?? 'Trip'}
          </Text>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.inkMute, fontSize: 10, letterSpacing: 1 },
            ]}
            numberOfLines={1}
          >
            {dateRange}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.coralBg,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Plane size={10} color={colors.coral} strokeWidth={2.2} />
            <Text
              style={{
                color: colors.coral,
                fontSize: 9,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              TRIP
            </Text>
          </View>
          <ChevronRight size={16} color={colors.inkMute} strokeWidth={2} />
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          hitSlop={10}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: pressed ? 0.55 : 1,
          })}
          accessibilityLabel="Remove this trip from wishlist"
        >
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 11 }]}>
            REMOVE
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Country card ────────────────────────────────────────────────────

interface CountryWishlistCardProps {
  country: CountryVisa;
  heldSet: Set<HeldVisaType>;
  onOpen: () => void;
  onPlanTrip: () => void;
  onRemove: () => void;
}

function CountryWishlistCard({
  country,
  heldSet,
  onOpen,
  onPlanTrip,
  onRemove,
}: CountryWishlistCardProps) {
  const { colors } = useTheme();
  const resolved = useMemo(
    () => resolveCountry(country, heldSet),
    [country, heldSet],
  );
  const meta = countryMeta[country.code];
  const region = meta?.region ?? '—';
  const alpha2 = toAlpha2(country.code);

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onRemove}
      delayLongPress={500}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.flagWrap}>
          <Flag code={alpha2} size={36} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              Type.title18,
              {
                color: colors.ink,
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                letterSpacing: -0.18,
              },
            ]}
            numberOfLines={1}
          >
            {country.name}
          </Text>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.inkMute, fontSize: 10, letterSpacing: 1 },
            ]}
            numberOfLines={1}
          >
            {region.toUpperCase()}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <VisaBadge category={resolved.category} />
          <ChevronRight size={16} color={colors.inkMute} strokeWidth={2} />
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onPlanTrip();
          }}
          style={({ pressed }) => [
            styles.planBtn,
            {
              backgroundColor: colors.coral,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityLabel={`Plan a trip to ${country.name}`}
        >
          <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.planBtnText}>Plan a trip</Text>
        </Pressable>

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          hitSlop={10}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: pressed ? 0.55 : 1,
          })}
          accessibilityLabel={`Remove ${country.name} from wishlist`}
        >
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 11 }]}>
            REMOVE
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={[styles.empty, { marginTop: Spacing.xl }]}>
      <View
        style={[
          styles.heartOrb,
          { backgroundColor: colors.coralBg, borderColor: colors.line },
        ]}
      >
        <Heart size={26} color={colors.coral} strokeWidth={1.6} />
      </View>
      <Text
        style={[
          Type.display22Italic,
          {
            color: colors.ink,
            textAlign: 'center',
            marginTop: Spacing.md,
            marginBottom: Spacing.xs,
          },
        ]}
      >
        Nothing yet<Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Text
        style={[
          Type.body13,
          { color: colors.inkMute, textAlign: 'center', maxWidth: 280 },
        ]}
      >
        Tap the heart on any country page or trip to save it here. We’ll
        keep them ready for when you’re ready to plan.
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTripDates(start?: string, end?: string): string {
  if (!start && !end) return 'NO DATES';
  const fmt = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();
  };
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} → ${e}`;
  return s || e || 'NO DATES';
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flagWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 56,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  planBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: Spacing.lg,
  },
  heartOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
import { Heart, Sparkles, ChevronRight } from 'lucide-react-native';

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
 * Wishlist — the destination of every "saved country" the user has hearted
 * across the app. Each card lets the user either dive into the country
 * detail (read more, see visa rules, weather, costs) or jump straight to
 * the planner sheet pre-filled with that country.
 *
 * Replaces the previous stub that just rendered a count.
 */
export default function FavoritesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favorites, heldVisas, toggleFavorite } = useVisa();

  // Resolve each saved alpha-3 code into a full CountryVisa record. Any
  // codes that are no longer in the table (data drift) silently drop.
  const savedCountries = useMemo(() => {
    return favorites
      .map((code) => visaData.find((c) => c.code === code))
      .filter((c): c is CountryVisa => Boolean(c));
  }, [favorites]);

  // Planner sheet — mounted once at the bottom of this screen and
  // re-presented for whichever country the user taps "Plan a trip" on.
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
    // Defer present() one frame so the sheet receives the new country
    // props before opening (otherwise it'd render the in-sheet country
    // picker for an instant before snapping to the pre-filled state).
    requestAnimationFrame(() => {
      tripSheetRef.current?.present();
    });
  }, []);

  const onRemove = useCallback(
    (code: string, name: string) => {
      Alert.alert(
        `Remove ${name}?`,
        'This just removes it from your wishlist — it stays available across the rest of the app.',
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

  const isReady = !!selectedCountry && !!selectedResolved;

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
        {/* Top chrome: circular back button per the CLAUDE.md mandate. */}
        <View style={{ marginBottom: Spacing.xl }}>
          <BackButton />
        </View>

        {/* Editorial title — italic Fraunces with a coral period, matches
            the rest of the app's section headers. */}
        <Section
          kicker={`${savedCountries.length} ${
            savedCountries.length === 1 ? 'COUNTRY' : 'COUNTRIES'
          } · SAVED TO PLAN LATER`}
          title="Wishlist"
          squiggleWidth={130}
          size="lg"
        />

        {savedCountries.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <View style={{ gap: 12, marginTop: Spacing.lg }}>
            {savedCountries.map((country) => (
              <WishlistCard
                key={country.code}
                country={country}
                heldSet={heldSet}
                onOpenCountry={() =>
                  router.push(`/country/${country.code}` as never)
                }
                onPlanTrip={() => onPlanTrip(country.code)}
                onRemove={() => onRemove(country.code, country.name)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Mandated TopSafeAreaBlur — keeps scrolled content from drifting
          behind the Dynamic Island unmasked. */}
      <TopSafeAreaBlur />

      {/* Planner sheet — single instance reused across cards. Only
          mount once we have a selected country with resolved visa data,
          otherwise the sheet's required country prop is null. */}
      {isReady && selectedCountry && selectedResolved && (
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

// ─── WishlistCard ─────────────────────────────────────────────────────

interface WishlistCardProps {
  country: CountryVisa;
  heldSet: Set<HeldVisaType>;
  onOpenCountry: () => void;
  onPlanTrip: () => void;
  onRemove: () => void;
}

function WishlistCard({
  country,
  heldSet,
  onOpenCountry,
  onPlanTrip,
  onRemove,
}: WishlistCardProps) {
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
      onPress={onOpenCountry}
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
      {/* Top row — flag + name + region + visa pill + chevron. */}
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

      {/* Bottom row — primary CTA + secondary "Remove" affordance. */}
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

// ─── Empty state ──────────────────────────────────────────────────────

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
        Tap the heart on any country page to save it here. We'll keep it
        ready for when you're ready to plan.
      </Text>
    </View>
  );
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
    paddingLeft: 56, // align with the text column above
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

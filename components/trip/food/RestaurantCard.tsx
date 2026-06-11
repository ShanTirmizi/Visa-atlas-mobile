import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { UtensilsCrossed } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily, Shadows } from '@/constants/theme';
import { openInMaps } from '@/utils/maps';
import { hapticSelect } from '@/utils/haptics';
import { CROWD_LABELS, type DiningSpot, type MealTag } from '@/types/itinerary';

const MEAL_LABELS: Record<MealTag, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/** How many day chips show before collapsing behind a "+N" disclosure. */
const CHIP_CAP = 3;

interface RestaurantCardProps {
  spot: DiningSpot;
  /** For the day-chip deep links: /trip/{tripId}/day/{index}. */
  tripId: string;
  /** Destination country name — appended to the maps query so
   *  "Trattoria Da Enzo Trastevere Italy" resolves to the right place,
   *  not a same-named spot elsewhere. */
  countryName?: string;
  /** Day number → position in the FILTERED parseItineraryDays array.
   *  The day route resolves its `idx` param against that filtered array,
   *  so `day - 1` navigates to the wrong day the moment a null hole was
   *  filtered out. Day numbers absent from the map get no chip at all. */
  dayIndexByNumber: Record<number, number>;
}

/**
 * One dining-guide entry. Text-only editorial card (no photos — we have
 * none, and faking them would be worse): mono provenance kicker, Fraunces
 * name, one-sentence `why`, the signature order, soft trust-signal pills
 * (bg tint + coloured text, no leading dots), and a footer of tappable
 * day chips + a MAPS → affordance. Card chrome matches the codebase's
 * text-card convention (NextUpCard): surface + hairline + subtle shadow.
 */
export function RestaurantCard({
  spot,
  tripId,
  countryName,
  dayIndexByNumber,
}: RestaurantCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [chipsExpanded, setChipsExpanded] = useState(false);

  // Day chips: days × meals, day-major, e.g. "Day 3 · Lunch". A spot with
  // no meal tags still gets plain "Day 3" chips. spot.days are 1-based;
  // the route index comes from dayIndexByNumber (the day route resolves
  // its param against the FILTERED itinerary array, so `day - 1` is not
  // safe). Day numbers with no parsed day are skipped — no dead chips.
  const dayChips = useMemo(() => {
    const days = (spot.days ?? []).filter((d) => dayIndexByNumber[d] !== undefined);
    const meals: (MealTag | null)[] = spot.meals?.length ? spot.meals : [null];
    const chips: { key: string; label: string; dayIndex: number }[] = [];
    for (const day of days) {
      for (const meal of meals) {
        chips.push({
          key: `${day}-${meal ?? 'any'}`,
          label: meal ? `Day ${day} · ${MEAL_LABELS[meal]}` : `Day ${day}`,
          dayIndex: dayIndexByNumber[day],
        });
      }
    }
    return chips;
  }, [spot.days, spot.meals, dayIndexByNumber]);

  const visibleChips =
    chipsExpanded || dayChips.length <= CHIP_CAP
      ? dayChips
      : dayChips.slice(0, CHIP_CAP);
  const hiddenCount = dayChips.length - visibleChips.length;

  const openDay = (dayIndex: number) => {
    hapticSelect();
    router.push(`/trip/${tripId}/day/${dayIndex}` as never);
  };

  const openMaps = () => {
    hapticSelect();
    openInMaps({
      name: spot.name,
      location: spot.area,
      // Country NAME, not ISO code — it's a plain search token and the
      // name disambiguates far better in the maps query.
      countryCode: countryName,
    }).catch(() => {});
  };

  const hasPills = !!spot.crowd || !!spot.reserveAhead;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
        Shadows.subtle,
      ]}
    >
      {/* Provenance kicker — CUISINE · $$ · AREA */}
      <Text
        style={[Type.kickerSm, { color: colors.inkMute }]}
        numberOfLines={1}
      >
        {spot.cuisine} · {spot.price} · {spot.area}
      </Text>

      {/* Name — Fraunces display */}
      <Text
        style={{
          fontFamily: FontFamily.display,
          fontSize: 19,
          fontWeight: '500',
          lineHeight: 24,
          letterSpacing: -19 * 0.018,
          color: colors.ink,
          marginTop: 6,
        }}
      >
        {spot.name}
      </Text>

      {/* Why it's on this trip */}
      <Text style={[Type.body13, { color: colors.inkSoft, marginTop: 4 }]}>
        {spot.why}
      </Text>

      {/* The order — signature dish line */}
      {spot.knownFor ? (
        <View style={styles.orderRow}>
          <UtensilsCrossed
            size={13}
            color={colors.dining}
            strokeWidth={2.2}
            style={{ marginTop: 2.5 }}
          />
          <Text
            style={{
              flex: 1,
              fontFamily: FontFamily.medium,
              fontSize: 13,
              lineHeight: 18.5,
              color: colors.ink,
            }}
          >
            {spot.knownFor}
          </Text>
        </View>
      ) : null}

      {/* Trust-signal pills — soft pills, no leading dots */}
      {hasPills ? (
        <View style={styles.pillRow}>
          {spot.crowd ? (
            <View style={[styles.pill, { backgroundColor: colors.diningBg }]}>
              <Text style={[styles.pillText, { color: colors.dining }]}>
                {CROWD_LABELS[spot.crowd]}
              </Text>
            </View>
          ) : null}
          {spot.reserveAhead ? (
            <View style={[styles.pill, { backgroundColor: colors.goldSoft }]}>
              <Text style={[styles.pillText, { color: colors.gold }]}>
                Reserve ahead
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Walk note — plain mono microcopy, deliberately not a pill */}
      {spot.walkNote ? (
        <Text style={[Type.mono10, { color: colors.inkMute, marginTop: 8 }]}>
          {spot.walkNote}
        </Text>
      ) : null}

      {/* Footer — day chips on the left, MAPS → on the right */}
      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <View style={styles.chipWrap}>
          {visibleChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => openDay(chip.dayIndex)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${chip.label}`}
              hitSlop={4}
              style={({ pressed }) => [
                styles.dayChip,
                {
                  backgroundColor: colors.tealBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: colors.teal }]}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
          {hiddenCount > 0 ? (
            // Disclosure, not dead UI — tapping reveals the remaining chips.
            <Pressable
              onPress={() => {
                hapticSelect();
                setChipsExpanded(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Show ${hiddenCount} more days`}
              hitSlop={4}
              style={({ pressed }) => [
                styles.dayChip,
                {
                  backgroundColor: colors.tealBg,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: colors.teal }]}>
                +{hiddenCount}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={openMaps}
          accessibilityRole="link"
          accessibilityLabel={`Open ${spot.name} in Maps`}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={[
              Type.kickerSm,
              { color: colors.dining, letterSpacing: 9 * 0.14 },
            ]}
          >
            MAPS →
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default RestaurantCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  // Soft pill — bg tint + coloured text carry the signal (no leading dot).
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  chipWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});

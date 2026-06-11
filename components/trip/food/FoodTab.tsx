import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ArrowRight, UtensilsCrossed } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { Type } from '@/constants/typography';
import { FontFamily, Radius, Shadows } from '@/constants/theme';
import { Section } from '@/components/ui/Section';
import { Squiggle } from '@/components/ui/Squiggle';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TypingDots } from '@/components/ui/TypingDots';
import { SectionRetryCard } from '@/components/trip/skeletons/SectionRetryCard';
import { FoodTabSkeleton } from '@/components/trip/skeletons/FoodTabSkeleton';
import { RestaurantCard } from './RestaurantCard';
import { hapticImpact } from '@/utils/haptics';
import {
  isGenerating,
  hasFailed,
  isRetrying,
  type TripLike,
} from '@/utils/sectionState';
import type { DiningGuide, MealTag } from '@/types/itinerary';

// Strict meal filters — a spot appears under a filter only when it carries
// that exact tag (snack-only spots live under All; we don't pretend a
// snack is breakfast). Options with zero matches are dropped so no filter
// ever leads to an empty list.
type MealFilter = 'All' | 'Breakfast' | 'Lunch' | 'Dinner';
const FILTER_TO_MEAL: Record<Exclude<MealFilter, 'All'>, MealTag> = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
};
const MEAL_FILTERS: Exclude<MealFilter, 'All'>[] = ['Breakfast', 'Lunch', 'Dinner'];

interface FoodTabProps {
  tripId: Id<'trips'>;
  /** Parsed `trips.diningGuide` (via parseDiningGuide). Null = not there yet. */
  guide: DiningGuide | null;
  /** The live trip doc — section state (pending/failed/retrying) is derived
   *  here via the sectionState helpers so it stays reactive. */
  trip: TripLike;
  /** Destination country name — kicker context + maps disambiguation. */
  countryName?: string;
  /** Day number → position in the FILTERED itinerary array (built by the
   *  trip screen) — the day route resolves its param against that same
   *  filtered array, so chips must navigate by filtered position. */
  dayIndexByNumber: Record<number, number>;
  /** Collaborator role from getTrip's `_role`. Viewers never see the
   *  curate CTA or retry card — both fire editor-gated mutations. */
  role?: string;
}

/**
 * Trip detail → Food tab. Five states:
 *  1. loaded     — guide present: intro, must-try strip, meal filter, spots.
 *  2. failed     — SectionRetryCard (same affordance as Visa/Itinerary).
 *  3. retrying   — server re-run in flight: TypingDots pill + skeleton.
 *  4. pending    — main generation still running: quiet line + skeleton.
 *  5. absent     — pre-dining trip: editorial empty state with a backfill
 *                  CTA firing tripGeneration.generateDiningGuide.
 */
export function FoodTab({
  tripId,
  guide,
  trip,
  countryName,
  dayIndexByNumber,
  role,
}: FoodTabProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const generateGuide = useMutation(api.tripGeneration.generateDiningGuide);

  const failed = hasFailed(trip, 'diningGuide');
  const retrying = isRetrying(trip, 'diningGuide');
  const generating = isGenerating(trip);
  const isViewer = role === 'viewer';

  // Optimistic cover for the CTA round-trip gap (DayTweakChips pattern):
  // the in-progress state shows the instant the CTA is tapped, before
  // `retryingSections` lands on the live query. Cleared on ANY terminal /
  // confirming signal — retrying (server picked the run up), failed (run
  // died with a marker), or the guide landing (run finished before we ever
  // observed retrying, e.g. across a socket blip).
  const [pending, setPending] = useState(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (retrying || failed || guide) {
      setPending(false);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
  }, [retrying, failed, guide]);
  // Unmount cleanup for the defensive timer below.
  useEffect(
    () => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    },
    [],
  );

  const onCurate = () => {
    hapticImpact();
    setPending(true);
    // Defensive timeout: if a socket blip swallows every server signal
    // (retrying/failed/guide all unobserved), don't wedge the curating
    // skeleton forever — fall back to the CTA so the user can retry.
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      setPending(false);
      pendingTimerRef.current = null;
    }, 20_000);
    generateGuide({ tripId }).catch(() => {
      setPending(false);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      showToast('error', "Couldn't start your food guide. Try again in a moment.");
    });
  };

  const [filter, setFilter] = useState<MealFilter>('All');

  // Only offer filters that actually match ≥1 spot; hide the control
  // entirely when "All" is the only option.
  const filterOptions = useMemo<MealFilter[]>(() => {
    if (!guide) return ['All'];
    const withMatches = MEAL_FILTERS.filter((f) =>
      guide.spots.some((s) => (s.meals ?? []).includes(FILTER_TO_MEAL[f])),
    );
    return ['All', ...withMatches];
  }, [guide]);

  // Guard against a re-curated guide dropping the active filter's meal.
  const effectiveFilter = filterOptions.includes(filter) ? filter : 'All';

  const filteredSpots = useMemo(() => {
    if (!guide) return [];
    if (effectiveFilter === 'All') return guide.spots;
    const meal = FILTER_TO_MEAL[effectiveFilter];
    // Preserve guide order — the server emits spots in editorial order.
    return guide.spots.filter((s) => (s.meals ?? []).includes(meal));
  }, [guide, effectiveFilter]);

  // ── 1. Loaded ────────────────────────────────────────────
  // The server normalizer never stores a spotless guide, but legacy or
  // hand-edited docs could — treat those as absent (CTA re-curates).
  if (guide && guide.spots.length > 0) {
    return (
      <View>
        {/* Editorial intro — mono kicker + Fraunces italic scene-setter */}
        <View style={{ paddingHorizontal: 4, paddingTop: 6 }}>
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 11,
              fontWeight: '700',
              color: colors.inkMute,
              letterSpacing: 11 * 0.22,
            }}
          >
            THE FOOD SCENE{countryName ? ` · ${countryName.toUpperCase()}` : ''}
          </Text>
          {guide.intro ? (
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 17,
                fontWeight: '500',
                lineHeight: 26,
                letterSpacing: -17 * 0.012,
                color: colors.ink,
                opacity: 0.9,
                marginTop: 8,
              }}
            >
              {guide.intro}
            </Text>
          ) : null}
        </View>

        {/* Must-try dishes — horizontal strip of compact text cards.
            No photos: we have none, and faking them would be worse. */}
        {guide.mustTry.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Section
              kicker="MUST-TRY"
              title="Order these"
              trailing="."
              squiggleWidth={84}
              style={{ paddingHorizontal: 4 }}
            />
            {/* Bleed to the screen edge past the tab's 16px gutter. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16, marginTop: 12 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {guide.mustTry.map((dish, idx) => (
                <View
                  key={`${dish.dish}-${idx}`}
                  style={[styles.dishCard, { backgroundColor: colors.warmBg }]}
                >
                  <Text
                    style={{
                      fontFamily: FontFamily.display,
                      fontSize: 15.5,
                      fontWeight: '500',
                      lineHeight: 19,
                      letterSpacing: -15.5 * 0.016,
                      color: colors.ink,
                    }}
                    numberOfLines={2}
                  >
                    {dish.dish}
                  </Text>
                  {dish.note ? (
                    <Text
                      style={[
                        Type.body13,
                        {
                          color: colors.inkSoft,
                          fontSize: 11.5,
                          lineHeight: 16,
                          marginTop: 5,
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {dish.note}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* The shortlist — meal filter + restaurant cards */}
        <View style={{ marginTop: 24 }}>
          <Section
            kicker="WHERE TO EAT"
            title="The shortlist"
            trailing="."
            squiggleWidth={96}
            style={{ paddingHorizontal: 4, marginBottom: 14 }}
          />
          {filterOptions.length > 1 ? (
            <SegmentedControl
              options={filterOptions}
              value={effectiveFilter}
              onChange={(v) => setFilter(v as MealFilter)}
              variant="pill"
            />
          ) : null}
          <View style={{ gap: 12 }}>
            {filteredSpots.map((spot, idx) => (
              <RestaurantCard
                key={`${spot.name}-${idx}`}
                spot={spot}
                tripId={String(tripId)}
                countryName={countryName}
                dayIndexByNumber={dayIndexByNumber}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── 2. Failed — retry card, exactly as Visa/Itinerary use it ──
  // Viewers get a quiet one-line note instead: retrySection is an
  // editor-gated mutation, and a retry button that can only throw is
  // worse than no button.
  if (failed) {
    if (isViewer) {
      return (
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 15,
            fontWeight: '500',
            lineHeight: 22,
            letterSpacing: -15 * 0.012,
            color: colors.inkSoft,
            paddingHorizontal: 4,
            paddingTop: 6,
          }}
        >
          The dining guide hit a snag — the trip owner can retry it.
        </Text>
      );
    }
    return (
      <SectionRetryCard
        tripId={tripId}
        section="diningGuide"
        label="dining guide"
        retrying={retrying}
      />
    );
  }

  // ── 3. Retrying — backfill run in flight ─────────────────
  if (retrying || pending) {
    return (
      <View style={{ paddingTop: 6 }}>
        <View style={[styles.curatingPill, { backgroundColor: colors.diningBg }]}>
          <TypingDots color={colors.diningDeep} size="sm" />
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 14,
              fontWeight: '500',
              letterSpacing: -14 * 0.012,
              color: colors.diningDeep,
            }}
          >
            Curating your dining guide…
          </Text>
        </View>
        <FoodTabSkeleton />
      </View>
    );
  }

  // ── 4. Pending — main generation still running ───────────
  if (generating) {
    return (
      <View style={{ paddingTop: 6 }}>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 15,
            fontWeight: '500',
            lineHeight: 22,
            letterSpacing: -15 * 0.012,
            color: colors.inkSoft,
            paddingHorizontal: 4,
          }}
        >
          Curating where you’ll eat — the itinerary comes first.
        </Text>
        <FoodTabSkeleton />
      </View>
    );
  }

  // ── 5. Absent — pre-dining trip, premium backfill CTA ────
  return (
    <View style={{ paddingHorizontal: 4, paddingTop: 6 }}>
      <Text
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 11,
          fontWeight: '700',
          color: colors.inkMute,
          letterSpacing: 11 * 0.22,
        }}
      >
        DINING GUIDE{countryName ? ` · ${countryName.toUpperCase()}` : ''}
      </Text>
      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 26,
          fontWeight: '500',
          lineHeight: 30,
          letterSpacing: -26 * 0.022,
          color: colors.ink,
          marginTop: 6,
        }}
      >
        Eat like a local
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Squiggle width={64} color={colors.coral} style={{ marginTop: 6 }} />
      <Text style={[Type.body13, { color: colors.inkSoft, marginTop: 12 }]}>
        Restaurants picked for this itinerary — matched to your days, your
        pace and your budget, with the one dish to order at each.
      </Text>

      {/* Backfill CTA — fires generateDiningGuide; progress is reactive via
          the trip doc's retryingSections, so this screen flips to the
          curating state on its own. Viewers get a quiet supporting line
          instead: generateDiningGuide is editor-gated, and a CTA that can
          only throw is dead UI. */}
      {isViewer ? (
        <Text style={[Type.body13, { color: colors.inkMute, marginTop: 16 }]}>
          Ask the trip owner to curate dining.
        </Text>
      ) : (
        <Pressable
          onPress={onCurate}
          accessibilityRole="button"
          accessibilityLabel="Curate my food guide"
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.ink,
              opacity: pressed ? 0.9 : 1,
            },
            Shadows.cardWarm,
          ]}
        >
          <View style={[styles.ctaIcon, { backgroundColor: colors.dining }]}>
            <UtensilsCrossed size={15} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.coral, fontSize: 9, letterSpacing: 9 * 0.18 },
              ]}
            >
              ONE TAP · ABOUT A MINUTE
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
              Curate my food guide
            </Text>
          </View>
          <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.25} />
        </Pressable>
      )}
    </View>
  );
}

export default FoodTab;

const styles = StyleSheet.create({
  dishCard: {
    width: 168,
    borderRadius: Radius.md,
    padding: 14,
  },
  curatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginBottom: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 18,
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

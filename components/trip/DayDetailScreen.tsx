import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Images, Pencil, Share, Sparkles } from 'lucide-react-native';
import { FontFamily } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { DayTimeline, type SlotImage } from '@/components/trip/day/DayTimeline';
import { PullQuote } from '@/components/trip/day/PullQuote';
import { DayTweakChips } from '@/components/trip/day/DayTweakChips';
import { DayBookingsStrip, type DayStripBooking } from '@/components/trip/day/DayBookingsStrip';
import DayMapStrip from '@/components/trip/DayMapStrip';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { Squiggle } from '@/components/ui/Squiggle';
import { tabSlideIn } from '@/utils/tabAnimation';
import { hapticSelect } from '@/utils/haptics';
import {
  type ItineraryDay,
  type DiningGuide,
  type StopSlot,
  type StopPhotoSet,
  hasStructuredStops,
  stopsForSlot,
} from '@/types/itinerary';
import { usePhotoViewer } from '@/components/photos/PhotoViewer';
import {
  buildDayAlbum,
  firstIndexForSlot,
  indexOfAlbumPhoto,
} from '@/utils/photoAlbum';

/** The day screen consumes the shared itinerary contract (types/itinerary.ts)
 *  — alias retained for existing import sites. */
export type DayDetailDay = ItineraryDay;

type DayImage = { url: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = SlotImage;

interface DayDetailScreenProps {
  day: DayDetailDay;
  /** Position in the FILTERED parseItineraryDays array — drives prev/next
   *  paging and the swipe animation keys ONLY. */
  dayIndex: number;
  /** Position in the STORED trips.itinerary array (`day.day - 1`) —
   *  drives everything server-addressed or calendar-based: tweakDay,
   *  the bookings strip and the start-date offset. Diverges from
   *  `dayIndex` when a null hole was filtered out of the stored array. */
  storedDayIndex: number;
  numDays: number;
  heroImage: DayImage;
  morningImage: ActivityImage;
  afternoonImage: ActivityImage;
  eveningImage: ActivityImage;
  destination?: string;
  tripStartDate?: string;
  /** Parsed `trips.diningGuide` — lunch/dinner suggestions woven into the
   *  timeline. null hides the dining inserts entirely. */
  diningGuide: DiningGuide | null;
  /** Parsed `trips.stopPhotos` — per-stop Google Places photos. Feeds the
   *  day album (hero tap, photos chip, slot strips). Absent → the photo
   *  affordances quietly cover whatever images the trip already has. */
  stopPhotos?: StopPhotoSet[];
  /** True while the trip's stop photos are still being fetched — drives the
   *  per-slot shimmer skeletons so a freshly opened day doesn't look bare. */
  photosLoading?: boolean;
  onBack: () => void;
  onShare: () => void;
  onEdit?: () => void;
  onNavigateDay: (newIndex: number) => void;
  /** Open AI chat scoped to this specific day. */
  onTweakWithAI?: () => void;
  /** Convex trip id — enables the one-tap tweak chips (DayTweakChips owns
   *  the mutation). Absent → the chip row doesn't render. */
  tripId?: Id<'trips'>;
  /** True while `trip.retryingSections` contains
   *  `itinerary-day:${storedDayIndex}` — a server-side tweakDay rewrite
   *  for THIS day is in flight. */
  isDayRewriting?: boolean;
  /** Trip bookings — rows whose dates cover this day render at the top of
   *  the timeline. */
  bookings?: DayStripBooking[];
}

// Apple Maps place-card detents: a "peek" that leaves the day's photo as the
// hero, and a near-full read that tucks just below the Dynamic Island (the
// topInset clamp does that). Percentages are heights from the bottom.
const SHEET_COLLAPSED_RATIO = 0.46;
const SHEET_SNAP_POINTS = ['46%', '92%'];

// Swipe-to-page commit thresholds — UIScrollView paging semantics: a
// decisive flick commits even on short travel, otherwise distance decides.
// Distance matches DayDeck's commitThresholdPx so both day-paging surfaces
// feel identical under the finger.
const SWIPE_COMMIT_DISTANCE = 60;
const SWIPE_COMMIT_VELOCITY = 500;

// ── Helpers ──────────────────────────────────────────────────────────

function formatDaySubtitle(
  startDate: string | undefined,
  dayIndex: number,
  stopCount: number,
): string {
  const parts: string[] = [];

  if (startDate) {
    const d = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + dayIndex);
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const day = d.getDate();
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      parts.push(`${month} ${day} · ${weekday}`);
    }
  }

  if (stopCount > 0) {
    parts.push(`${stopCount} ${stopCount === 1 ? 'stop' : 'stops'}`);
  }

  return parts.join(' · ');
}

function deriveDayTitle(day: DayDetailDay): string {
  if (day.title && day.title.trim().length > 0) return day.title;

  const placeNames = [day.morningPlace, day.afternoonPlace, day.eveningPlace].filter(
    (p): p is string => Boolean(p && p.trim().length > 0),
  );

  if (placeNames.length >= 2) {
    return `${placeNames[0]} & ${placeNames[1]}`;
  }
  if (placeNames.length === 1) {
    return placeNames[0];
  }

  return `Day ${day.day}`;
}

/** Stops shown in the subtitle: valid structured stops when the day has
 *  them, otherwise the count of non-empty prose slots (legacy days). */
function countDayStops(day: DayDetailDay): number {
  if (hasStructuredStops(day)) {
    const slots: StopSlot[] = ['morning', 'afternoon', 'evening'];
    return slots.reduce((n, slot) => n + stopsForSlot(day, slot).length, 0);
  }
  return [day.morning, day.afternoon, day.evening].filter(
    (t) => (t ?? '').trim().length > 0,
  ).length;
}

// Only real itinerary tips render — no fabricated fallback. The old
// "Visit X before 9 AM…" filler presented invented advice as local
// knowledge; a day without a tip simply has no pull-quote.
function deriveTip(day: DayDetailDay): string {
  if (day.localTip && day.localTip.trim().length > 0) return day.localTip;
  if (day.tip && day.tip.trim().length > 0) return day.tip;
  return '';
}

// ── Tone for hero placeholder ─────────────────────────────────────────

const HERO_TONES: PhotoTone[] = ['forest', 'ocean', 'sunset', 'warm', 'mountain'];

function heroToneFromDestination(destination: string | undefined): PhotoTone {
  if (!destination) return 'forest';
  let hash = 0;
  for (let i = 0; i < destination.length; i++) {
    hash += destination.charCodeAt(i);
  }
  return HERO_TONES[hash % HERO_TONES.length];
}

// ── Main screen ──────────────────────────────────────────────────────

function DayDetailScreen({
  day,
  dayIndex,
  storedDayIndex,
  numDays,
  heroImage,
  morningImage,
  afternoonImage,
  eveningImage,
  destination,
  tripStartDate,
  diningGuide,
  stopPhotos,
  photosLoading,
  onBack,
  onShare,
  onEdit,
  onNavigateDay,
  onTweakWithAI,
  tripId,
  isDayRewriting,
  bookings,
}: DayDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  // The day title floats on the photo just above the collapsed sheet's top
  // edge — so it reads like an Apple Maps place-card title that the card
  // slides up over as you expand to read the full plan.
  const heroTitleBottom = screenH * SHEET_COLLAPSED_RATIO + 14;

  // ── Day paging: one handler shared by header chevrons + horizontal swipe.
  // Clamped no-op at the first/last day; selection haptic only when the day
  // actually changes (same vocabulary as DayDeck's chevrons).
  const hasNavigatedRef = useRef(false);
  const goToDay = useCallback(
    (target: number) => {
      if (target < 0 || target > numDays - 1 || target === dayIndex) return;
      hasNavigatedRef.current = true;
      hapticSelect();
      onNavigateDay(target);
    },
    [dayIndex, numDays, onNavigateDay],
  );

  // Track the previous index so the fade-slide knows which side to enter
  // from — same ref pattern as the trip-detail tab swap.
  const prevIndexRef = useRef(dayIndex);
  const navDirection = dayIndex >= prevIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevIndexRef.current = dayIndex;
  }, [dayIndex]);
  // Skip the entering animation on the very first mount — the screen push
  // (slide_from_right) already animates the whole page in; only user-driven
  // day changes get the directional content swap.
  const dayEntering = hasNavigatedRef.current
    ? tabSlideIn(navDirection * 18)
    : undefined;

  // Horizontal page swipe (Apple Photos / Books feel). activeOffsetX ±20 +
  // failOffsetY ±15 keep vertical scrolling of the day content untouched —
  // the pan only activates on a clearly horizontal drag and fails as soon
  // as the drag turns vertical, handing the touch to the ScrollView.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .onEnd((e) => {
          const byVelocity = Math.abs(e.velocityX) > SWIPE_COMMIT_VELOCITY;
          const byDistance = Math.abs(e.translationX) > SWIPE_COMMIT_DISTANCE;
          if (!byVelocity && !byDistance) return;
          // A decisive flick wins over net travel (matches iOS paging:
          // dragging right then flicking left still pages forward).
          const sign = byVelocity ? e.velocityX : e.translationX;
          // Swipe LEFT → next day, swipe RIGHT → previous day.
          const dir = sign < 0 ? 1 : -1;
          runOnJS(goToDay)(dayIndex + dir);
        }),
    [goToDay, dayIndex],
  );

  const stopCount = useMemo(() => countDayStops(day), [day]);

  const dayTitle = useMemo(() => deriveDayTitle(day), [day]);
  // Calendar offset is stored-domain: startDate + (day.day - 1) days.
  const subtitle = useMemo(
    () => formatDaySubtitle(tripStartDate, storedDayIndex, stopCount),
    [tripStartDate, storedDayIndex, stopCount],
  );
  const tip = useMemo(() => deriveTip(day), [day]);
  const heroTone = useMemo(() => heroToneFromDestination(destination), [destination]);

  // ── Day photo album: scenic day hero → per-slot anchor + stop photos.
  // Every photo affordance on this screen (hero tap, photos chip, slot
  // thumbs, stop strips) opens this ONE album so swiping covers the day.
  const { openPhotoViewer } = usePhotoViewer();
  const dayNumber = day.day ?? storedDayIndex + 1;
  const album = useMemo(
    () =>
      buildDayAlbum({
        day,
        dayNumber,
        dayImage: heroImage,
        slotImages: {
          morning: morningImage,
          afternoon: afternoonImage,
          evening: eveningImage,
        },
        stopPhotos,
      }),
    [day, dayNumber, heroImage, morningImage, afternoonImage, eveningImage, stopPhotos],
  );
  const openAlbum = useCallback(() => {
    openPhotoViewer(album, 0);
  }, [openPhotoViewer, album]);
  const openAlbumAtPhoto = useCallback(
    (url: string) => {
      openPhotoViewer(album, indexOfAlbumPhoto(album, url));
    },
    [openPhotoViewer, album],
  );
  const openSlotPhotos = useCallback(
    (slot: StopSlot) => {
      openPhotoViewer(album, firstIndexForSlot(album, slot));
    },
    [openPhotoViewer, album],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HERO — full-screen photo layer behind the sheet. Horizontal
          swipe pages between days (keyed remount → directional fade-slide);
          the sheet owns all vertical drag, so the gestures never fight. ── */}
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          key={`hero-${dayIndex}`}
          entering={dayEntering}
          style={styles.hero}
        >
        {heroImage?.url ? (
          <ImageBackground
            source={{ uri: heroImage.url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          >
            {/* Scrim: dark top + dark bottom, transparent middle for legibility */}
            <LinearGradient
              colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
              locations={[0, 0.35, 0.60, 1]}
              style={StyleSheet.absoluteFill}
            />
          </ImageBackground>
        ) : (
          <Photo
            tone={heroTone}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Whole hero opens the day album — Airbnb / Apple Maps hero
            behaviour. The horizontal page-swipe pan is unaffected (it only
            activates past ±20px of travel; a clean tap never reaches it). */}
        {album.length > 0 ? (
          <Pressable
            onPress={openAlbum}
            accessibilityRole="imagebutton"
            accessibilityLabel={`View ${album.length} photos for this day`}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Localized scrim behind the title band — the hero fills the screen
            so the title floats over the mid-photo where the main scrim is
            transparent; this soft dark band guarantees legibility over bright
            images (snow, white architecture) the way Apple Maps/Photos anchor
            overlaid titles. */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.42)', 'transparent']}
          locations={[0, 0.35, 0.72, 1]}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: heroTitleBottom - 26,
            height: 150,
          }}
        />

        {/* ── Hero bottom: kicker + italic title + coral squiggle ──
            box-none so the photos chip stays tappable while the texts
            let hero taps fall through to the album Pressable. Floats just
            above the collapsed sheet's top edge. */}
        <View
          style={[styles.heroBottom, { bottom: heroTitleBottom }]}
          pointerEvents="box-none"
        >
          {subtitle.length > 0 || album.length > 0 ? (
            <View style={styles.heroKickerRow} pointerEvents="box-none">
              <Text
                style={[
                  Type.kickerSm,
                  {
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: 10,
                    letterSpacing: 10 * 0.18,
                    flex: 1,
                    textShadowColor: 'rgba(0,0,0,0.4)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 8,
                  },
                ]}
                numberOfLines={1}
              >
                {subtitle.length > 0
                  ? `${(destination ?? '').toUpperCase()}${
                      destination && subtitle ? ' · ' : ''
                    }${subtitle.split(' · ')[0]?.toUpperCase()}`
                  : ''}
              </Text>
              {album.length > 0 ? (
                <Pressable
                  onPress={openAlbum}
                  accessibilityRole="button"
                  accessibilityLabel={`View all ${album.length} photos`}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.photosChip,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Images size={12} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.photosChipText}>{album.length}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 30,
              fontWeight: '500',
              letterSpacing: -30 * 0.02,
              color: '#FFFFFF',
              marginTop: 4,
              lineHeight: 32,
              // The hero now fills the screen, so the title floats over the
              // mid-photo (no dark scrim there) — a soft shadow keeps it
              // legible over any image, the Apple Photos overlay pattern.
              textShadowColor: 'rgba(0,0,0,0.45)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 12,
            }}
            numberOfLines={2}
          >
            {(() => {
              const titleWords = dayTitle.split(/\s+/);
              if (titleWords.length === 1) {
                return (
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {dayTitle}
                  </Text>
                );
              }
              const head = titleWords.slice(0, -1).join(' ');
              const tail = titleWords[titleWords.length - 1];
              return (
                <>
                  {head}{' '}
                  <Text
                    style={{
                      fontFamily: FontFamily.displayItalic,
                      fontStyle: 'italic',
                    }}
                  >
                    {tail}
                  </Text>
                </>
              );
            })()}
          </Text>
          <Squiggle width={120} color={colors.coral} style={{ marginTop: 4 }} />
        </View>
        </Animated.View>
      </GestureDetector>

      {/* ── Top bar — pinned above the hero AND the sheet via zIndex, so
          back / day-nav / share stay reachable even with the sheet expanded
          to 92%. box-none lets gap taps fall through to the hero album.
          insets.top, never a hardcoded offset. ── */}
      <View
        style={[styles.topBar, { top: insets.top + 4 }]}
        pointerEvents="box-none"
      >
          <CircleBtn
            solid
            onPress={onBack}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
          </CircleBtn>

          {/* Day navigator — chevron buttons flank the count, all in one
              glass pill so it reads as a single widget. Edge chevrons fade
              when there's no further day in that direction. */}
          <View style={styles.dayNav}>
            <Pressable
              onPress={() => goToDay(dayIndex - 1)}
              disabled={dayIndex <= 0}
              accessibilityLabel="Previous day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayNavBtn,
                {
                  opacity: dayIndex <= 0 ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronLeft size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
            <View style={styles.dayNavLabel}>
              {/* day.day (authoritative day number) drives the label, not
                  the filtered-array position. */}
              <Text style={styles.dayNavText}>{`Day ${day.day ?? dayIndex + 1} of ${numDays}`}</Text>
            </View>
            <Pressable
              onPress={() => goToDay(dayIndex + 1)}
              disabled={dayIndex >= numDays - 1}
              accessibilityLabel="Next day"
              hitSlop={6}
              style={({ pressed }) => [
                styles.dayNavBtn,
                {
                  opacity: dayIndex >= numDays - 1 ? 0.35 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={styles.topBarActions}>
            <CircleBtn
              solid
              onPress={onShare}
              accessibilityLabel="Share day"
            >
              <Share size={16} color={colors.ink} strokeWidth={2} />
            </CircleBtn>
            <CircleBtn
              solid
              onPress={onEdit}
              accessibilityLabel="Edit day"
            >
              <Pencil size={16} color={colors.ink} strokeWidth={2} />
            </CircleBtn>
          </View>
        </View>

      {/* ── SHEET — Apple Maps place-card. Drag between a 46% peek (the day's
          photo stays the hero) and a 92% near-full read; topInset clamps the
          top just below the Dynamic Island (numeric snaps don't clamp — the
          inset does). Replaces the old fixed static sheet whose grab handle
          was decorative and could never expand. ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={SHEET_SNAP_POINTS}
        topInset={insets.top + 10}
        // Explicit detents — opt out of v5's default content-fit sizing.
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        handleIndicatorStyle={[styles.grabHandle, { backgroundColor: colors.inkFaint }]}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.background }]}
        style={styles.sheetShadow}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
        {/* Keyed per day: directional fade-slide for the incoming day. */}
        <Animated.View key={`sheet-${dayIndex}`} entering={dayEntering}>
          {/* Bookings woven into the day — flights departing today, stays
              covering it. Renders nothing without a startDate or matches. */}
          <DayBookingsStrip
            bookings={bookings}
            tripStartDate={tripStartDate}
            dayIndex={storedDayIndex}
          />

          {/* Slot-grouped timeline — structured stops with dining woven in;
              legacy days fall back to chunked-prose slot rows inside. */}
          <DayTimeline
            day={day}
            dayNumber={dayNumber}
            diningGuide={diningGuide}
            destination={destination}
            morningImage={morningImage}
            afternoonImage={afternoonImage}
            eveningImage={eveningImage}
            stopPhotos={stopPhotos}
            photosLoading={photosLoading}
            onOpenPhoto={openAlbumAtPhoto}
            onOpenSlotPhotos={openSlotPhotos}
          />


          {/* Destination mini-map + open-in-Maps rows (renders nothing
              when the day has no named places) */}
          <DayMapStrip day={day} destination={destination} />

          {/* Pull quote — only when the itinerary actually has a tip */}
          {tip ? <PullQuote tip={tip} /> : null}

          {/* One-tap day rewrites — soft chips firing tweakDay; swaps to a
              "Rewriting this day…" pill while the server run is in flight. */}
          {tripId ? (
            <DayTweakChips
              tripId={tripId}
              // tweakDay addresses the STORED itinerary array server-side.
              dayIndex={storedDayIndex}
              isRewriting={isDayRewriting ?? false}
            />
          ) : null}

          {/* Tweak this day — AI chat scoped to this specific day */}
          {onTweakWithAI ? (
            <Pressable
              onPress={onTweakWithAI}
              style={({ pressed }) => [
                styles.aiCta,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={[styles.aiCtaIcon, { backgroundColor: colors.coralBg }]}>
                <Sparkles size={16} color={colors.coralDeep} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Type.kickerSm,
                    { color: colors.coralDeep, fontSize: 9, letterSpacing: 9 * 0.18 },
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
                    color: colors.ink,
                    marginTop: 2,
                    letterSpacing: -16 * 0.012,
                  }}
                >
                  Tweak this day
                </Text>
              </View>
              <Text
                style={[
                  Type.kickerSm,
                  { color: colors.inkMute, fontSize: 9 },
                ]}
              >
                CHAT →
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

export default React.memo(DayDetailScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Hero ─── full-screen photo behind the sheet; the visible band is
  // whatever the collapsed sheet doesn't cover.
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Above the gorhom sheet so the chrome never gets covered at 92%.
    zIndex: 30,
    elevation: 30,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 2,
  },
  dayNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavLabel: {
    paddingHorizontal: 4,
  },
  dayNavText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  aiCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  aiCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 18,
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Glass photos chip — same chrome vocabulary as the day-nav pill above.
  photosChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  photosChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },

  // ── Sheet ─── (gorhom BottomSheet chrome)
  // Soft warm shadow lifting the sheet off the photo (cast UP onto the hero).
  sheetShadow: {
    shadowColor: '#1F1A14',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetBg: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    paddingTop: 6,
    paddingHorizontal: 22,
  },
});

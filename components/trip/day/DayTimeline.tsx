import React, { useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily, type ThemeColors } from '@/constants/theme';
import {
  type ItineraryDay,
  type ItineraryStop,
  type StopSlot,
  type StopPhotoSet,
  type DiningGuide,
  type DiningSpot,
  stopsForSlot,
  hasStructuredStops,
  spotsForDayMeal,
  photosForStop,
  chunkProse,
} from '@/types/itinerary';
import {
  StopPhotoStrip,
  StopPhotoStripSkeleton,
  type StripPhoto,
} from '@/components/trip/day/StopPhotoStrip';
import { openInMaps } from '@/utils/maps';
import { hapticSelect } from '@/utils/haptics';

// ─────────────────────────────────────────────────────────────────
// DayTimeline
//
// Slot-grouped day timeline — keeps the screen's coral-rail DNA (the
// vertical coralSoft rail + coral dots from the old StopList) but groups
// the day into MORNING / AFTERNOON / EVENING sections, each with a mono
// kicker header, connective slot prose, and one row per structured stop.
// Dining-guide suggestions are woven in: a LUNCH mini-section after the
// morning block and a DINNER one after the evening block, visually
// quieter (russet `dining` token, tinted cards) than the itinerary rows.
//
// Legacy trips (no `stops` on the day) fall back per slot to the old
// single-row rendering — place name as the title — with the prose split
// into 2-sentence paragraphs via chunkProse, which alone fixes the
// wall-of-text those trips used to show.
// ─────────────────────────────────────────────────────────────────

/** Per-slot activity image — same shape DayDetailScreen already threads
 *  down from the trip doc (`activityImages[dayIndex * 3 + slotIndex]`). */
export type SlotImage = {
  url: string;
  thumb: string;
  credit: string;
  source: string;
} | null;

interface DayTimelineProps {
  day: ItineraryDay;
  /** Authoritative 1-based day number (`day.day`) — the stopPhotos key. */
  dayNumber: number;
  /** Parsed `trips.diningGuide` — lunch/dinner inserts hide entirely when
   *  null or when no spot matches this day+meal (no empty headers). */
  diningGuide: DiningGuide | null;
  /** Trip destination country — disambiguates the Maps search with the
   *  COUNTRY only, not the capital (see DayMapStrip for the rationale). */
  destination?: string;
  morningImage: SlotImage;
  afternoonImage: SlotImage;
  eveningImage: SlotImage;
  /** Parsed `trips.stopPhotos` — drives the per-slot photo strips. Absent
   *  (pre-feature trip, fetch in flight) → strips simply don't render. */
  stopPhotos?: StopPhotoSet[];
  /** True while the trip's stop photos are still being fetched (the trip is
   *  loaded, not generating, but `stopPhotos` hasn't landed). Slots with
   *  places show a shimmer skeleton instead of a bare gap. */
  photosLoading?: boolean;
  /** Open the day album at a tapped strip photo (matched by url). */
  onOpenPhoto?: (url: string) => void;
  /** Open the day album at a slot's first photo (header thumb tap). */
  onOpenSlotPhotos?: (slot: StopSlot) => void;
}

// Legacy fixed times — the pre-structured-stops day screen hardcoded
// these on its three rows; legacy days keep them so nothing regresses.
const SLOT_META: {
  slot: StopSlot;
  /** Editorial section title (title-case) — the scannable "chapter" header. */
  label: string;
  fallbackTime: string;
}[] = [
  { slot: 'morning', label: 'Morning', fallbackTime: '09:30' },
  { slot: 'afternoon', label: 'Afternoon', fallbackTime: '13:00' },
  { slot: 'evening', label: 'Evening', fallbackTime: '18:30' },
];

const SLOT_PLACE: Record<StopSlot, 'morningPlace' | 'afternoonPlace' | 'eveningPlace'> = {
  morning: 'morningPlace',
  afternoon: 'afternoonPlace',
  evening: 'eveningPlace',
};

// Dot column geometry — shared with the rail so dots sit centred on it.
// Rail at left 7 (width 2) → centre x = 8; the 16px slot dot spans 0-16,
// the 8px stop dot is centred inside the same 16px column.
const DOT_COL = 16;
const ROW_GAP = 14;
const CONTENT_INSET = DOT_COL + ROW_GAP;

function countWord(n: number): string {
  return n === 1 ? 'ONE IDEA' : 'TWO IDEAS';
}

// ── Stop row (structured days) ───────────────────────────────────

function StopRow({
  stop,
  onPress,
  colors,
}: {
  stop: ItineraryStop;
  onPress: (name: string) => void;
  colors: ThemeColors;
}) {
  // Meta kicker: only the fields the LLM actually emitted — no blank
  // separators. kickerSm uppercases, so "1½ hrs" renders as "1½ HRS".
  const meta = [stop.time, stop.duration, stop.kind]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join(' · ');
  const note = stop.note.trim();
  const area = (stop.area ?? '').trim();
  const tip = (stop.tip ?? '').trim();

  return (
    <Pressable
      onPress={() => onPress(stop.name)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${stop.name} in Maps`}
      style={({ pressed }) => [styles.stopRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.stopDotCol}>
        <View style={[styles.stopDot, { backgroundColor: colors.coral }]} />
      </View>
      <View style={{ flex: 1 }}>
        {meta ? (
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
            {meta}
          </Text>
        ) : null}
        <Text style={[Type.title17, { color: colors.ink, marginTop: 2 }]}>
          {stop.name}
        </Text>
        {/* Specific micro-location — reads as a real address hint, the
            "where exactly" the user asked for. */}
        {area ? (
          <View style={styles.areaRow}>
            <MapPin size={11} color={colors.inkMute} strokeWidth={2} />
            <Text
              style={[Type.meta11, { color: colors.inkMute, flex: 1 }]}
              numberOfLines={1}
            >
              {area}
            </Text>
          </View>
        ) : null}
        {note ? (
          <Text
            style={[
              Type.body12_5,
              { color: colors.inkMute, lineHeight: 18, marginTop: 4 },
            ]}
          >
            {note}
          </Text>
        ) : null}
        {/* One concrete, actionable tip — the named dish / gate / viewpoint. */}
        {tip ? (
          <View style={styles.tipRow}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.coralDeep, fontSize: 8, letterSpacing: 8 * 0.14, marginTop: 3 },
              ]}
            >
              TIP
            </Text>
            <Text
              style={[
                Type.body12_5,
                { color: colors.inkSoft, lineHeight: 18, flex: 1 },
              ]}
            >
              {tip}
            </Text>
          </View>
        ) : null}
        {/* Soft pill per house rule — same-token text on a matching bg tint,
            no leading dot. Mirrors the dining "RESERVE AHEAD" pill. */}
        {stop.reserveAhead ? (
          <View style={[styles.reservePill, { backgroundColor: colors.goldSoft }]}>
            <Text
              style={[
                Type.kickerSm,
                { color: colors.gold, fontSize: 8, letterSpacing: 8 * 0.14 },
              ]}
            >
              RESERVE AHEAD
            </Text>
          </View>
        ) : null}
      </View>
      {/* Same trailing-affordance vocabulary as DayMapStrip's rows and the
          screen's "CHAT →" CTA — the row is live, so it earns the arrow. */}
      <Text
        style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9, marginTop: 1 }]}
      >
        MAPS →
      </Text>
    </Pressable>
  );
}

// ── Dining insert (lunch / dinner mini-section) ──────────────────

function DiningInsert({
  meal,
  spots,
  destination,
  colors,
}: {
  meal: 'lunch' | 'dinner';
  spots: DiningSpot[];
  destination?: string;
  colors: ThemeColors;
}) {
  const onOpen = useCallback(
    (spot: DiningSpot) => {
      hapticSelect();
      void openInMaps({
        name: spot.name,
        location: [spot.area, destination].filter(Boolean).join(', '),
      });
    },
    [destination],
  );

  if (spots.length === 0) return null;

  return (
    <View style={styles.diningSection}>
      <Text style={[Type.kickerSm, { color: colors.dining, fontSize: 9 }]}>
        {meal === 'lunch' ? 'LUNCH' : 'DINNER'} · {countWord(spots.length)}
      </Text>
      {spots.map((spot, i) => (
        <Pressable
          key={`${spot.name}-${i}`}
          onPress={() => onOpen(spot)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${spot.name} in Maps`}
          style={({ pressed }) => [
            styles.diningCard,
            { backgroundColor: colors.diningBg, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FontFamily.semibold,
                fontSize: 13.5,
                letterSpacing: -0.1,
                color: colors.ink,
              }}
              numberOfLines={1}
            >
              {spot.name}
            </Text>
            <Text
              style={[Type.meta11, { color: colors.inkMute, marginTop: 2 }]}
              numberOfLines={1}
            >
              {[spot.cuisine, spot.price, spot.area].filter(Boolean).join(' · ')}
            </Text>
            {spot.reserveAhead ? (
              // Soft pill per house rule: same-token text on the matching
              // bg tint, no leading dot.
              <View style={[styles.reservePill, { backgroundColor: colors.goldSoft }]}>
                <Text
                  style={[
                    Type.kickerSm,
                    { color: colors.gold, fontSize: 8, letterSpacing: 8 * 0.14 },
                  ]}
                >
                  RESERVE AHEAD
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.diningDeep, fontSize: 9, marginTop: 2 },
            ]}
          >
            MAPS →
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Slot header (shared by structured + legacy sections) ─────────

function SlotHeader({
  label,
  time,
  thumbUri,
  onPressThumb,
  colors,
  children,
}: {
  /** Title-case section title, e.g. "Morning". */
  label: string;
  /** 24h start time for the section, e.g. "10:00". */
  time: string;
  thumbUri?: string;
  /** When given, the thumb opens the day album at this slot's photos. */
  onPressThumb?: () => void;
  colors: ThemeColors;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.slotHeaderRow}>
      <View
        style={[
          styles.slotDot,
          {
            backgroundColor: colors.coral,
            shadowColor: colors.coral,
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        {/* Editorial chapter header — Fraunces italic title + coral period,
            with a quiet mono time accent. Makes Morning / Afternoon / Evening
            scan as distinct sections instead of small mono kickers. */}
        <View style={styles.slotTitleRow}>
          <Text style={[styles.slotTitle, { color: colors.ink }]}>
            {label}
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          <Text style={[Type.kicker, { color: colors.coralDeep, fontSize: 9.5, marginLeft: 8 }]}>
            {time}
          </Text>
        </View>
        {children}
      </View>
      {thumbUri ? (
        onPressThumb ? (
          <Pressable
            onPress={onPressThumb}
            accessibilityRole="imagebutton"
            accessibilityLabel="View photos for this part of the day"
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Image source={{ uri: thumbUri }} style={styles.slotThumb} />
          </Pressable>
        ) : (
          <Image source={{ uri: thumbUri }} style={styles.slotThumb} />
        )
      ) : null}
    </View>
  );
}

// ── Main timeline ────────────────────────────────────────────────

export function DayTimeline({
  day,
  dayNumber,
  diningGuide,
  destination,
  morningImage,
  afternoonImage,
  eveningImage,
  stopPhotos,
  photosLoading,
  onOpenPhoto,
  onOpenSlotPhotos,
}: DayTimelineProps) {
  const { colors } = useTheme();
  const structured = hasStructuredStops(day);

  const slotImages: Record<StopSlot, SlotImage> = {
    morning: morningImage,
    afternoon: afternoonImage,
    evening: eveningImage,
  };

  const openStop = useCallback(
    (name: string) => {
      hapticSelect();
      // COUNTRY only, not the capital — the day may be in another city
      // (a Kyoto day on a Japan trip); same rationale as DayMapStrip.
      void openInMaps({ name, location: destination });
    },
    [destination],
  );

  const lunch = spotsForDayMeal(diningGuide, day.day, 'lunch').slice(0, 2);
  const dinner = spotsForDayMeal(diningGuide, day.day, 'dinner').slice(0, 2);

  const sections: React.ReactNode[] = [];

  for (const { slot, label, fallbackTime } of SLOT_META) {
    // Slot names double as the day's prose keys (morning/afternoon/evening).
    const prose = (day[slot] ?? '').trim();
    const place = (day[SLOT_PLACE[slot]] ?? '').trim();
    const stops = structured ? stopsForSlot(day, slot) : [];
    const thumb = slotImages[slot];
    const thumbUri = thumb?.thumb || thumb?.url || undefined;

    // Real place photos for this slot's stops (legacy days: the slot's
    // anchor place), in stop order — the Apple Maps place-card photo row.
    const stripPhotos: StripPhoto[] =
      stopPhotos && stopPhotos.length > 0
        ? (stops.length > 0 ? stops.map((s) => s.name) : place ? [place] : []).flatMap(
            (name) =>
              photosForStop(stopPhotos, dayNumber, name).map((p) => ({
                url: p.url,
                thumb: p.thumb,
                name,
              })),
          )
        : [];
    const slotHasPlaces = stops.length > 0 || place.length > 0;
    const strip =
      stripPhotos.length > 0 && onOpenPhoto ? (
        <StopPhotoStrip
          photos={stripPhotos}
          insetLeft={CONTENT_INSET}
          onOpenPhoto={onOpenPhoto}
        />
      ) : photosLoading && slotHasPlaces ? (
        // Photos still fetching — shimmer in place so the slot reads as
        // loading rather than empty.
        <StopPhotoStripSkeleton insetLeft={CONTENT_INSET} />
      ) : null;
    const onPressThumb = onOpenSlotPhotos ? () => onOpenSlotPhotos(slot) : undefined;

    if (structured && (stops.length > 0 || prose.length > 0)) {
      // Header time comes from the slot's first stop; days whose stops
      // carry no times fall back to the legacy fixed times.
      const headerTime = stops[0]?.time?.trim() || fallbackTime;
      sections.push(
        <View key={slot} style={styles.slotSection}>
          <SlotHeader
            label={label}
            time={headerTime}
            thumbUri={thumbUri}
            onPressThumb={onPressThumb}
            colors={colors}
          >
            {/* Chunk the connective prose into ≤2-sentence paragraphs (same
                treatment legacy days already get) so the slot intro reads as
                breathable blocks, not one dense run. */}
            {prose
              ? chunkProse(prose, 2).map((p, i) => (
                  <Text
                    key={i}
                    style={[
                      Type.body13,
                      { color: colors.inkSoft, marginTop: i === 0 ? 4 : 8 },
                    ]}
                  >
                    {p}
                  </Text>
                ))
              : null}
          </SlotHeader>
          {stops.map((stop, i) => (
            <StopRow
              key={`${slot}-${i}-${stop.name}`}
              stop={stop}
              onPress={openStop}
              colors={colors}
            />
          ))}
          {strip}
        </View>,
      );
    } else if (!structured && (prose.length > 0 || place.length > 0)) {
      // Legacy day — one row per slot, same shape the old StopList drew:
      // place name as the italic title, prose below. chunkProse splits the
      // old wall-of-text into 2-sentence paragraphs.
      const fallbackTitle = prose.split('.')[0].trim().slice(0, 50);
      const title = place || fallbackTitle;
      const paragraphs = prose === place ? [] : chunkProse(prose, 2);
      sections.push(
        <View key={slot} style={styles.slotSection}>
          <SlotHeader
            label={label}
            time={fallbackTime}
            thumbUri={thumbUri}
            onPressThumb={onPressThumb}
            colors={colors}
          >
            <Text style={[Type.title17, { color: colors.ink, marginTop: 2 }]}>
              {title}
            </Text>
            {paragraphs.map((p, i) => (
              <Text
                key={i}
                style={[
                  Type.body12_5,
                  {
                    color: colors.inkMute,
                    lineHeight: 18,
                    marginTop: i === 0 ? 4 : 8,
                  },
                ]}
              >
                {p}
              </Text>
            ))}
          </SlotHeader>
          {strip}
        </View>,
      );
    }

    // Dining woven in: lunch after the morning block, dinner after the
    // evening block. Renders nothing when the guide has no match.
    if (slot === 'morning' && lunch.length > 0) {
      sections.push(
        <DiningInsert
          key="lunch"
          meal="lunch"
          spots={lunch}
          destination={destination}
          colors={colors}
        />,
      );
    }
    if (slot === 'evening' && dinner.length > 0) {
      sections.push(
        <DiningInsert
          key="dinner"
          meal="dinner"
          spots={dinner}
          destination={destination}
          colors={colors}
        />,
      );
    }
  }

  if (sections.length === 0) return null;

  return (
    <View style={{ position: 'relative' }}>
      {/* Vertical rail — same coralSoft rail the old StopList drew, running
          past the dining inserts so they read as woven into the day. */}
      <View
        style={[
          styles.rail,
          { backgroundColor: colors.coralSoft },
        ]}
      />
      {sections}
    </View>
  );
}

export default DayTimeline;

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 7,
    top: 18,
    bottom: 18,
    width: 2,
  },
  slotSection: {
    // More air between Morning / Afternoon / Evening so they read as
    // distinct chapters, not one continuous column.
    paddingTop: 16,
    paddingBottom: 8,
  },
  slotTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 1,
  },
  slotTitle: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -19 * 0.014,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
    alignItems: 'flex-start',
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ROW_GAP,
    paddingVertical: 2,
  },
  // 16px coral dot with glow — identical to the old StopList dots, so the
  // screen still feels like itself.
  slotDot: {
    width: DOT_COL,
    height: DOT_COL,
    borderRadius: DOT_COL / 2,
    marginTop: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 0,
  },
  slotThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  stopRow: {
    flexDirection: 'row',
    gap: ROW_GAP,
    paddingVertical: 10,
  },
  stopDotCol: {
    width: DOT_COL,
    alignItems: 'center',
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  diningSection: {
    marginLeft: CONTENT_INSET,
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  diningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
  },
  reservePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
});

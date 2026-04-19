import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ImageBackground,
  Pressable,
  type ColorValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  MapPin,
  Sunrise,
  Sun,
  Moon,
  Clock,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import CircleIconButton from '@/components/ui/CircleIconButton';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, FontSize, Spacing, Radius, Shadows } from '@/constants/theme';

export interface DayDetailDay {
  day: number;
  title: string;
  morning: string;
  morningPlace?: string;
  afternoon: string;
  afternoonPlace?: string;
  evening: string;
  eveningPlace?: string;
  tip: string;
}

type DayImage = { url: string; credit?: string; creditUrl?: string } | null;
type ActivityImage = { url: string; thumb: string; credit: string; source: string } | null;

interface DayDetailScreenProps {
  day: DayDetailDay;
  dayIndex: number;
  numDays: number;
  heroImage: DayImage;
  morningImage: ActivityImage;
  afternoonImage: ActivityImage;
  eveningImage: ActivityImage;
  destination?: string;
  tripStartDate?: string;
  onBack: () => void;
  onShare: () => void;
  onNavigateDay: (newIndex: number) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// 52% of screen height — large enough to be immersive, leaves breathing room
// for the overlapping stats row below.
const HERO_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;
const VELOCITY_THRESHOLD = 550;
// Landscape activity image — wide cinematic ratio instead of cramped thumbnails.
const ACTIVITY_IMAGE_HEIGHT = Math.round(SCREEN_WIDTH * 0.52);

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface TimeSlotConfig {
  icon: LucideIcon;
  label: string;
  hint: string;
}

const TIME_SLOT_CONFIG: Record<TimeSlot, TimeSlotConfig> = {
  morning: { icon: Sunrise, label: 'Morning', hint: 'Start the day' },
  afternoon: { icon: Sun, label: 'Afternoon', hint: 'Peak hours' },
  evening: { icon: Moon, label: 'Evening', hint: 'Wind down' },
};

function formatDate(start: string | undefined, offset: number): string | undefined {
  if (!start) return undefined;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + offset);
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

// ── StatPill ─────────────────────────────────────────────────────────
// Small badge used in the overlapping stats row. Icon + text on a card
// background with a soft shadow. Bridges the hero and body visually.
interface StatPillProps {
  icon: LucideIcon;
  label: string;
  cardColor: ColorValue;
  iconColor: ColorValue;
  textColor: ColorValue;
}

function StatPill({ icon: Icon, label, cardColor, iconColor, textColor }: StatPillProps) {
  return (
    <View style={[styles.statPill, Shadows.card, { backgroundColor: cardColor }]}>
      <Icon size={13} color={iconColor} />
      <Text style={[styles.statPillText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ── ActivitySlot ─────────────────────────────────────────────────────
// Editorial section for one time slot. Icon header, large landscape
// image, serif description, place chip. Stacks vertically like a
// magazine layout.
interface ActivitySlotProps {
  timeSlot: TimeSlot;
  description: string;
  place?: string;
  imageUrl?: string;
  cardBg: ColorValue;
  textColor: ColorValue;
  mutedColor: ColorValue;
  iconBg: ColorValue;
  placeholderBg: ColorValue;
}

function ActivitySlot({
  timeSlot,
  description,
  place,
  imageUrl,
  cardBg,
  textColor,
  mutedColor,
  iconBg,
  placeholderBg,
}: ActivitySlotProps) {
  const { icon: Icon, label, hint } = TIME_SLOT_CONFIG[timeSlot];

  return (
    <View style={styles.activityWrapper}>
      {/* ── Time header row ─── */}
      <View style={styles.timeHeader}>
        <View style={[styles.timeIconWrap, { backgroundColor: iconBg }]}>
          <Icon size={15} color={textColor} />
        </View>
        <View style={styles.timeTextBlock}>
          <Text style={[styles.timeLabel, { color: textColor }]}>{label}</Text>
          <Text style={[styles.timeHint, { color: mutedColor }]}>{hint}</Text>
        </View>
      </View>

      {/* ── Activity card ─── */}
      <View style={[styles.activityCard, Shadows.card, { backgroundColor: cardBg }]}>
        {imageUrl ? (
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.activityImage}
            imageStyle={styles.activityImageRadii}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.activityImage, styles.activityImageRadii, { backgroundColor: placeholderBg }]} />
        )}

        <View style={styles.activityBody}>
          <Text style={[styles.activityDescription, { color: textColor }]}>
            {description}
          </Text>
          {place ? (
            <View style={[styles.placeChip, { backgroundColor: iconBg }]}>
              <MapPin size={11} color={mutedColor} />
              <Text
                style={[styles.placeChipText, { color: mutedColor }]}
                numberOfLines={1}
              >
                {place}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── DayNavButton ─────────────────────────────────────────────────────
// Prev / next day navigation. Pressable chip with day number and chevron.
interface DayNavButtonProps {
  direction: 'prev' | 'next';
  dayNumber: number;
  onPress: () => void;
  cardBg: ColorValue;
  textColor: ColorValue;
  mutedColor: ColorValue;
}

function DayNavButton({
  direction,
  dayNumber,
  onPress,
  cardBg,
  textColor,
  mutedColor,
}: DayNavButtonProps) {
  const isPrev = direction === 'prev';
  const Icon = isPrev ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Go to day ${dayNumber}`}
      style={({ pressed }) => [
        styles.dayNavButton,
        Shadows.card,
        { backgroundColor: cardBg, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {isPrev ? <Icon size={16} color={textColor} /> : null}
      <View style={styles.dayNavTextBlock}>
        <Text style={[styles.dayNavHint, { color: mutedColor }]}>
          {isPrev ? 'Previous' : 'Next'}
        </Text>
        <Text style={[styles.dayNavLabel, { color: textColor }]}>{`Day ${dayNumber}`}</Text>
      </View>
      {!isPrev ? <Icon size={16} color={textColor} /> : null}
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────
function DayDetailScreen({
  day,
  dayIndex,
  numDays,
  heroImage,
  morningImage,
  afternoonImage,
  eveningImage,
  destination,
  tripStartDate,
  onBack,
  onShare,
  onNavigateDay,
}: DayDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const go = useCallback(
    (dir: 1 | -1) => {
      if (numDays <= 1) return;
      const next = (dayIndex + dir + numDays) % numDays;
      Haptics.selectionAsync().catch(() => {});
      onNavigateDay(next);
    },
    [dayIndex, numDays, onNavigateDay],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-12, 12])
        .onEnd((e) => {
          const past = Math.abs(e.translationX) > SWIPE_THRESHOLD;
          const fast = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
          if (past || fast) {
            const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
            runOnJS(go)(dir);
          }
        }),
    [go],
  );

  const place = day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace ?? destination;
  const dateLabel = formatDate(tripStartDate, dayIndex);

  const prevIdx = (dayIndex - 1 + numDays) % numDays;
  const nextIdx = (dayIndex + 1) % numDays;
  const showDayNav = numDays > 1;

  // Count of filled time slots — used in the stats pill.
  const filledSlots = [day.morning, day.afternoon, day.evening].filter((s) => s.trim().length > 0).length;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces
        >
          {/* ────────────── HERO ────────────── */}
          <View style={[styles.heroContainer, { height: HERO_HEIGHT }]}>
            {heroImage?.url ? (
              <ImageBackground
                source={{ uri: heroImage.url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              >
                {/* Photo-overlay rgba values below are an intentional exception per
                    the spec — dark scrim for text legibility and a long fade into
                    the body background for a magazine-style transition. */}
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0.4)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0.55)',
                    colors.background,
                  ]}
                  locations={[0, 0.2, 0.4, 0.82, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </ImageBackground>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundDeep }]} />
            )}

            {/* Top nav buttons */}
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
              <CircleIconButton
                icon={ChevronLeft}
                accessibilityLabel="Go back"
                onPress={onBack}
                iconSize={22}
              />
              <CircleIconButton
                icon={Share2}
                accessibilityLabel="Share day"
                onPress={onShare}
                iconSize={18}
              />
            </View>

            {/* Hero overlay: day pill, editorial title, place */}
            <View style={styles.heroOverlay}>
              <View style={styles.dayPill}>
                <Text style={[styles.dayPillText, { color: colors.textOnLight }]}>
                  {dateLabel ? `DAY ${day.day} · ${dateLabel}` : `DAY ${day.day}`}
                </Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85}>
                {day.title}
              </Text>
              {place ? (
                <View style={styles.heroPlaceRow}>
                  <MapPin size={13} color="#FFFFFF" />
                  <Text style={styles.heroPlaceText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ────────────── OVERLAPPING STATS ROW ────────────── */}
          {/* Floats over the hero/body boundary for a premium magazine transition. */}
          <View style={styles.statsRow}>
            <StatPill
              icon={Clock}
              label={`Day ${day.day} of ${numDays}`}
              cardColor={colors.card}
              iconColor={colors.foreground}
              textColor={colors.foreground}
            />
            {filledSlots > 0 ? (
              <StatPill
                icon={Sparkles}
                label={`${filledSlots} ${filledSlots === 1 ? 'moment' : 'moments'}`}
                cardColor={colors.card}
                iconColor={colors.foreground}
                textColor={colors.foreground}
              />
            ) : null}
            {destination ? (
              <StatPill
                icon={MapPin}
                label={destination}
                cardColor={colors.card}
                iconColor={colors.foreground}
                textColor={colors.foreground}
              />
            ) : null}
          </View>

          {/* ────────────── BODY ────────────── */}
          <View style={styles.body}>
            {day.morning.trim().length > 0 ? (
              <ActivitySlot
                timeSlot="morning"
                description={day.morning}
                place={day.morningPlace}
                imageUrl={morningImage?.url}
                cardBg={colors.card}
                textColor={colors.foreground}
                mutedColor={colors.textMuted}
                iconBg={colors.surfaceMuted}
                placeholderBg={colors.surfaceMuted}
              />
            ) : null}
            {day.afternoon.trim().length > 0 ? (
              <ActivitySlot
                timeSlot="afternoon"
                description={day.afternoon}
                place={day.afternoonPlace}
                imageUrl={afternoonImage?.url}
                cardBg={colors.card}
                textColor={colors.foreground}
                mutedColor={colors.textMuted}
                iconBg={colors.surfaceMuted}
                placeholderBg={colors.surfaceMuted}
              />
            ) : null}
            {day.evening.trim().length > 0 ? (
              <ActivitySlot
                timeSlot="evening"
                description={day.evening}
                place={day.eveningPlace}
                imageUrl={eveningImage?.url}
                cardBg={colors.card}
                textColor={colors.foreground}
                mutedColor={colors.textMuted}
                iconBg={colors.surfaceMuted}
                placeholderBg={colors.surfaceMuted}
              />
            ) : null}

            {/* ── Local tip pull-quote ── */}
            {day.tip ? (
              <View style={styles.tipWrapper}>
                <View style={[styles.tipAccent, { backgroundColor: colors.foreground }]} />
                <View style={styles.tipBody}>
                  <Text style={[styles.tipLabel, { color: colors.textMuted }]}>LOCAL TIP</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary ?? colors.foreground }]}>
                    {day.tip}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ── Day navigator ── */}
            {showDayNav ? (
              <View style={styles.dayNavRow}>
                <DayNavButton
                  direction="prev"
                  dayNumber={prevIdx + 1}
                  onPress={() => onNavigateDay(prevIdx)}
                  cardBg={colors.card}
                  textColor={colors.foreground}
                  mutedColor={colors.textMuted}
                />
                <DayNavButton
                  direction="next"
                  dayNumber={nextIdx + 1}
                  onPress={() => onNavigateDay(nextIdx)}
                  cardBg={colors.card}
                  textColor={colors.foreground}
                  mutedColor={colors.textMuted}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </GestureDetector>
  );
}

export default React.memo(DayDetailScreen);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 56 },

  // ── Hero ───
  heroContainer: {
    width: '100%',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroOverlay: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 72, // leave room for the overlapping stats row
  },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 14,
  },
  dayPillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 42,
    lineHeight: 44,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  heroPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  heroPlaceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    opacity: 0.96,
  },

  // ── Stats row (overlaps hero/body) ───
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    marginTop: -28,
    marginBottom: Spacing.xl,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full ?? 999,
  },
  statPillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.4,
  },

  // ── Body ───
  body: {
    paddingHorizontal: Spacing.lg,
  },

  // ── Activity slot ───
  activityWrapper: {
    marginBottom: Spacing.xl,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.md,
  },
  timeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeTextBlock: {
    flex: 1,
  },
  timeLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
  },
  timeHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  activityCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: ACTIVITY_IMAGE_HEIGHT,
  },
  activityImageRadii: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  activityBody: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  activityDescription: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  placeChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full ?? 999,
    maxWidth: '100%',
  },
  placeChipText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  // ── Tip pull-quote ───
  tipWrapper: {
    flexDirection: 'row',
    gap: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingLeft: 2,
  },
  tipAccent: {
    width: 2.5,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  tipBody: {
    flex: 1,
    paddingVertical: 2,
  },
  tipLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  tipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ── Day navigator ───
  dayNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.sm,
  },
  dayNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.lg,
  },
  dayNavTextBlock: {
    flex: 1,
  },
  dayNavHint: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  dayNavLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.base,
    letterSpacing: -0.1,
    marginTop: 1,
  },
});

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Share2, MapPin, Lightbulb } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ActivityCard from '@/components/trip/ActivityCard';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 340;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;
const VELOCITY_THRESHOLD = 550;

function formatDate(start: string | undefined, offset: number): string | undefined {
  if (!start) return undefined;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + offset);
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

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

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces
        >
          <View style={styles.heroContainer}>
            {heroImage?.url ? (
              <ImageBackground
                source={{ uri: heroImage.url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              >
                {/* Photo-overlay rgba values below are an intentional exception per the
                    itinerary-deck spec — dark scrim is required for text legibility on
                    any hero image (Airbnb-style pattern). */}
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0.35)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0.4)',
                    colors.background,
                  ]}
                  locations={[0, 0.22, 0.45, 0.75, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </ImageBackground>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceLight }]} />
            )}

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

            <View style={styles.heroOverlay}>
              <View style={styles.dayPill}>
                <Text style={[styles.dayPillText, { color: colors.textOnLight }]}>
                  {dateLabel ? `DAY ${day.day} · ${dateLabel}` : `DAY ${day.day}`}
                </Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={3}>
                {day.title}
              </Text>
              {place ? (
                <View style={styles.heroPlaceRow}>
                  <MapPin size={14} color="#FFFFFF" />
                  <Text style={styles.heroPlaceText} numberOfLines={1}>
                    {place}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.body}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>YOUR DAY</Text>
            <View style={{ gap: Spacing.sm }}>
              <ActivityCard
                timeSlot="morning"
                description={day.morning}
                placeName={day.morningPlace}
                imageUrl={morningImage?.url}
              />
              <ActivityCard
                timeSlot="afternoon"
                description={day.afternoon}
                placeName={day.afternoonPlace}
                imageUrl={afternoonImage?.url}
              />
              <ActivityCard
                timeSlot="evening"
                description={day.evening}
                placeName={day.eveningPlace}
                imageUrl={eveningImage?.url}
              />
            </View>

            {day.tip ? (
              <View
                style={[
                  styles.tipCard,
                  Shadows.subtle,
                  { backgroundColor: colors.surfaceLight },
                ]}
              >
                <Lightbulb size={14} color={colors.textMuted} />
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>{day.tip}</Text>
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
  scrollContent: { paddingBottom: 48 },
  heroContainer: {
    height: HERO_HEIGHT,
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
    bottom: 28,
  },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  dayPillText: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  heroPlaceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    opacity: 0.96,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    marginTop: -8,
  },
  sectionLabel: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  tipText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 20,
  },
});

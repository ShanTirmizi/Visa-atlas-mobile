import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { GlassPill } from '@/components/ui/GlassPill';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { StopList, type Stop } from '@/components/trip/day/StopList';
import { PullQuote } from '@/components/trip/day/PullQuote';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';

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
  /** Optional: explicit local tip for PullQuote (falls back to `tip`) */
  localTip?: string;
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

const HERO_HEIGHT = 280;
const SHEET_TOP = 260;

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

function buildStops(day: DayDetailDay, morningImg: ActivityImage, afternoonImg: ActivityImage, eveningImg: ActivityImage): Stop[] {
  const stops: Stop[] = [];

  if (day.morning.trim().length > 0) {
    stops.push({
      title: day.morningPlace ?? day.morning.split('.')[0].trim().slice(0, 50),
      meta: 'Morning',
      thumbUri: morningImg?.thumb || morningImg?.url,
    });
  }
  if (day.afternoon.trim().length > 0) {
    stops.push({
      title: day.afternoonPlace ?? day.afternoon.split('.')[0].trim().slice(0, 50),
      meta: 'Afternoon',
      thumbUri: afternoonImg?.thumb || afternoonImg?.url,
    });
  }
  if (day.evening.trim().length > 0) {
    stops.push({
      title: day.eveningPlace ?? day.evening.split('.')[0].trim().slice(0, 50),
      meta: 'Evening',
      thumbUri: eveningImg?.thumb || eveningImg?.url,
    });
  }

  return stops;
}

function deriveTip(day: DayDetailDay): string {
  if (day.localTip && day.localTip.trim().length > 0) return day.localTip;
  if (day.tip && day.tip.trim().length > 0) return day.tip;

  const firstStop = day.morningPlace ?? day.afternoonPlace ?? day.eveningPlace;
  if (firstStop) {
    return `Visit ${firstStop} before 9 AM for quiet photos — crowds arrive by 10.`;
  }
  return 'Explore local neighbourhoods early in the morning to avoid the crowds.';
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
  numDays,
  heroImage,
  morningImage,
  afternoonImage,
  eveningImage,
  destination,
  tripStartDate,
  onBack,
}: DayDetailScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const stops = useMemo(
    () => buildStops(day, morningImage, afternoonImage, eveningImage),
    [day, morningImage, afternoonImage, eveningImage],
  );

  const dayTitle = useMemo(() => deriveDayTitle(day), [day]);
  const subtitle = useMemo(
    () => formatDaySubtitle(tripStartDate, dayIndex, stops.length),
    [tripStartDate, dayIndex, stops.length],
  );
  const tip = useMemo(() => deriveTip(day), [day]);
  const heroTone = useMemo(() => heroToneFromDestination(destination), [destination]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HERO (fixed, not scrollable) ────────────────────────────── */}
      <View style={styles.hero}>
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

        {/* ── Top bar (52px from top, 18px horizontal) ── */}
        <View style={[styles.topBar, { top: 52 }]}>
          <CircleBtn
            solid
            onPress={onBack}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
          </CircleBtn>

          <GlassPill>{`Day ${dayIndex + 1} of ${numDays}`}</GlassPill>

          <CircleBtn
            solid
            onPress={undefined}
            accessibilityLabel="More options"
          >
            <MoreHorizontal size={18} color={colors.ink} strokeWidth={2.2} />
          </CircleBtn>
        </View>

        {/* ── Hero bottom: title + subtitle ── */}
        <View style={styles.heroBottom}>
          <Text style={[Type.display26, { color: '#FFFFFF' }]} numberOfLines={2}>
            {dayTitle}
          </Text>
          {subtitle.length > 0 ? (
            <Text
              style={[
                Type.body13,
                { color: '#FFFFFF', opacity: 0.85, marginTop: 6 },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── SHEET (overlaps hero from top 260) ─────────────────────── */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            top: SHEET_TOP,
          },
        ]}
      >
        {/* Grab handle */}
        <View style={styles.grabHandleWrapper}>
          <View
            style={[
              styles.grabHandle,
              { backgroundColor: colors.inkFaint, opacity: 0.5 },
            ]}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Stop list */}
          {stops.length > 0 ? <StopList stops={stops} /> : null}

          {/* Pull quote */}
          <PullQuote tip={tip} />
        </ScrollView>
      </View>
    </View>
  );
}

export default React.memo(DayDetailScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Hero ───
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBottom: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 18,
  },

  // ── Sheet ───
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grabHandleWrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetContent: {
    paddingTop: 10,
    paddingHorizontal: 22,
  },
});

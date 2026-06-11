/**
 * Your Passport — the stamp wall.
 *
 * Pays off the home empty state's promise ("Your passport is stampless...")
 * once trips are behind you: every completed trip (or one whose end date has
 * passed) earns an engraved entry stamp on a 2-column wall, with a travel
 * record — countries / days / trips — above it in the onboarding "YOUR
 * ACCESS" metrics style.
 *
 * Stamps derive rotation, ink and shape deterministically from the trip id
 * (see components/passport/passportData.ts) so the wall never reshuffles.
 */
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useQuery, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Spacing, type ThemeColors } from '@/constants/theme';
import { Type } from '@/constants/typography';
import BackButton from '@/components/ui/BackButton';
import { Squiggle } from '@/components/ui/Squiggle';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { VAStamp } from '@/components/auth/VAStamp';
import { PassportStamp } from '@/components/passport/PassportStamp';
import { PassportStats } from '@/components/passport/PassportStats';
import {
  formatStampDate,
  isPassportStampTrip,
} from '@/components/passport/passportData';

const WALL_PADDING = 22;
const WALL_GAP = 14;

function SectionKicker({ label, colors }: { label: string; colors: ThemeColors }) {
  return (
    <View style={styles.sectionKicker}>
      <Text
        style={[
          Type.kickerSm,
          { color: colors.inkMute, fontSize: 10, letterSpacing: 10 * 0.18 },
        ]}
      >
        {label}
      </Text>
      <Squiggle width={50} height={5} strokeWidth={2} color={colors.coral} />
    </View>
  );
}

export default function PassportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { isAuthenticated } = useConvexAuth();

  const allTrips = useQuery(
    api.trips.listTrips,
    isAuthenticated ? {} : 'skip',
  );

  // The wall: past / completed trips only, in chronological order — a real
  // passport fills oldest-first, and the entry numbers ascend with it.
  const stamps = useMemo(() => {
    if (!allTrips) return undefined;
    return allTrips
      .filter((trip) => isPassportStampTrip(trip))
      .sort((a, b) => {
        const aTime = new Date(a.endDate ?? a.startDate ?? 0).getTime() || a._creationTime;
        const bTime = new Date(b.endDate ?? b.startDate ?? 0).getTime() || b._creationTime;
        return aTime - bTime;
      });
  }, [allTrips]);

  const stats = useMemo(() => {
    if (!stamps) return { countries: 0, days: 0, trips: 0 };
    return {
      countries: new Set(stamps.map((t) => t.countryCode)).size,
      days: stamps.reduce((sum, t) => sum + (t.duration || 0), 0),
      trips: stamps.length,
    };
  }, [stamps]);

  const hasStamps = (stamps?.length ?? 0) > 0;
  const cellWidth = Math.floor((windowWidth - WALL_PADDING * 2 - WALL_GAP) / 2);

  // Scroll-fade for the top safe-area blur (Apple Mail ramp, as on Settings).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDeep }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.md,
          paddingBottom: insets.bottom + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: WALL_PADDING, marginBottom: 4 }}>
          <BackButton />
        </View>

        {/* Editorial header — kicker, italic Fraunces title, coral period */}
        <View style={styles.header}>
          <Text style={[Type.kicker, { color: colors.inkMute }]}>
            YOUR PASSPORT
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.display,
              fontSize: 32,
              fontWeight: '500',
              letterSpacing: -32 * 0.022,
              color: colors.ink,
              marginTop: 4,
              lineHeight: 34,
            }}
          >
            <Text
              style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}
            >
              {hasStamps ? 'Stamped' : 'Stampless'}
            </Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          <View style={{ marginTop: 8 }}>
            <Squiggle width={80} height={10} strokeWidth={2} color={colors.coral} />
          </View>
        </View>

        {stamps === undefined ? null : hasStamps ? (
          <View style={{ paddingHorizontal: WALL_PADDING }}>
            {/* Travel record — onboarding "YOUR ACCESS" metrics style */}
            <SectionKicker label="TRAVEL RECORD" colors={colors} />
            <PassportStats
              countries={stats.countries}
              days={stats.days}
              trips={stats.trips}
            />

            {/* The wall */}
            <View style={{ marginTop: 24 }}>
              <SectionKicker label="ENTRY STAMPS" colors={colors} />
            </View>
            <View style={styles.wall}>
              {stamps.map((trip, chronologicalIndex) => (
                <Animated.View
                  key={trip._id}
                  entering={FadeInDown.duration(380).delay(
                    Math.min(chronologicalIndex * 50, 450),
                  )}
                >
                  <PassportStamp
                    tripId={trip._id}
                    countryCode={trip.countryCode}
                    countryName={trip.countryName}
                    dateLabel={formatStampDate(
                      trip.endDate ?? trip.startDate,
                      trip._creationTime,
                    )}
                    iataCode={trip.iataCode}
                    index={chronologicalIndex}
                    width={cellWidth}
                    onPress={() => router.push(`/trip/${trip._id}` as never)}
                  />
                </Animated.View>
              ))}
            </View>
          </View>
        ) : (
          /* Empty state — the stampless promise, restated */
          <View style={{ paddingHorizontal: WALL_PADDING }}>
            <View
              style={[
                styles.emptyCard,
                { borderColor: colors.coral, backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  Type.kickerSm,
                  { color: colors.coral, letterSpacing: 9 * 0.22 },
                ]}
              >
                PASSPORT · BLANK PAGE
              </Text>

              {/* House stamp, faded — the first page before any entries */}
              <View style={{ marginTop: 18, opacity: 0.45 }}>
                <VAStamp size={120} />
              </View>

              <Text
                style={[
                  Type.body14,
                  {
                    color: colors.inkMute,
                    marginTop: 18,
                    lineHeight: 14 * 1.6,
                    textAlign: 'center',
                  },
                ]}
              >
                {'Your passport is '}
                <Text
                  style={{
                    fontFamily: FontFamily.displayItalic,
                    fontStyle: 'italic',
                    color: colors.inkMute,
                  }}
                >
                  stampless.
                </Text>
                {' Plan a trip and we\'ll do the visa homework — the stamps land here once you\'re back.'}
              </Text>

              <Pressable
                onPress={() => router.push('/(tabs)/trips' as never)}
                accessibilityRole="button"
                accessibilityLabel="Plan a trip"
                style={({ pressed }) => [
                  styles.ctaPrimary,
                  { backgroundColor: colors.ink, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.ctaPrimaryText}>Plan a trip</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Animated.ScrollView>

      <TopSafeAreaBlur scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: WALL_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
  },
  sectionKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  wall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: WALL_GAP,
    // Breathing room so rotated stamps don't kiss the section kicker.
    paddingTop: 4,
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  ctaPrimaryText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -14 * 0.01,
    color: '#FFFFFF',
  },
});

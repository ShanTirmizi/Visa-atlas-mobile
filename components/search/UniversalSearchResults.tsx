import React, { useMemo } from 'react';
import { View, Text, Pressable, Keyboard, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { FontFamily, getVisaCategoryColor } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Flag } from '@/components/ui/Flag';
import { visaData, type CountryVisa } from '@/data/visaData';
import { toAlpha2 } from '@/utils/countryCode';
import { hapticSelect } from '@/utils/haptics';
import { tabSlideIn } from '@/utils/tabAnimation';

// ──────────────────────────────────────────────
// Types — structural shapes so the screen can pass Convex docs directly.
// ──────────────────────────────────────────────
export interface SearchableTrip {
  _id: string;
  countryName: string;
  countryCode: string;
  startDate?: string;
  status?: string;
}

export interface SearchableGuide {
  _id: string;
  countryName: string;
  countryCode: string;
  visaType: string;
  status: string;
}

interface UniversalSearchResultsProps {
  /** Raw (untrimmed) query from the search field. */
  query: string;
  /** The user's trips — already subscribed by the home screen. */
  trips: SearchableTrip[];
  /** Visa guides — undefined while the subscription loads; group is hidden. */
  guides?: SearchableGuide[];
}

const MAX_PER_GROUP = 5;

// Prefix matches rank above substring matches (Apple Maps / Spotlight
// ordering) so typing "ja" puts Japan above Azerbaijan.
function rankMatches<T>(
  items: T[],
  q: string,
  key: (item: T) => string,
): T[] {
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const name = key(item).toLowerCase();
    if (name.startsWith(q)) starts.push(item);
    else if (name.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, MAX_PER_GROUP);
}

function categoryLabel(category: string): string {
  const c = (category || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return 'VISA-FREE';
  if (c.includes('arrival')) return 'ON ARRIVAL';
  if (c.includes('evisa')) return 'EVISA';
  return 'VISA REQ.';
}

function tripSubtitle(trip: SearchableTrip): string {
  if (trip.status === 'generating') return 'PLANNING';
  if (!trip.startDate) return 'NO DATE SET';
  const start = new Date(trip.startDate);
  const month = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${month} ${start.getFullYear()}`;
}

// ──────────────────────────────────────────────
// Row — editorial list row: circular flag + italic Fraunces name +
// mono sub-label + chevron. Matches CountryPickerSheet's row language.
// ──────────────────────────────────────────────
interface ResultRowProps {
  countryCode: string;
  name: string;
  sub: string;
  subColor?: string;
  onPress: () => void;
}

function ResultRow({ countryCode, name, sub, subColor, onPress }: ResultRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        Keyboard.dismiss();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceMuted : 'transparent',
          borderBottomColor: colors.line,
        },
      ]}
    >
      <Flag code={toAlpha2(countryCode)} size={28} />
      <Text
        style={[styles.rowName, { color: colors.ink }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={[
          Type.kickerSm,
          { color: subColor ?? colors.inkMute, fontSize: 9 },
        ]}
        numberOfLines={1}
      >
        {sub}
      </Text>
      <ChevronRight size={16} color={colors.inkFaint} strokeWidth={2} />
    </Pressable>
  );
}

// ──────────────────────────────────────────────
// Group — mono kicker + rows
// ──────────────────────────────────────────────
function ResultGroup({
  kicker,
  children,
}: {
  kicker: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[Type.kicker, { color: colors.inkMute, marginBottom: 4 }]}>
        {kicker}
      </Text>
      {children}
    </View>
  );
}

// ──────────────────────────────────────────────
// UniversalSearchResults — grouped live results for the home search field.
// Spotlight / Apple Maps pattern: while the query is non-empty the screen's
// list area swaps to TRIPS / COUNTRIES / GUIDES groups, each row navigating
// straight to its detail screen.
// ──────────────────────────────────────────────
export function UniversalSearchResults({
  query,
  trips,
  guides,
}: UniversalSearchResultsProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const q = query.trim().toLowerCase();

  const tripMatches = useMemo(
    () => rankMatches(trips, q, (t) => t.countryName),
    [trips, q],
  );

  const countryMatches = useMemo<CountryVisa[]>(
    () =>
      rankMatches(
        visaData.filter((c) => c.category !== 'home'),
        q,
        (c) => c.name,
      ),
    [q],
  );

  const guideMatches = useMemo(
    () => rankMatches(guides ?? [], q, (g) => g.countryName),
    [guides, q],
  );

  const total = tripMatches.length + countryMatches.length + guideMatches.length;

  // Empty state — editorial italic with the signature coral period.
  if (total === 0) {
    return (
      <Animated.View entering={tabSlideIn(18)} style={styles.emptyWrap}>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontWeight: '500',
            fontSize: 20,
            letterSpacing: -20 * 0.018,
            color: colors.ink,
            textAlign: 'center',
          }}
        >
          Nothing matches &lsquo;{query.trim()}&rsquo;
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
        <Text
          style={[
            Type.kickerSm,
            { color: colors.inkFaint, marginTop: 10, textAlign: 'center' },
          ]}
        >
          TRY A COUNTRY OR TRIP NAME
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={tabSlideIn(18)}>
      {tripMatches.length > 0 && (
        <ResultGroup kicker="TRIPS">
          {tripMatches.map((trip) => (
            <ResultRow
              key={trip._id}
              countryCode={trip.countryCode}
              name={trip.countryName}
              sub={tripSubtitle(trip)}
              onPress={() => router.push(`/trip/${trip._id}` as never)}
            />
          ))}
        </ResultGroup>
      )}

      {countryMatches.length > 0 && (
        <ResultGroup kicker="COUNTRIES">
          {countryMatches.map((country) => (
            <ResultRow
              key={country.code}
              countryCode={country.code}
              name={country.name}
              sub={categoryLabel(country.category)}
              subColor={getVisaCategoryColor(country.category, colors)}
              onPress={() => router.push(`/country/${country.code}` as never)}
            />
          ))}
        </ResultGroup>
      )}

      {guideMatches.length > 0 && (
        <ResultGroup kicker="GUIDES">
          {guideMatches.map((guide) => (
            <ResultRow
              key={guide._id}
              countryCode={guide.countryCode}
              name={guide.countryName}
              sub={`${guide.visaType} · ${guide.status}`.toUpperCase()}
              onPress={() => router.push(`/guide/${guide._id}` as never)}
            />
          ))}
        </ResultGroup>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 24,
    paddingHorizontal: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: {
    flex: 1,
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -17 * 0.012,
  },
  emptyWrap: {
    marginTop: 48,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
});

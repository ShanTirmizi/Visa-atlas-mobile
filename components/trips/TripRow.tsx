import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronRight, Heart } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Photo } from '@/components/ui/Photo';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
import { TypingDots } from '@/components/ui/TypingDots';
import { toAlpha2 } from '@/utils/countryCode';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function parseHeroImageUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'url' in parsed &&
      typeof (parsed as Record<string, unknown>).url === 'string'
    ) {
      return (parsed as { url: string }).url;
    }
    return null;
  } catch {
    return null;
  }
}

function toCat(visaCategory: string): Cat {
  const c = (visaCategory || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return 'free';
  if (c.includes('arrival')) return 'arrival';
  if (c.includes('evisa')) return 'evisa';
  return 'required';
}

function formatMonoDate(startDate: string | undefined, endDate: string | undefined): string {
  if (!startDate) return 'NO DATE SET';
  const start = new Date(startDate);
  const month = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = start.getFullYear();
  if (endDate) {
    const end = new Date(endDate);
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (start.getTime() < Date.now() && end.getTime() < Date.now()) {
      return `${month} ${year} · PAST`;
    }
    return `${month} ${year} · ${days} NIGHTS`;
  }
  return `${month} ${year}`;
}

// ──────────────────────────────────────────────
// GeneratingProgressStrip — thin animated coral bar at the bottom of the
// thumbnail while a trip is being generated.
// ──────────────────────────────────────────────
function GeneratingProgressStrip() {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [x]);
  const s = useAnimatedStyle(() => ({
    transform: [{ translateX: -50 + x.value * 100 }],
  }));
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        overflow: 'hidden',
        borderBottomLeftRadius: 14,
        borderBottomRightRadius: 14,
      }}
      pointerEvents="none"
    >
      <Animated.View
        style={[{ width: 50, height: 2, backgroundColor: colors.coral }, s]}
      />
    </View>
  );
}

// ──────────────────────────────────────────────
// TripRow — Signature v2 (with flag-on-thumb + stacked right side)
// ──────────────────────────────────────────────
interface TripRowProps {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  visaCategory: string;
  startDate?: string;
  endDate?: string;
  heroImage?: string;
  /** Show a small coral heart corner badge on the thumbnail when the user
   *  has starred this trip from the trip detail header. */
  starred?: boolean;
  /** Trip generation status. When `'generating'`, the row shows a placeholder
   *  hero, a GENERATING pill in place of the visa badge, and an animated
   *  coral progress strip. When `'failed'`, shows a FAILED pill. Permissive
   *  string type — legacy trips may pass undefined. */
  status?: string;
}

export function TripRow({
  id,
  name,
  countryName,
  countryCode,
  visaCategory,
  startDate,
  endDate,
  heroImage,
  starred,
  status,
}: TripRowProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const imageUri = parseHeroImageUri(heroImage);
  const a2 = toAlpha2(countryCode);
  const cat = toCat(visaCategory);
  const dateStr = formatMonoDate(startDate, endDate);
  const displayName = name || countryName;
  const isGenerating = status === 'generating';
  const isFailed = status === 'failed';

  return (
    <Pressable
      onPress={() => router.push(`/trip/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open trip to ${displayName}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 12,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {/* Thumbnail with flag badge bottom-right + (optional) starred heart top-right */}
      <View style={styles.thumbWrap}>
        <Photo
          uri={isGenerating ? undefined : (imageUri ?? undefined)}
          tone="mountain"
          radius={14}
          style={styles.thumb}
          showPlaceholderGlyph={false}
        />
        <View style={[styles.flagBadge, { borderColor: colors.surface }]}>
          <Flag code={a2} size={20} />
        </View>
        {starred && !isGenerating ? (
          <View
            style={[
              styles.starredBadge,
              {
                backgroundColor: colors.coral,
                borderColor: colors.surface,
              },
            ]}
          >
            <Heart size={10} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
          </View>
        ) : null}
        {isGenerating && <GeneratingProgressStrip />}
      </View>

      {/* Title + mono date */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: '500',
            letterSpacing: -17 * 0.012,
            color: colors.ink,
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={[
            Type.kickerSm,
            { color: colors.inkMute, fontSize: 9, lineHeight: 13 },
          ]}
          numberOfLines={2}
        >
          {dateStr}
        </Text>
      </View>

      {/* Right rail: visa pill on top, chevron below. Generating / failed
          trips swap the visa badge for a soft status pill — bg tint +
          coloured text, fully-rounded like VisaBadge, no leading dot. The
          trailing TypingDots on "Planning" is the app's established
          live-work language (DayDeck's "writing…", chat composer). */}
      <View style={styles.rightRail}>
        {isGenerating ? (
          <View style={[styles.statusPill, { backgroundColor: colors.coralBg }]}>
            <Text style={[styles.statusPillText, { color: colors.coral }]}>
              Planning
            </Text>
            <TypingDots color={colors.coral} size="sm" gap={2} />
          </View>
        ) : isFailed ? (
          <View style={[styles.statusPill, { backgroundColor: colors.coralBg }]}>
            <Text style={[styles.statusPillText, { color: colors.coral }]}>
              Needs attention
            </Text>
          </View>
        ) : (
          <VisaBadge cat={cat} size="sm" />
        )}
        <ChevronRight size={18} color={colors.inkMute} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  thumb: {
    width: 64,
    height: 64,
  },
  flagBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starredBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightRail: {
    alignItems: 'flex-end',
    gap: 8,
  },
  // Soft status pill — matches VisaBadge sm metrics (padV 4 / padH 9 /
  // fs 10 / radius 999) so the right rail stays visually consistent
  // whichever pill renders.
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    fontWeight: '600',
  },
});

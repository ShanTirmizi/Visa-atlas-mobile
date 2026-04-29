import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Heart } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Photo } from '@/components/ui/Photo';
import { Flag } from '@/components/ui/Flag';
import { VisaBadge, type Cat } from '@/components/ui/Badge';
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
}: TripRowProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const imageUri = parseHeroImageUri(heroImage);
  const a2 = toAlpha2(countryCode);
  const cat = toCat(visaCategory);
  const dateStr = formatMonoDate(startDate, endDate);
  const displayName = name || countryName;

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
          uri={imageUri ?? undefined}
          tone="mountain"
          radius={14}
          style={styles.thumb}
          showPlaceholderGlyph={false}
        />
        <View style={[styles.flagBadge, { borderColor: colors.surface }]}>
          <Flag code={a2} size={20} />
        </View>
        {starred ? (
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

      {/* Right rail: visa pill on top, chevron below */}
      <View style={styles.rightRail}>
        <VisaBadge cat={cat} size="sm" />
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
});

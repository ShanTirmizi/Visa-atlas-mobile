import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Heart, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Type } from '@/constants/typography';
import { Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { Photo, type PhotoTone } from '@/components/ui/Photo';
import { GlassPill } from '@/components/ui/GlassPill';
import { CircleBtn } from '@/components/ui/CircleBtn';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { VisaBadge, type Cat } from '@/components/ui/Badge';

// ──────────────────────────────────────────────
// Helper: parse heroImage JSON blob
// ──────────────────────────────────────────────
function parseHeroImage(raw: string | null | undefined): string | null {
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

// ──────────────────────────────────────────────
// Helper: map visaCategory string → Badge Cat
// ──────────────────────────────────────────────
function toCat(visaCategory: string): Cat {
  const c = visaCategory.toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return 'free';
  if (c.includes('arrival')) return 'arrival';
  if (c.includes('evisa')) return 'evisa';
  return 'required';
}

// ──────────────────────────────────────────────
// Helper: format mono date range
// e.g. "OCT 18 — 25 · 7 DAYS"
// ──────────────────────────────────────────────
function formatMonoDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  duration: number,
): string {
  if (!startDate) return `${duration} DAYS`;
  const start = new Date(startDate);
  const startMonth = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const startDay = start.getDate();

  if (endDate) {
    const end = new Date(endDate);
    const endDay = end.getDate();
    return `${startMonth} ${startDay} \u2014 ${endDay} \u00B7 ${duration} DAYS`;
  }
  return `${startMonth} ${startDay} \u00B7 ${duration} DAYS`;
}

// ──────────────────────────────────────────────
// Helper: days until trip
// ──────────────────────────────────────────────
function daysUntil(startDate: string | undefined): string | null {
  if (!startDate) return null;
  const diff = Math.ceil(
    (new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return null;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

// ──────────────────────────────────────────────
// Avatar stack — three overlapping circles
// ──────────────────────────────────────────────
const AVATAR_TONES: PhotoTone[] = ['ocean', 'forest', 'sunset'];

function AvatarStack() {
  const CIRCLES = 3;
  const SIZE = 32;
  const OVERLAP = 10;
  const totalWidth = CIRCLES * SIZE - (CIRCLES - 1) * OVERLAP;

  return (
    <View style={{ flexDirection: 'row', width: totalWidth, height: SIZE }}>
      {AVATAR_TONES.map((tone, i) => (
        <View
          key={tone}
          style={{
            position: 'absolute',
            left: i * (SIZE - OVERLAP),
            zIndex: CIRCLES - i,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            borderRadius: SIZE / 2,
            width: SIZE,
            height: SIZE,
            overflow: 'hidden',
          }}
        >
          <Photo tone={tone} style={{ width: SIZE, height: SIZE }} />
        </View>
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────
// FeaturedTripCard
// ──────────────────────────────────────────────
interface FeaturedTripCardProps {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  visaCategory: string;
  startDate?: string;
  endDate?: string;
  duration: number;
  heroImage?: string;
  status: string;
}

export function FeaturedTripCard({
  id,
  name,
  countryName,
  countryCode,
  visaCategory,
  startDate,
  endDate,
  duration,
  heroImage,
  status,
}: FeaturedTripCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const imageUri = parseHeroImage(heroImage);
  const cat = toCat(visaCategory);
  const monoDate = formatMonoDateRange(startDate, endDate, duration);
  const until = daysUntil(startDate);
  const displayName = name || countryName;
  const displaySub = until ? `${until} \u00B7 with you` : countryName;

  return (
    <Pressable
      onPress={() => router.push(`/trip/${id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open trip to ${displayName}`}
      style={({ pressed }) => [
        styles.card,
        Shadows.cardRaised,
        { opacity: pressed ? 0.95 : 1 },
      ]}
    >
      {/* Full-height photo */}
      <Photo
        uri={imageUri ?? undefined}
        tone="mountain"
        style={StyleSheet.absoluteFillObject}
      />

      {/* Gradient scrim — bottom 45% to full dark */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        locations={[0.45, 1.0]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Top overlay ─────────────────────────── */}
      <View style={styles.topOverlay}>
        <GlassPill icon={<MapPin size={11} color="#FFFFFF" />}>
          {countryName}
        </GlassPill>
        <CircleBtn
          size={36}
          solid
          accessibilityLabel="Save trip"
        >
          <Heart size={16} color="#0E0E0E" strokeWidth={2.25} />
        </CircleBtn>
      </View>

      {/* ── Bottom overlay ──────────────────────── */}
      <View style={styles.bottomOverlay}>
        {/* Visa badge + mono date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <VisaBadge cat={cat} size="sm" onDark />
          <Text style={[Type.mono10, { color: 'rgba(255,255,255,0.80)' }]}>
            {monoDate}
          </Text>
        </View>

        {/* Trip title */}
        <Text
          style={[Type.display32, { color: '#FFFFFF', marginBottom: 4 }]}
          numberOfLines={2}
        >
          {displayName}
        </Text>

        {/* Sub-line */}
        <Text style={[Type.body13, { color: 'rgba(255,255,255,0.80)', marginBottom: 14 }]}>
          {displaySub}
        </Text>

        {/* Avatar stack + DarkOrb CTA */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AvatarStack />
          <DarkOrb
            size={44}
            onPress={() => router.push(`/trip/${id}`)}
            accessibilityLabel="View trip"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <ArrowRight size={18} color={colors.ink} strokeWidth={2} />
          </DarkOrb>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 380,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#2E3A48',
    marginHorizontal: 22,
  },
  topOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
  },
});

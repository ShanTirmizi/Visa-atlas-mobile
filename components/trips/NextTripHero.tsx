/**
 * NextTripHero — 4-block composition replacing FeaturedTripCard.
 *
 * Block 1: Hero photo card with NEXT TRIP status pill, coral countdown,
 *           italic country title, date subline.
 * Block 2: TripWeekStrip — 7 days from today, today's column inked.
 * Block 3: Flight path strip (VIE → destination IATA, from FlightPath).
 * Block 4: Dual VISA / BUDGET cards side-by-side.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { Photo } from '@/components/ui/Photo';
import { Countdown } from '@/components/ui/Countdown';
import { FlightPath } from '@/components/ui/FlightPath';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
interface NextTripHeroProps {
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
  /** Destination IATA airport code (stored on the trip doc). */
  iataCode?: string;
  /** Estimated flight hours — e.g. 18.33 → "18h 20m" */
  flightHours?: number;
  /** Daily budget string (e.g. "€120") — used for BUDGET card. */
  dailyBudget?: string;
  /** Sum of logged booking costs in EUR — used for % logged. */
  loggedCost?: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
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

function formatMonoDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  duration: number,
): string {
  if (!startDate) return `${duration} NIGHTS`;
  const start = new Date(startDate);
  const sm = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const sd = start.getDate();
  if (endDate) {
    const end = new Date(endDate);
    const em = end.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const ed = end.getDate();
    const range = em === sm ? `${sm} ${sd} → ${ed}` : `${sm} ${sd} → ${em} ${ed}`;
    return `${range} · ${duration} NIGHTS`;
  }
  return `${sm} ${sd} · ${duration} NIGHTS`;
}

function countdownParts(startDate: string | undefined): { d: number; h: number } | null {
  if (!startDate) return null;
  const ms = new Date(startDate).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  return { d: Math.floor(totalHours / 24), h: totalHours % 24 };
}

function formatFlightCaption(flightHours: number | undefined): string {
  if (!flightHours) return '1 stop · 2h 00m';
  const h = Math.floor(flightHours);
  const m = Math.round((flightHours - h) * 60);
  const stops = flightHours > 4 ? '1 stop' : 'direct';
  return `${stops} · ${h}h ${String(m).padStart(2, '0')}m`;
}

function visaLabel(category: string): string {
  const c = (category || '').toLowerCase().replace(/[-_ ]/g, '');
  if (c.includes('free')) return 'Visa-free.';
  if (c.includes('arrival')) return 'On arrival.';
  if (c.includes('evisa')) return 'eVisa.';
  return 'Visa required.';
}

function parseDailyBudget(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function budgetPct(
  loggedCost: number | undefined,
  dailyBudget: string | undefined,
  duration: number,
): number {
  const total = parseDailyBudget(dailyBudget) * duration;
  if (!loggedCost || !total) return 0;
  return Math.min(100, Math.round((loggedCost / total) * 100));
}

function formatBudgetTotal(
  dailyBudget: string | undefined,
  duration: number,
): string {
  const daily = parseDailyBudget(dailyBudget);
  if (!daily) return '—';
  const total = Math.round(daily * duration);
  return `€ ${total.toLocaleString('en-US')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// TripWeekStrip — inline sub-component
// ──────────────────────────────────────────────────────────────────────────
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function TripWeekStrip({ startDate }: { startDate?: string }) {
  const { colors } = useTheme();

  // Show 7 days starting from today (or trip start if in the future)
  const baseDate = (() => {
    const today = new Date();
    if (!startDate) return today;
    const trip = new Date(startDate);
    return trip > today ? trip : today;
  })();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d;
  });

  const todayDate = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

  return (
    <View
      style={[
        styles.weekStrip,
        { backgroundColor: colors.surface },
      ]}
    >
      {days.map((d, i) => {
        const isToday =
          d.getDate() === todayDate &&
          d.getMonth() === todayMonth &&
          d.getFullYear() === todayYear;
        const dayLetter = DAY_LETTERS[d.getDay()];
        const dayNum = d.getDate();

        return (
          <View
            key={i}
            style={[
              styles.dayCell,
              isToday && {
                backgroundColor: colors.ink,
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 4,
              },
            ]}
          >
            <Text
              style={[
                Type.mono9,
                {
                  color: isToday ? 'rgba(255,255,255,0.60)' : colors.inkMute,
                  fontSize: 8,
                  letterSpacing: 8 * 0.1,
                  textAlign: 'center',
                },
              ]}
            >
              {dayLetter}
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontWeight: '500',
                fontSize: 16,
                letterSpacing: -16 * 0.018,
                color: isToday ? '#FFFFFF' : colors.ink,
                textAlign: 'center',
                marginTop: 1,
              }}
            >
              {dayNum}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// NextTripHero — main export
// ──────────────────────────────────────────────────────────────────────────
export function NextTripHero({
  id,
  name,
  countryName,
  countryCode,
  visaCategory,
  startDate,
  endDate,
  duration,
  heroImage,
  iataCode,
  flightHours,
  dailyBudget,
  loggedCost,
}: NextTripHeroProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const imageUri = parseHeroImage(heroImage);
  const monoDate = formatMonoDateRange(startDate, endDate, duration);
  const cd = countdownParts(startDate);
  const alpha2 = toAlpha2(countryCode);

  // Editorial head: split "City, Country" or just country name
  const head = name && name !== countryName ? `${name}, ` : '';
  const tail = countryName || name || '';

  // IATA: use trip iataCode falling back to a 3-char uppercase slice
  const destIata = (iataCode || countryCode || 'DST').toUpperCase().slice(0, 3);
  const flightCaption = formatFlightCaption(flightHours);

  // Budget card
  const pct = budgetPct(loggedCost, dailyBudget, duration);
  const budgetTotal = formatBudgetTotal(dailyBudget, duration);

  // Visa label
  const visaText = visaLabel(visaCategory);
  // Visa duration from category (rough heuristic)
  const visaDays = (() => {
    const c = (visaCategory || '').toLowerCase();
    if (c.includes('90')) return '90 DAYS';
    if (c.includes('30') || c.includes('arrival')) return '30 DAYS';
    if (c.includes('free')) return '90 DAYS';
    return 'CHECK REQS';
  })();

  return (
    <View style={styles.container}>
      {/* ── BLOCK 1: Hero photo card ──────────────────────────────── */}
      <View style={styles.shadowWrap}>
        <Pressable
          onPress={() => router.push(`/trip/${id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open trip to ${head}${tail}`}
          style={({ pressed }) => [
            styles.heroCard,
            { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.95 : 1 },
          ]}
        >
          {/* Photo or neutral placeholder */}
          <Photo
            uri={imageUri ?? undefined}
            tone="sunset"
            style={StyleSheet.absoluteFillObject}
          />

          {/* Gradient overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.32)', 'transparent', 'rgba(0,0,0,0.72)']}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Top-left: NEXT TRIP pill with flag */}
          <View style={styles.statusPill}>
            <Flag code={alpha2} size={16} />
            <Text
              style={[
                Type.kickerSm,
                { color: colors.ink, fontSize: 9, letterSpacing: 9 * 0.18 },
              ]}
            >
              NEXT TRIP · {countryName.toUpperCase()}
            </Text>
          </View>

          {/* Top-right: countdown pill */}
          {cd ? (
            <View style={styles.countdownWrap}>
              <Countdown days={cd.d} hours={cd.h} />
            </View>
          ) : null}

          {/* Bottom: title + date subline */}
          <View style={styles.heroBottom}>
            <Text
              style={{
                fontFamily: FontFamily.display,
                fontSize: 32,
                fontWeight: '500',
                letterSpacing: -32 * 0.022,
                lineHeight: 34,
                color: '#FFFFFF',
              }}
            >
              {head}
              <Text
                style={{
                  fontFamily: FontFamily.displayItalic,
                  fontStyle: 'italic',
                }}
              >
                {tail}
              </Text>
            </Text>
            <Text
              style={[
                Type.kickerSm,
                {
                  color: 'rgba(255,255,255,0.85)',
                  marginTop: 5,
                  fontSize: 10,
                },
              ]}
            >
              {monoDate}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* ── BLOCK 2: Week strip ──────────────────────────────────── */}
      <TripWeekStrip startDate={startDate} />

      {/* ── BLOCK 3: Flight path strip ───────────────────────────── */}
      <View
        style={[
          styles.flightStrip,
          { backgroundColor: colors.surface },
        ]}
      >
        <FlightPath
          width={300}
          height={52}
          from="VIE"
          to={destIata}
          caption={flightCaption}
        />
      </View>

      {/* ── BLOCK 4: Dual VISA / BUDGET cards ───────────────────── */}
      <View style={styles.dualRow}>
        {/* VISA card — paper bg */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text
            style={[
              Type.kickerSm,
              { color: colors.inkMute, fontSize: 9, letterSpacing: 9 * 0.22 },
            ]}
          >
            VISA
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 20,
              letterSpacing: -20 * 0.022,
              lineHeight: 24,
              color: colors.ink,
              marginTop: 6,
            }}
          >
            {visaText}
          </Text>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.inkMute, fontSize: 9, marginTop: 4 },
            ]}
          >
            {visaDays}
          </Text>
        </View>

        {/* BUDGET card — dark ink bg */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.ink },
          ]}
        >
          <Text
            style={[
              Type.kickerSm,
              { color: 'rgba(255,255,255,0.55)', fontSize: 9, letterSpacing: 9 * 0.22 },
            ]}
          >
            BUDGET
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontWeight: '500',
              fontSize: 20,
              letterSpacing: -20 * 0.022,
              lineHeight: 24,
              color: '#FFFFFF',
              marginTop: 6,
            }}
          >
            {budgetTotal}
          </Text>
          <Text
            style={[
              Type.kickerSm,
              { color: colors.coral, fontSize: 9, marginTop: 4 },
            ]}
          >
            {pct}% LOGGED
          </Text>
        </View>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 22,
    gap: 10,
  },
  // Outer shadow wrapper — no overflow:hidden so iOS casts the shadow
  shadowWrap: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1F1A14',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 14,
  },
  heroCard: {
    height: 260,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  statusPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 7,
    paddingRight: 13,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  countdownWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  heroBottom: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  dayCell: {
    alignItems: 'center',
    minWidth: 34,
  },
  flightStrip: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
  },
});

export default NextTripHero;

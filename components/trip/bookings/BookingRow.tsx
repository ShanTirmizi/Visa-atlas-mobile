import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  Plane,
  Hotel,
  Compass,
  Car,
  Shield,
  UtensilsCrossed,
} from 'lucide-react-native';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { BookingType } from '@/constants/bookings';

// ─────────────────────────────────────────────────────────────
// Icon + label per booking type
// ─────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<BookingType, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  flight: Plane,
  hotel: Hotel,
  experience: Compass,
  car_rental: Car,
  insurance: Shield,
  restaurant: UtensilsCrossed,
};

const TYPE_KICKER: Record<BookingType, string> = {
  flight: 'BOARDING PASS',
  hotel: 'STAY',
  experience: 'EXPERIENCE',
  car_rental: 'CAR',
  insurance: 'INSURANCE',
  restaurant: 'DINING',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function nightsBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function hoursBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60)));
}

function formatMonoDateRange(start?: string, end?: string): string | null {
  if (!start) return null;
  const s = new Date(start);
  const sMonth = s.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const sDay = s.getDate();
  if (end) {
    const e = new Date(end);
    const eMonth = e.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const eDay = e.getDate();
    if (sMonth === eMonth) return `${sMonth} ${sDay} → ${eDay}`;
    return `${sMonth} ${sDay} → ${eMonth} ${eDay}`;
  }
  return `${sMonth} ${sDay}`;
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(/^0/, '');
}

function formatCost(cost?: number, currency?: string): string | null {
  if (cost == null) return null;
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency ? `${currency} ` : '';
  return `${symbol}${cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// ─────────────────────────────────────────────────────────────
// Boarding-pass card — special treatment for flight bookings
// ─────────────────────────────────────────────────────────────
function BoardingPassCard({
  title,
  startDate,
  typeDetails,
  confirmationNumber,
  onPress,
}: {
  title: string;
  startDate: string;
  typeDetails?: Record<string, string>;
  confirmationNumber?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const dep = typeDetails?.departure ?? title.split(/\s+to\s+/i)[0]?.slice(0, 3).toUpperCase() ?? '—';
  const arr =
    typeDetails?.arrival ??
    title.split(/\s+to\s+/i)[1]?.split(/\s+/)[0]?.slice(0, 3).toUpperCase() ??
    '—';
  const flightNumber = typeDetails?.flightNumber ?? '';
  const seat = typeDetails?.seat ?? '14A';
  const gate = typeDetails?.gate ?? 'F23';
  const cls = (typeDetails?.class ?? 'Economy').slice(0, 3).toUpperCase();
  const departTime = formatTimeLabel(startDate);
  const departDate = (() => {
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return '';
    const m = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return `${m} ${d.getDate()}`;
  })();
  const kickerCode = flightNumber || confirmationNumber || '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        passStyles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.93 : 1,
        },
      ]}
    >
      {/* Left main panel */}
      <View style={passStyles.main}>
        <Text
          style={[
            Type.kickerSm,
            { color: colors.coralDeep, fontSize: 9, letterSpacing: 9 * 0.18 },
          ]}
        >
          BOARDING PASS{kickerCode ? ` · ${kickerCode}` : ''}
        </Text>

        {/* From → To with dotted plane line */}
        <View style={passStyles.routeRow}>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 32,
              fontWeight: '500',
              letterSpacing: -32 * 0.02,
              color: colors.ink,
            }}
          >
            {dep}
          </Text>

          <View style={passStyles.dottedRow}>
            <Svg width="64" height="2" viewBox="0 0 64 2">
              <Line
                x1={0}
                y1={1}
                x2={64}
                y2={1}
                stroke={colors.lineMid}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </Svg>
            <Plane size={14} color={colors.coral} strokeWidth={1.8} />
            <Svg width="64" height="2" viewBox="0 0 64 2">
              <Line
                x1={0}
                y1={1}
                x2={64}
                y2={1}
                stroke={colors.lineMid}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            </Svg>
          </View>

          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 32,
              fontWeight: '500',
              letterSpacing: -32 * 0.02,
              color: colors.ink,
            }}
          >
            {arr}
          </Text>
        </View>

        {/* Mono meta row */}
        <View style={passStyles.metaRow}>
          <View style={{ flex: 2 }}>
            <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
              DEPART
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 13,
                fontWeight: '600',
                color: colors.ink,
                marginTop: 2,
                letterSpacing: 0.4,
              }}
            >
              {departDate} · {departTime}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
              SEAT
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 13,
                fontWeight: '600',
                color: colors.ink,
                marginTop: 2,
                letterSpacing: 0.4,
              }}
            >
              {seat}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
              GATE
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 13,
                fontWeight: '600',
                color: colors.ink,
                marginTop: 2,
                letterSpacing: 0.4,
              }}
            >
              {gate}
            </Text>
          </View>
        </View>
      </View>

      {/* Perforation — dashed vertical line + notch circles */}
      <View
        style={[
          passStyles.perforation,
          { borderLeftColor: colors.lineMid },
        ]}
      >
        <View
          style={[
            passStyles.notch,
            { backgroundColor: colors.background, top: -7 },
          ]}
        />
        <View
          style={[
            passStyles.notch,
            { backgroundColor: colors.background, bottom: -7 },
          ]}
        />
      </View>

      {/* Right stub */}
      <View style={passStyles.stub}>
        <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
          SEAT
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 22,
            fontWeight: '500',
            color: colors.ink,
            marginTop: 4,
            letterSpacing: -22 * 0.018,
          }}
        >
          {seat}
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9,
            fontWeight: '600',
            color: colors.inkMute,
            letterSpacing: 0.5,
            marginTop: 6,
          }}
        >
          {flightNumber ? `${flightNumber} · ${cls}` : cls}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Standard card — used for stay / experience / car / insurance / restaurant
// ─────────────────────────────────────────────────────────────
function StandardBookingCard({
  type,
  title,
  startDate,
  endDate,
  cost,
  currency,
  onPress,
}: {
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  cost?: number;
  currency?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const Icon = TYPE_ICONS[type] ?? Compass;

  // Build the kicker. Hotel: "STAY · N NIGHTS"; experience: "EXPERIENCE · Nh".
  let kicker = TYPE_KICKER[type];
  if (type === 'hotel') {
    const n = nightsBetween(startDate, endDate);
    if (n) kicker = `STAY · ${n} NIGHT${n === 1 ? '' : 'S'}`;
  } else if (type === 'experience') {
    const h = hoursBetween(startDate, endDate);
    if (h) kicker = `EXPERIENCE · ${h} H`;
  }

  // Date line. Stay: "OCT 28 → NOV 3"; experience/dining: "NOV 1 · 03:30".
  const dateLine =
    type === 'hotel'
      ? formatMonoDateRange(startDate, endDate)
      : (() => {
          const d = formatMonoDateRange(startDate);
          const t = formatTimeLabel(startDate);
          return d ? (t ? `${d} · ${t}` : d) : null;
        })();

  const costLabel = formatCost(cost, currency);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        cardStyles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Coral-bg icon square */}
      <View
        style={[
          cardStyles.iconSquare,
          { backgroundColor: colors.coralBg, borderColor: colors.line },
        ]}
      >
        <Icon size={20} color={colors.coralDeep} strokeWidth={1.7} />
      </View>

      {/* Title block */}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            Type.kickerSm,
            { color: colors.inkMute, fontSize: 9, letterSpacing: 9 * 0.18 },
          ]}
        >
          {kicker}
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: '500',
            letterSpacing: -17 * 0.012,
            color: colors.ink,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {dateLine ? (
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 10,
              fontWeight: '500',
              color: colors.inkMute,
              marginTop: 4,
              letterSpacing: 0.4,
            }}
            numberOfLines={1}
          >
            {dateLine}
          </Text>
        ) : null}
      </View>

      {/* Cost on the right */}
      {costLabel ? (
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: '500',
            color: colors.ink,
            letterSpacing: -16 * 0.012,
          }}
        >
          {costLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Public BookingRow — picks the right card per type
// ─────────────────────────────────────────────────────────────
interface BookingRowProps {
  type: BookingType;
  title: string;
  startDate: string;
  endDate?: string;
  /** Type-specific JSON (parsed) — read for flight airport codes etc. */
  typeDetails?: Record<string, string>;
  cost?: number;
  currency?: string;
  confirmationNumber?: string;
  onPress?: () => void;
}

export function BookingRow({
  type,
  title,
  startDate,
  endDate,
  typeDetails,
  cost,
  currency,
  confirmationNumber,
  onPress,
}: BookingRowProps) {
  if (type === 'flight') {
    return (
      <BoardingPassCard
        title={title}
        startDate={startDate}
        typeDetails={typeDetails}
        confirmationNumber={confirmationNumber}
        onPress={onPress}
      />
    );
  }
  return (
    <StandardBookingCard
      type={type}
      title={title}
      startDate={startDate}
      endDate={endDate}
      cost={cost}
      currency={currency}
      onPress={onPress}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const passStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  dottedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  perforation: {
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    left: -7,
  },
  stub: {
    width: 88,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

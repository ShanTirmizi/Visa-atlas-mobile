// components/daytrip/DayTripLogisticsCard.tsx
//
// The transport spine pinned at the top of a day-trip detail screen: the
// outbound/return bookends, the "back home by" guarantee, cost-of-day, the
// border/passport reminder, and a verify-live-times link to the operator.
// Renders only when trip.isDayTrip; reads the stored DayTripMeta.

import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import {
  Train,
  Plane,
  Ship,
  Bus,
  Car,
  ArrowRight,
  ArrowDown,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';
import type { DayTripMeta, DayTripMode } from '@/types/itinerary';

const MODE_ICON: Record<DayTripMode, typeof Train> = {
  rail: Train,
  flight: Plane,
  ferry: Ship,
  coach: Bus,
  road: Car,
};

function formatCost(amount: number, currency: string): string {
  const symbol: Record<string, string> = { GBP: '£', EUR: '€', USD: '$', JPY: '¥', AUD: 'A$', NZD: 'NZ$', CHF: 'CHF ', CAD: 'C$' };
  const s = symbol[currency] ?? '';
  return s ? `${s}${amount}` : `${amount} ${currency}`;
}

export function DayTripLogisticsCard({ meta }: { meta: DayTripMeta }) {
  const { colors } = useTheme();
  const ModeIcon = MODE_ICON[meta.transportMode] ?? Train;
  const tight = meta.feasibility === 'tight';

  const openOperator = () => {
    if (!meta.bookingUrl) return;
    hapticSelect();
    Linking.openURL(meta.bookingUrl).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {/* Route header */}
        <View style={styles.routeRow}>
          <Text style={[styles.route, { color: colors.ink }]} numberOfLines={1}>
            {meta.homeCity.toUpperCase()}
          </Text>
          <ArrowRight size={15} color={colors.coral} strokeWidth={2.4} />
          <Text style={[styles.route, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>
            {meta.destCity.toUpperCase()}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styles.modeChip}>
            <ModeIcon size={13} color={colors.inkSoft} strokeWidth={2} />
            <Text style={[styles.modeChipText, { color: colors.inkSoft }]} numberOfLines={1}>
              {meta.transportLabel}
            </Text>
          </View>
        </View>

        {/* Spine */}
        <View style={[styles.spine, { backgroundColor: colors.background, borderColor: colors.line }]}>
          <SpineRow time={meta.outboundDepart} label={`Leave ${meta.homeCity}`} colors={colors} />
          <Connector colors={colors} />
          <SpineRow time={meta.outboundArrive} label={`Arrive ${meta.destCity}`} colors={colors} />
          <View style={styles.groundRow}>
            <Text style={[styles.ground, { color: colors.coral }]}>
              ~{meta.hoursOnGround % 1 === 0 ? meta.hoursOnGround : meta.hoursOnGround.toFixed(1)} hours on the ground
            </Text>
            {tight && (
              <View style={[styles.tightChip, { backgroundColor: colors.warningBg }]}>
                <Text style={[styles.tightText, { color: colors.warning }]}>Tight turnaround</Text>
              </View>
            )}
          </View>
          <SpineRow time={meta.lastReturnDepart} label="Catch the last way back" colors={colors} muted />
          <Connector colors={colors} />
          <SpineRow time={meta.returnArrive} label={`Home in ${meta.homeCity}`} colors={colors} emphasize />
        </View>

        {/* Border reminder */}
        {meta.borderReminder && (
          <View style={[styles.border, { backgroundColor: colors.warningBg }]}>
            <ShieldCheck size={16} color={colors.warning} strokeWidth={2} />
            <Text style={[styles.borderText, { color: colors.warning }]}>
              It&apos;s a real border — bring your passport, even for the day.
            </Text>
          </View>
        )}

        {/* Footer: cost + verify link */}
        <View style={styles.footer}>
          <Text style={[styles.cost, { color: colors.ink }]}>
            {formatCost(meta.costOfDay, meta.currency)}
            <Text style={[styles.costSub, { color: colors.inkMute }]}> for the day</Text>
          </Text>
          {meta.bookingUrl ? (
            <Pressable onPress={openOperator} style={styles.verify} hitSlop={8}>
              <Text style={[styles.verifyText, { color: colors.coral }]}>
                {meta.operator ? `Confirm on ${meta.operator}` : 'Confirm times'}
              </Text>
              <ExternalLink size={13} color={colors.coral} strokeWidth={2} />
            </Pressable>
          ) : (
            <Text style={[styles.verifyText, { color: colors.inkFaint }]}>Confirm times before booking</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function SpineRow({
  time,
  label,
  colors,
  muted,
  emphasize,
}: {
  time: string;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.spineRow}>
      <Text style={[styles.time, { color: muted ? colors.inkMute : colors.ink }]}>{time}</Text>
      <View style={[styles.dot, { backgroundColor: emphasize ? colors.coral : colors.coralSoft }]} />
      <Text
        style={[
          styles.label,
          { color: emphasize ? colors.ink : colors.inkSoft, fontFamily: emphasize ? FontFamily.semibold : FontFamily.medium },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function Connector({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.connector}>
      <View style={{ width: 50 }} />
      <ArrowDown size={11} color={colors.inkFaint} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 10 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  route: { fontFamily: FontFamily.displaySemibold, fontSize: 14, letterSpacing: 0.3 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeChipText: { fontFamily: FontFamily.medium, fontSize: 12 },
  spine: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 2 },
  spineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { fontFamily: FontFamily.mono, fontSize: 13.5, width: 50 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 14, flexShrink: 1 },
  connector: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 1 },
  groundRow: { paddingLeft: 62, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ground: { fontFamily: FontFamily.displayItalic, fontStyle: 'italic', fontSize: 14 },
  tightChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  tightText: { fontFamily: FontFamily.semibold, fontSize: 10 },
  border: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14 },
  borderText: { fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cost: { fontFamily: FontFamily.displaySemibold, fontSize: 17 },
  costSub: { fontFamily: FontFamily.regular, fontSize: 12.5 },
  verify: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifyText: { fontFamily: FontFamily.semibold, fontSize: 12.5 },
});

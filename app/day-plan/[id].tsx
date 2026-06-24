// app/day-plan/[id].tsx
//
// The generated day plan — map-forward. The routed day on a MapLibre canvas up
// top (numbered pins + road line), a scrollable timeline of stops below with
// travel legs between them, each stop carrying its web source. Watches the
// dayPlans row reactively (generating → ready/failed).

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { Car, TrainFront, Footprints, Bike, ExternalLink, Clock, MapPin, ArrowDown, Compass } from 'lucide-react-native';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { parseDayPlan, formatDuration, transportLabel, type DayPlanTransport } from '@/types/dayPlan';
import { BackButton } from '@/components/ui/BackButton';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { DarkOrb } from '@/components/ui/DarkOrb';
import { DayPlanMap } from '@/components/dayplan/DayPlanMap';
import { hapticSelect } from '@/utils/haptics';

const MODE_ICON: Record<DayPlanTransport, typeof Car> = {
  car: Car,
  transit: TrainFront,
  walk: Footprints,
  cycle: Bike,
};

export default function DayPlanScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useQuery(api.dayPlanner.getDayPlan, id ? { planId: id as Id<'dayPlans'> } : 'skip');
  const [activeIndex, setActiveIndex] = useState(-1);
  const scrollRef = useRef<ScrollView>(null);
  const stopYs = useRef<number[]>([]);

  const plan = useMemo(() => parseDayPlan(data?.plan), [data?.plan]);
  const ModeIcon = plan ? MODE_ICON[plan.transport] ?? Car : Car;

  // ── Loading / error ──
  if (data === undefined || (data && data.status === 'generating')) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <DarkOrb size={58}>
          <Compass size={25} color="#FFFFFF" strokeWidth={1.8} />
        </DarkOrb>
        <Text style={[styles.loadTitle, { color: colors.ink }]}>Building your day</Text>
        <Text style={[styles.loadBody, { color: colors.inkMute }]}>
          Searching what people actually recommend{data?.startLabel ? ` near ${data.startLabel}` : ''}, then mapping the route…
        </Text>
        <ActivityIndicator color={colors.coral} style={{ marginTop: 18 }} />
        <View style={{ position: 'absolute', top: insets.top + 10, left: 18 }}>
          <BackButton />
        </View>
      </View>
    );
  }

  if (!data || data.status === 'failed' || !plan) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadTitle, { color: colors.ink }]}>Couldn&apos;t build that day</Text>
        <Text style={[styles.loadBody, { color: colors.inkMute }]}>
          {data?.errorMessage || 'Something went wrong finding places for that day. Try different inputs.'}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 10, left: 18 }}>
          <BackButton />
        </View>
      </View>
    );
  }

  const onStopPress = (i: number) => {
    hapticSelect();
    setActiveIndex(i);
    const y = stopYs.current[i];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const legMin = (i: number) => plan.legs[i]?.durationMin ?? 0;
  const legKm = (i: number) => plan.legs[i]?.distanceKm ?? 0;
  const legEst = (i: number) => plan.legs[i]?.estimated ?? false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Map canvas */}
      <DayPlanMap
        start={plan.start}
        stops={plan.stops}
        routeGeometry={plan.routeGeometry}
        activeIndex={activeIndex}
        onStopPress={onStopPress}
        style={{ height: 320 }}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.sheet}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.ink }]}>{plan.title}</Text>
        {!!plan.summary && <Text style={[styles.summary, { color: colors.inkSoft }]}>{plan.summary}</Text>}
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.coralBg }]}>
            <ModeIcon size={13} color={colors.coralDeep} strokeWidth={2} />
            <Text style={[styles.metaPillText, { color: colors.coralDeep }]}>
              {transportLabel(plan.transport)}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: colors.inkMute }]}>
            {plan.stops.length} stops · {formatDuration(plan.totalTravelMin ?? 0)} travelling
            {plan.totalDistanceKm ? ` · ${Math.round(plan.totalDistanceKm)} km` : ''}
          </Text>
        </View>

        {/* Leave home */}
        <View style={styles.node}>
          <View style={[styles.nodeDot, { backgroundColor: colors.ink }]} />
          <Text style={[styles.nodeText, { color: colors.inkSoft }]} numberOfLines={1}>
            Leave {plan.start.label}
          </Text>
        </View>
        <Leg colors={colors} ModeIcon={ModeIcon} min={legMin(0)} km={legKm(0)} est={legEst(0)} />

        {/* Stops + legs between */}
        {plan.stops.map((s, i) => (
          <View
            key={`${i}-${s.lat}`}
            onLayout={(e) => {
              stopYs.current[i] = e.nativeEvent.layout.y;
            }}
          >
            <Pressable
              onPress={() => setActiveIndex(i)}
              style={[
                styles.stopCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: activeIndex === i ? colors.coral : colors.line,
                },
              ]}
            >
              <View style={styles.stopHead}>
                <View style={[styles.num, { backgroundColor: colors.coral }]}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stopName, { color: colors.ink }]}>{s.name}</Text>
                  <View style={styles.stopMeta}>
                    {!!s.time && (
                      <>
                        <Clock size={12} color={colors.inkMute} strokeWidth={2} />
                        <Text style={[styles.stopMetaText, { color: colors.inkMute }]}>{s.time}</Text>
                        <Text style={[styles.stopMetaDot, { color: colors.inkFaint }]}>·</Text>
                      </>
                    )}
                    <Text style={[styles.stopMetaText, { color: colors.inkMute }]}>
                      {formatDuration(s.durationMin)}
                      {s.area ? ` · ${s.area}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
              {!!s.why && <Text style={[styles.why, { color: colors.inkSoft }]}>{s.why}</Text>}
              {!!s.bookingNote && (
                <View style={[styles.booking, { backgroundColor: colors.warningBg }]}>
                  <Text style={[styles.bookingText, { color: colors.warning }]}>{s.bookingNote}</Text>
                </View>
              )}
              <View style={styles.stopFoot}>
                {s.source ? (
                  <Pressable
                    onPress={() => {
                      hapticSelect();
                      Linking.openURL(s.source!.url).catch(() => {});
                    }}
                    style={styles.source}
                    hitSlop={8}
                  >
                    <Text style={[styles.sourceText, { color: colors.coral }]} numberOfLines={1}>
                      Recommended by {s.source.label}
                    </Text>
                    <ExternalLink size={12} color={colors.coral} strokeWidth={2} />
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable
                  onPress={() => {
                    hapticSelect();
                    const q = encodeURIComponent(`${s.name} ${s.area ?? ''}`.trim());
                    Linking.openURL(`https://maps.apple.com/?q=${q}&ll=${s.lat},${s.lng}`).catch(() => {});
                  }}
                  style={styles.mapsLink}
                  hitSlop={8}
                >
                  <MapPin size={12} color={colors.inkMute} strokeWidth={2} />
                  <Text style={[styles.mapsText, { color: colors.inkMute }]}>Maps</Text>
                </Pressable>
              </View>
            </Pressable>
            <Leg colors={colors} ModeIcon={ModeIcon} min={legMin(i + 1)} km={legKm(i + 1)} est={legEst(i + 1)} last={i === plan.stops.length - 1} />
          </View>
        ))}

        {/* Home */}
        <View style={styles.node}>
          <View style={[styles.nodeDot, { backgroundColor: colors.ink }]} />
          <Text style={[styles.nodeText, { color: colors.inkSoft }]} numberOfLines={1}>
            Back in {plan.start.label}
          </Text>
        </View>

        <Text style={[styles.disclaimer, { color: colors.inkFaint }]}>
          Places are real recommendations from the web; times and routes are estimates — confirm opening hours
          before you set off.
        </Text>
      </ScrollView>

      <TopSafeAreaBlur />
      <View style={{ position: 'absolute', top: insets.top + 10, left: 18 }}>
        <BackButton />
      </View>
    </View>
  );
}

function Leg({
  colors,
  ModeIcon,
  min,
  km,
  est,
  last,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  ModeIcon: typeof Car;
  min: number;
  km: number;
  est?: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.leg}>
      <ArrowDown size={12} color={colors.inkFaint} strokeWidth={2} />
      <ModeIcon size={13} color={colors.inkMute} strokeWidth={2} />
      <Text style={[styles.legText, { color: colors.inkMute }]}>
        {last ? 'Journey home · ' : ''}
        {est ? '~' : ''}
        {formatDuration(min)}
        {km ? ` · ${km} km` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  loadTitle: { fontFamily: FontFamily.displaySemibold, fontSize: 20, marginTop: 14, textAlign: 'center' },
  loadBody: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  sheet: { flex: 1, marginTop: -18, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: 'transparent' },
  title: { fontFamily: FontFamily.displaySemibold, fontSize: 24, letterSpacing: -0.5, lineHeight: 29 },
  summary: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  metaPillText: { fontFamily: FontFamily.semibold, fontSize: 11.5 },
  metaText: { fontFamily: FontFamily.medium, fontSize: 12.5 },
  node: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  nodeDot: { width: 10, height: 10, borderRadius: 5 },
  nodeText: { fontFamily: FontFamily.semibold, fontSize: 13.5, flexShrink: 1 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 1, paddingVertical: 7 },
  legText: { fontFamily: FontFamily.mono, fontSize: 11.5, letterSpacing: -0.2 },
  stopCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 9 },
  stopHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { color: '#FFFFFF', fontFamily: FontFamily.bold, fontSize: 12.5 },
  stopName: { fontFamily: FontFamily.displaySemibold, fontSize: 17, letterSpacing: -0.3 },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  stopMetaText: { fontFamily: FontFamily.medium, fontSize: 12 },
  stopMetaDot: { fontFamily: FontFamily.medium, fontSize: 12 },
  why: { fontFamily: FontFamily.regular, fontSize: 13.5, lineHeight: 19 },
  booking: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 10 },
  bookingText: { fontFamily: FontFamily.medium, fontSize: 12.5, lineHeight: 17 },
  stopFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 1 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  sourceText: { fontFamily: FontFamily.semibold, fontSize: 12.5, flexShrink: 1 },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapsText: { fontFamily: FontFamily.medium, fontSize: 12 },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11.5, lineHeight: 17, marginTop: 22, textAlign: 'center' },
});

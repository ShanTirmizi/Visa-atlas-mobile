// app/day-planner/index.tsx
//
// "Plan my day" — the input-driven planner. You set your exact start point,
// transport, how far you'll go, and the kind of day; it generates a routed,
// web-grounded, mapped day. (Replaces the old auto-list discovery.)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useConvexAuth, useMutation } from 'convex/react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Search, MapPin, Car, TrainFront, Footprints, Bike, X } from 'lucide-react-native';

import { api } from '@/convex/_generated/api';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { useVisa } from '@/contexts/visa-context';
import { countryCoordinates } from '@/data/countryCoordinates';
import { countryMeta } from '@/data/countryMeta';
import { LIGHT_STYLE, DARK_STYLE } from '@/components/map/mapStyles';
import { searchPlaces, reverseGeocode, type GeoHit } from '@/utils/geocodeClient';
import type { DayPlanTransport } from '@/types/dayPlan';

import { BackButton } from '@/components/ui/BackButton';
import { TopSafeAreaBlur } from '@/components/ui/TopSafeAreaBlur';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { Squiggle } from '@/components/ui/Squiggle';
import { PillButton } from '@/components/ui/PillButton';
import { hapticSelect } from '@/utils/haptics';
import { useAnalytics, ANALYTICS } from '@/lib/analytics';

const TRANSPORT_OPTS: { label: string; value: DayPlanTransport; Icon: typeof Car }[] = [
  { label: 'Car', value: 'car', Icon: Car },
  { label: 'Train', value: 'transit', Icon: TrainFront },
  { label: 'Walk', value: 'walk', Icon: Footprints },
  { label: 'Cycle', value: 'cycle', Icon: Bike },
];

const REACH_OPTS: { label: string; minutes: number }[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '1½ hr', minutes: 90 },
  { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 },
];

const VIBES = ['Food', 'Nature', 'Culture', 'Coast', 'Markets', 'Hidden gems', 'Cosy', 'Active', 'Family', 'History'];

export default function DayPlannerScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { residence } = useVisa();
  const generate = useMutation(api.dayPlanner.generateDayPlan);
  const analytics = useAnalytics();

  // Default the start to the user's residence capital.
  const defaultStart = useMemo(() => {
    const coord = residence ? countryCoordinates[residence] : null;
    const city = residence ? countryMeta[residence]?.capital : null;
    if (coord) return { lat: coord.lat, lng: coord.lng, label: city || 'Home' };
    return { lat: 51.5074, lng: -0.1278, label: 'London' };
  }, [residence]);

  const [start, setStart] = useState(defaultStart);
  useEffect(() => setStart(defaultStart), [defaultStart]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [transport, setTransport] = useState<DayPlanTransport>('car');
  const [reach, setReach] = useState(90);
  const [vibes, setVibes] = useState<Set<string>>(new Set(['Food']));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const runSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const hits = await searchPlaces(q, start);
      setResults(hits);
      setSearching(false);
    }, 300);
  };

  const pickResult = (h: GeoHit) => {
    hapticSelect();
    setStart(h);
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
  };

  const onMapPress = async (e: { geometry?: { coordinates?: [number, number] } }) => {
    const c = e.geometry?.coordinates;
    if (!c) return;
    const [lng, lat] = c;
    setStart((s) => ({ ...s, lat, lng, label: 'Locating…' }));
    const label = await reverseGeocode(lat, lng);
    setStart({ lat, lng, label });
  };

  const toggleVibe = (v: string) => {
    hapticSelect();
    setVibes((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const plan = async () => {
    if (busy) return;
    setBusy(true);
    analytics.track(ANALYTICS.dayPlanStarted, {
      transport,
      reachMinutes: reach,
      interests: vibes.size,
    });
    try {
      const planId = await generate({
        startLat: start.lat,
        startLng: start.lng,
        startLabel: start.label,
        transport,
        reachMinutes: reach,
        interests: [...vibes],
        notes: notes.trim() || undefined,
      });
      router.replace(`/day-plan/${planId}` as never);
    } catch {
      setBusy(false);
    }
  };

  if (isAuthenticated === false) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <SectionKicker color={colors.coral} style={{ marginTop: 18 }}>
            DAY PLANNER
          </SectionKicker>
          <Text style={[styles.title, { color: colors.ink }]}>
            Plan your{' '}
            <Text style={{ fontFamily: FontFamily.displayItalic, fontStyle: 'italic' }}>day</Text>
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          <View style={{ marginTop: 8 }}>
            <Squiggle width={78} height={10} strokeWidth={2} color={colors.coral} />
          </View>
        </View>

        {/* Start location */}
        <Field label="STARTING FROM" colors={colors}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={17} color={colors.inkMute} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={runSearch}
              placeholder={start.label}
              placeholderTextColor={colors.inkMute}
              style={[styles.searchInput, { color: colors.ink }]}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.coral} />}
            {query.length > 0 && !searching && (
              <Pressable onPress={() => runSearch('')} hitSlop={8}>
                <X size={16} color={colors.inkMute} />
              </Pressable>
            )}
          </View>

          {results.length > 0 && (
            <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {results.map((h, i) => (
                <Pressable
                  key={`${h.lat}-${h.lng}-${i}`}
                  onPress={() => pickResult(h)}
                  style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: colors.surfaceMuted }]}
                >
                  <MapPin size={15} color={colors.coral} strokeWidth={2} />
                  <Text style={[styles.resultText, { color: colors.ink }]} numberOfLines={1}>
                    {h.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Map preview — tap to fine-tune the start point */}
          <View style={[styles.mapWrap, { borderColor: colors.line }]}>
            <MapLibreGL.MapView
              style={{ flex: 1 }}
              mapStyle={isDark ? DARK_STYLE : LIGHT_STYLE}
              attributionEnabled={false}
              logoEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              onPress={onMapPress as unknown as (e: unknown) => void}
            >
              <MapLibreGL.Camera centerCoordinate={[start.lng, start.lat]} zoomLevel={11} animationDuration={350} />
              <MapLibreGL.PointAnnotation id="start" coordinate={[start.lng, start.lat]}>
                <View style={[styles.startPin, { backgroundColor: colors.coral, borderColor: '#FFFFFF' }]}>
                  <MapPin size={13} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              </MapLibreGL.PointAnnotation>
            </MapLibreGL.MapView>
            <View style={[styles.mapHint, { backgroundColor: colors.surface }]}>
              <Text style={[styles.mapHintText, { color: colors.inkMute }]} numberOfLines={1}>
                {start.label} · tap map to adjust
              </Text>
            </View>
          </View>
        </Field>

        {/* Transport */}
        <Field label="GETTING AROUND" colors={colors}>
          <View style={styles.transportRow}>
            {TRANSPORT_OPTS.map(({ label, value, Icon }) => {
              const active = transport === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    hapticSelect();
                    setTransport(value);
                  }}
                  style={[
                    styles.transportChip,
                    { borderColor: active ? colors.ink : colors.line, backgroundColor: active ? colors.ink : colors.surface },
                  ]}
                >
                  <Icon size={18} color={active ? '#FFFFFF' : colors.inkSoft} strokeWidth={2} />
                  <Text style={[styles.transportText, { color: active ? '#FFFFFF' : colors.inkSoft }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* Reach */}
        <Field label="HOW FAR YOU'LL GO" colors={colors}>
          <View style={styles.chipsRow}>
            {REACH_OPTS.map((r) => {
              const active = reach === r.minutes;
              return (
                <Pressable
                  key={r.minutes}
                  onPress={() => {
                    hapticSelect();
                    setReach(r.minutes);
                  }}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.coral : colors.line, backgroundColor: active ? colors.coralBg : colors.surface },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.coralDeep : colors.inkSoft }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.reachHint, { color: colors.inkMute }]}>
            Travel time each way — the day can stay local or head out, as long as you&apos;re back by evening.
          </Text>
        </Field>

        {/* Vibe */}
        <Field label="KIND OF DAY" colors={colors}>
          <View style={styles.chipsRow}>
            {VIBES.map((v) => {
              const active = vibes.has(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => toggleVibe(v)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.coral : colors.line, backgroundColor: active ? colors.coralBg : colors.surface },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.coralDeep : colors.inkSoft }]}>{v}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything specific? e.g. dog-friendly, a good book shop, a long lunch…"
            placeholderTextColor={colors.inkMute}
            multiline
            style={[styles.notes, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink }]}
          />
        </Field>
      </ScrollView>

      {/* Pinned CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.line }]}>
        <PillButton
          label={busy ? 'Planning your day…' : 'Plan my day'}
          variant="primary"
          fullWidth
          disabled={busy || vibes.size === 0}
          onPress={plan}
          icon={busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
        />
      </View>

      <TopSafeAreaBlur />
    </View>
  );
}

function Field({ label, colors, children }: { label: string; colors: ReturnType<typeof useTheme>['colors']; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.inkMute }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22 },
  title: { fontFamily: FontFamily.display, fontSize: 34, letterSpacing: -34 * 0.022, lineHeight: 38, marginTop: 6 },
  field: { paddingHorizontal: 22, marginTop: 26 },
  fieldLabel: { fontFamily: FontFamily.mono, fontSize: 10.5, letterSpacing: 1.4, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, height: 48 },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15 },
  results: { borderWidth: 1, borderRadius: 14, marginTop: 8, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 12 },
  resultText: { fontFamily: FontFamily.medium, fontSize: 14, flexShrink: 1 },
  mapWrap: { height: 180, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 12 },
  mapHint: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11 },
  mapHintText: { fontFamily: FontFamily.medium, fontSize: 12 },
  startPin: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  transportRow: { flexDirection: 'row', gap: 8 },
  transportChip: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  transportText: { fontFamily: FontFamily.semibold, fontSize: 12.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FontFamily.semibold, fontSize: 13 },
  reachHint: { fontFamily: FontFamily.regular, fontSize: 12.5, lineHeight: 17, marginTop: 11 },
  notes: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 12, minHeight: 76, fontFamily: FontFamily.regular, fontSize: 14.5, textAlignVertical: 'top' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ItineraryDiffCard
//
// Inline accept/decline review card for AI-proposed itinerary edits — the
// "suggested changes" pattern from GitHub / Cursor: show only the hunks that
// changed, a filled primary "apply" and a quiet text "decline". Rendered in
// the chat message list directly under the assistant reply that proposed the
// edit, so the user reviews in context instead of having the trip silently
// overwritten.
//
// Editorial card chrome per house style: surface bg, hairline `line` border,
// 16px radius, soft warm shadow (no photo, so no split-shadow needed).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Squiggle } from '@/components/ui/Squiggle';
import { hapticImpact, hapticSelect } from '@/utils/haptics';
import { FontFamily } from '@/constants/theme';

// Matches the day shape produced by the trip planner and consumed by the
// trip detail screen (see ItineraryDay in app/chat/[tripId].tsx).
interface ItineraryDay {
  day: number;
  title?: string;
  morning?: string;
  afternoon?: string;
  evening?: string;
}

export interface SlotChange {
  slot: 'Title' | 'Morning' | 'Afternoon' | 'Evening';
  from: string;
  to: string;
}

export interface DayDiff {
  day: number;
  /** Proposed title for the day (current title when the day was removed). */
  title: string;
  kind: 'edited' | 'added' | 'removed';
  changes: SlotChange[];
}

function parseDays(json: string): ItineraryDay[] | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (d): d is ItineraryDay =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as { day?: unknown }).day === 'number',
    );
  } catch {
    return null;
  }
}

/**
 * Diff two itinerary JSON strings per day (matched on day number, comparing
 * title/morning/afternoon/evening). Returns only the days that changed —
 * `[]` means the proposal is a no-op, `null` means the proposal couldn't be
 * parsed (caller should fall back to the legacy silent-apply path rather
 * than show an empty card).
 */
export function diffItineraries(
  currentJson: string,
  proposedJson: string,
): DayDiff[] | null {
  const proposed = parseDays(proposedJson);
  if (proposed === null) return null;
  const current = parseDays(currentJson) ?? [];

  const currentByDay = new Map(current.map((d) => [d.day, d]));
  const proposedDayNumbers = new Set(proposed.map((d) => d.day));
  const diffs: DayDiff[] = [];

  const slots: { slot: SlotChange['slot']; key: keyof ItineraryDay & ('title' | 'morning' | 'afternoon' | 'evening') }[] = [
    { slot: 'Title', key: 'title' },
    { slot: 'Morning', key: 'morning' },
    { slot: 'Afternoon', key: 'afternoon' },
    { slot: 'Evening', key: 'evening' },
  ];

  for (const next of proposed) {
    const prev = currentByDay.get(next.day);
    if (!prev) {
      diffs.push({
        day: next.day,
        title: next.title ?? `Day ${next.day}`,
        kind: 'added',
        changes: [],
      });
      continue;
    }
    const changes: SlotChange[] = [];
    for (const { slot, key } of slots) {
      const from = (prev[key] ?? '').toString().trim();
      const to = (next[key] ?? '').toString().trim();
      if (from !== to) changes.push({ slot, from, to });
    }
    if (changes.length > 0) {
      diffs.push({
        day: next.day,
        title: next.title ?? `Day ${next.day}`,
        kind: 'edited',
        changes,
      });
    }
  }

  for (const prev of current) {
    if (!proposedDayNumbers.has(prev.day)) {
      diffs.push({
        day: prev.day,
        title: prev.title ?? `Day ${prev.day}`,
        kind: 'removed',
        changes: [],
      });
    }
  }

  diffs.sort((a, b) => a.day - b.day);
  return diffs;
}

// Graceful truncation: cut at the last word boundary when one lands in the
// back 40% of the budget, so we don't slice mid-word.
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,;:.]+$/, '')}…`;
}

interface Props {
  /** The trip's current itinerary JSON (what the user has now). */
  currentItinerary: string;
  /** The AI's proposed full-itinerary JSON. */
  proposedItinerary: string;
  /** Apply the proposal — parent runs the updateTripField path. */
  onApply: () => void;
  /** Discard the proposal and keep the current itinerary. */
  onKeep: () => void;
}

export function ItineraryDiffCard({
  currentItinerary,
  proposedItinerary,
  onApply,
  onKeep,
}: Props) {
  const { colors } = useTheme();

  const diffs = useMemo(
    () => diffItineraries(currentItinerary, proposedItinerary),
    [currentItinerary, proposedItinerary],
  );

  // Parent guards no-op proposals, but stay safe if the trip mutated under us.
  if (!diffs || diffs.length === 0) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.kicker, { color: colors.coralDeep }]}>
          PROPOSED CHANGES
        </Text>
        <Squiggle width={20} height={6} color={colors.coral} />
      </View>

      {diffs.map((d, i) => (
        <View key={d.day}>
          {i > 0 ? (
            <View
              style={[styles.divider, { backgroundColor: colors.line }]}
            />
          ) : null}

          <Text
            style={[
              styles.dayKicker,
              { color: d.kind === 'removed' ? colors.inkMute : colors.coralDeep },
            ]}
          >
            DAY {d.day}
          </Text>
          <Text
            style={[
              styles.dayTitle,
              d.kind === 'removed'
                ? { color: colors.inkMute, textDecorationLine: 'line-through' }
                : { color: colors.ink },
            ]}
            numberOfLines={2}
          >
            {d.title}
          </Text>

          {d.kind === 'added' ? (
            <Text style={[styles.changeLine, { color: colors.inkSoft }]}>
              New day added to the plan.
            </Text>
          ) : null}
          {d.kind === 'removed' ? (
            <Text style={[styles.changeLine, { color: colors.inkSoft }]}>
              Removed from the plan.
            </Text>
          ) : null}

          {d.changes.map((c) => (
            <Text
              key={c.slot}
              style={[styles.changeLine, { color: colors.inkSoft }]}
              numberOfLines={2}
            >
              <Text style={{ fontFamily: FontFamily.semibold, color: colors.ink }}>
                {c.slot}:{' '}
              </Text>
              <Text style={{ color: colors.inkMute }}>
                {truncate(c.from, 34) || '—'}
              </Text>
              <Text style={{ color: colors.coralDeep }}>{' → '}</Text>
              <Text style={{ color: colors.ink }}>
                {truncate(c.to, 44) || '—'}
              </Text>
            </Text>
          ))}
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply changes"
        onPress={() => {
          hapticImpact();
          onApply();
        }}
        style={({ pressed }) => [
          styles.applyBtn,
          {
            backgroundColor: colors.coral,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <Text style={styles.applyText}>Apply changes</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Keep my version"
        onPress={() => {
          hapticSelect();
          onKeep();
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.keepBtn, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Text style={[styles.keepText, { color: colors.inkMute }]}>
          Keep my version
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    // Soft warm shadow per house rule — no photo inside, so no split needed.
    shadowColor: '#1F1A14',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.22,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  dayKicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 9 * 0.22,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  dayTitle: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -17 * 0.014,
    fontWeight: '500',
  },
  changeLine: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  applyBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 22, // full pill
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  keepBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 4,
  },
  keepText: {
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
  },
});

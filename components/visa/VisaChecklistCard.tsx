import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useMutation } from 'convex/react';
import { Check } from 'lucide-react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { api } from '@/convex/_generated/api';
import type { Id, Doc } from '@/convex/_generated/dataModel';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily } from '@/constants/theme';
import { hapticSelect } from '@/utils/haptics';

interface Props {
  tripId: Id<'trips'>;
  /** Editorial card title, e.g. "Bring with you". Flips to "All set" when
   *  every item is checked. */
  title: string;
  /** Checklist item strings — whichever list the Visa tab currently shows
   *  (editorial fallback or streamed). Progress keys off the item text. */
  items: string[];
  /** trip.checklistProgress — server-persisted checked item texts. */
  checkedItems: string[];
}

/**
 * Pre-flight checklist card for the trip Visa tab — checkable rows with
 * progress persisted on the trip doc (Convex), not local state.
 *
 * Interaction matches Apple Reminders: empty 22pt ring → filled teal circle
 * with a white check that pops in, and the completed row dims to ~55%
 * opacity. Premium apps don't strike through checked text. Toggles feel
 * instant via a Convex optimistic update on getTrip — the reactive query
 * remains the single source of truth and rolls back automatically on error.
 */
export function VisaChecklistCard({ tripId, title, items, checkedItems }: Props) {
  const { colors } = useTheme();

  const toggleItem = useMutation(api.trips.toggleChecklistItem).withOptimisticUpdate(
    (localStore, args) => {
      const trip = localStore.getQuery(api.trips.getTrip, { id: args.id });
      if (trip === null || trip === undefined) return;
      const progress = trip.checklistProgress ?? [];
      const next = progress.includes(args.item)
        ? progress.filter((entry) => entry !== args.item)
        : [...progress, args.item];
      localStore.setQuery(
        api.trips.getTrip,
        { id: args.id },
        { ...trip, checklistProgress: next } as Doc<'trips'>,
      );
    },
  );

  const checkedSet = useMemo(() => new Set(checkedItems), [checkedItems]);
  // Count only items in the currently rendered list — checklistProgress may
  // hold strings from a previous list version, which shouldn't inflate the
  // counter.
  const checkedCount = items.filter((item) => checkedSet.has(item)).length;
  const allDone = items.length > 0 && checkedCount === items.length;

  const handleToggle = (item: string) => {
    hapticSelect();
    toggleItem({ id: tripId, item }).catch(() => {
      // Viewer-role or offline failure — Convex rolls the optimistic update
      // back automatically, so the row simply reverts.
    });
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      {/* Header row — mono kicker left, soft progress pill right (bg tint +
          coloured text only, no leading dot). */}
      <View style={styles.headerRow}>
        <Text style={[styles.kicker, { color: colors.inkMute }]}>
          PRE-FLIGHT CHECKLIST
        </Text>
        <View
          style={[
            styles.counterPill,
            allDone
              ? { backgroundColor: colors.tealBg, borderColor: 'transparent' }
              : { backgroundColor: colors.surface, borderColor: colors.line },
          ]}
        >
          <Text
            style={[
              styles.counterText,
              { color: allDone ? colors.teal : colors.inkMute },
            ]}
          >
            {checkedCount} OF {items.length} READY
          </Text>
        </View>
      </View>

      {/* Editorial title — italic display + coral period; flips to "All set"
          once everything is checked. */}
      <Text style={[styles.title, { color: colors.ink }]}>
        <Text style={styles.titleItalic}>{allDone ? 'All set' : title}</Text>
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>

      <View style={styles.list}>
        {items.map((item) => {
          const checked = checkedSet.has(item);
          return (
            <Pressable
              key={item}
              onPress={() => handleToggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View
                style={[
                  styles.ring,
                  checked
                    ? { backgroundColor: colors.teal, borderColor: colors.teal }
                    : { backgroundColor: 'transparent', borderColor: colors.inkFaint },
                ]}
              >
                {checked && (
                  <Animated.View
                    entering={ZoomIn.duration(180)}
                    exiting={ZoomOut.duration(120)}
                  >
                    {/* White check on teal fill — matches the selected-state
                        check treatment in RefinementChoiceCard. */}
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </Animated.View>
                )}
              </View>
              <Text
                style={[
                  styles.itemText,
                  { color: colors.inkSoft, opacity: checked ? 0.55 : 1 },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 10 * 0.22,
  },
  counterPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  counterText: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 10 * 0.14,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 26,
    letterSpacing: -22 * 0.022,
    marginBottom: 12,
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    // Optically centers the first text line against the 22pt ring.
    marginTop: 0.5,
  },
});

export default VisaChecklistCard;

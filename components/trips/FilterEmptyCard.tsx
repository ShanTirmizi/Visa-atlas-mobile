// components/trips/FilterEmptyCard.tsx
//
// In-list empty state for the Trips filter chips. Tapping a filter that
// matches nothing used to render NOTHING at all, which read as "the filter is
// broken" rather than "you have no past trips". Every filter now resolves to
// something on screen (Apple Mail's mailbox filters, Airbnb's Trips tabs:
// switching to an empty tab always states why it's empty).
//
// Editorial house style, matching GuidesEmptyCard: mono kicker, Fraunces
// italic headline with a coral period, coral squiggle, muted body copy.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { FontFamily, Shadows } from '@/constants/theme';
import { Squiggle } from '@/components/ui/Squiggle';

export type EmptyFilter = 'Upcoming' | 'Past' | 'Dreaming';

interface Copy {
  kicker: string;
  /** Headline reads "Nothing {italic}." with the period in coral. */
  italic: string;
  body: string;
}

const COPY: Record<EmptyFilter, Copy> = {
  Upcoming: {
    kicker: 'NOTHING BOOKED',
    italic: 'ahead',
    body: 'Trips with dates from today onward land here.',
  },
  Past: {
    kicker: 'NO HISTORY · YET',
    italic: 'behind',
    body: "When a trip's end date passes, it moves here on its own.",
  },
  Dreaming: {
    kicker: 'WISHLIST · EMPTY',
    italic: 'saved',
    body: 'Trips you save without dates wait here until you pick a week.',
  },
};

export function FilterEmptyCard({ filter }: { filter: EmptyFilter }) {
  const { colors } = useTheme();
  const copy = COPY[filter];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, ...Shadows.subtle },
      ]}
    >
      <Text
        style={[styles.kicker, { color: colors.coralDeep, letterSpacing: 11 * 0.22 }]}
      >
        {copy.kicker}
      </Text>

      <Text style={[styles.title, { color: colors.ink }]}>
        Nothing <Text style={styles.titleItalic}>{copy.italic}</Text>
        <Text style={{ color: colors.coral }}>.</Text>
      </Text>

      <View style={{ alignItems: 'center', marginTop: 7, marginBottom: 13 }}>
        <Squiggle width={92} color={colors.coral} />
      </View>

      <Text style={[styles.body, { color: colors.inkSoft }]}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 30,
    letterSpacing: -26 * 0.022,
    textAlign: 'center',
  },
  titleItalic: {
    fontFamily: FontFamily.displayItalic,
    fontStyle: 'italic',
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
});

export default FilterEmptyCard;

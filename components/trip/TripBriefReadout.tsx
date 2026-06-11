import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { buildAnswerSentence } from '@/utils/mergeUserNotes';

interface Props {
  /**
   * The merged user-notes string. If undefined / empty, this component
   * renders nothing.
   */
  notes: string | undefined;
  /**
   * The interpolated refinement-answer phrases stored on the trip
   * (e.g. "drawn to mountain trails and forest walks"). When present, the
   * answers render as chips under the original note instead of one long
   * merged paragraph — more scannable, and the user can see exactly what
   * they told us.
   */
  answers?: string[];
}

export function TripBriefReadout({ notes, answers }: Props) {
  const { colors } = useTheme();
  if (!notes || notes.trim().length === 0) return null;

  // The merged string is `original + ' ' + buildAnswerSentence(answers)` —
  // deterministically strip the sentence back off so the quote shows only
  // the user's own words. If the strings don't line up (older trips, edited
  // data), fall back to showing the full merged prose with no chips.
  let quote = notes.trim();
  let chips: string[] = [];
  if (answers && answers.length > 0) {
    const sentence = buildAnswerSentence(answers);
    if (quote.endsWith(sentence)) {
      const original = quote.slice(0, -sentence.length).trim();
      if (original.length > 0) {
        quote = original;
        chips = answers;
      } else {
        // Brief was answers-only — keep the prose, skip duplicate chips.
        chips = [];
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text
        style={[styles.quote, { color: colors.coral, opacity: 0.6 }]}
        accessibilityElementsHidden
      >
        {'“'}
      </Text>
      <Text
        style={[
          Type.title17,
          {
            color: colors.ink,
            opacity: 0.85,
            lineHeight: 26,
            textAlign: 'center',
          },
        ]}
      >
        {quote}
      </Text>
      <Text
        style={[
          styles.quote,
          styles.closing,
          { color: colors.coral, opacity: 0.6 },
        ]}
        accessibilityElementsHidden
      >
        {'”'}
      </Text>

      {chips.length > 0 && (
        <View style={styles.chipsRow}>
          {chips.map((chip) => (
            <View
              key={chip}
              style={[styles.chip, { backgroundColor: colors.coralBg }]}
            >
              <Text
                style={{
                  fontFamily: FontFamily.medium,
                  fontSize: 12,
                  lineHeight: 16,
                  color: colors.coralDeep,
                }}
              >
                {capitalize(chip)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 32,
  },
  quote: {
    position: 'absolute',
    fontSize: 56,
    fontStyle: 'italic',
    top: -4,
    left: -4,
  },
  closing: {
    top: undefined,
    left: undefined,
    bottom: -16,
    right: -4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
});

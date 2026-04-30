import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';

interface Props {
  /**
   * The merged user-notes string. If undefined / empty, this component
   * renders nothing.
   */
  notes: string | undefined;
}

export function TripBriefReadout({ notes }: Props) {
  const { colors } = useTheme();
  if (!notes || notes.trim().length === 0) return null;

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
        {notes}
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
    </View>
  );
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
});

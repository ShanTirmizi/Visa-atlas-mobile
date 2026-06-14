import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Type } from '@/constants/typography';
import { FontFamily, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface NextUpCardProps {
  title: string;
  meta: string;
  /** Optional real time — only shown when provided. Never fabricated: the
   *  itinerary carries no per-activity time, so the call site omits it. */
  timeLabel?: string;
  /** Kicker label, defaults to a neutral "NEXT UP" (no fabricated "TODAY"). */
  kicker?: string;
  imageUri?: string;
  onPress?: () => void;
}

export function NextUpCard({
  title,
  meta,
  timeLabel,
  kicker = 'NEXT UP',
  onPress,
}: NextUpCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          marginHorizontal: 16,
          padding: 14,
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          opacity: pressed ? 0.9 : 1,
        },
        Shadows.subtle,
      ]}
    >
      <View style={styles.kickerRow}>
        {/* coralDeep at 10pt — coral at 9pt on paper bg fails contrast for
            text this small; coralDeep keeps the brand hue. */}
        <Text
          style={[
            Type.kickerSm,
            { color: colors.coralDeep, fontSize: 10, letterSpacing: 10 * 0.18 },
          ]}
        >
          {kicker}
        </Text>
        {timeLabel ? (
          <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
            {timeLabel}
          </Text>
        ) : null}
      </View>

      <Text
        style={{
          fontFamily: FontFamily.displayItalic,
          fontStyle: 'italic',
          fontSize: 18,
          fontWeight: '500',
          letterSpacing: -18 * 0.014,
          color: colors.ink,
          marginTop: 6,
        }}
        numberOfLines={2}
      >
        {title}
      </Text>

      <Text
        style={[Type.body12_5, { color: colors.inkMute, marginTop: 4 }]}
        numberOfLines={1}
      >
        {meta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
});

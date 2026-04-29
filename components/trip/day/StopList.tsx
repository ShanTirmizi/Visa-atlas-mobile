import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import type { PhotoTone } from '@/components/ui/Photo';

export interface Stop {
  title: string;
  meta?: string;
  thumbTone?: PhotoTone;
  thumbUri?: string;
  onPress?: () => void;
  /** Optional time prefix on the kicker (e.g. "09:30") */
  timeLabel?: string;
  /** Optional one-line description shown under the title */
  detail?: string;
}

interface StopListProps {
  stops: Stop[];
}

/** Coral timeline of stops — vertical coral-soft rail with coral dots. */
export function StopList({ stops }: StopListProps) {
  const { colors } = useTheme();
  if (stops.length === 0) return null;

  return (
    <View style={{ position: 'relative' }}>
      {/* Vertical rail */}
      <View
        style={{
          position: 'absolute',
          left: 7,
          top: 18,
          bottom: 18,
          width: 2,
          backgroundColor: colors.coralSoft,
        }}
      />
      {stops.map((stop, idx) => {
        const kicker = stop.timeLabel
          ? `${(stop.meta ?? '').toUpperCase()} · ${stop.timeLabel}`
          : (stop.meta ?? '').toUpperCase();
        return (
          <Pressable
            key={`stop-${idx}-${stop.title}`}
            onPress={stop.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              gap: 14,
              paddingVertical: 10,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.coral,
                marginTop: 4,
                shadowColor: colors.coral,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 0,
              }}
            />
            <View style={{ flex: 1 }}>
              {kicker ? (
                <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 9 }]}>
                  {kicker}
                </Text>
              ) : null}
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
                numberOfLines={2}
              >
                {stop.title}
              </Text>
              {stop.detail ? (
                <Text
                  style={[
                    Type.body12_5,
                    { color: colors.inkMute, marginTop: 2 },
                  ]}
                  numberOfLines={2}
                >
                  {stop.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

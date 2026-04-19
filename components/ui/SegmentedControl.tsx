import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Type } from '@/constants/typography';

type Variant = 'pill' | 'underline';

interface Props {
  options: string[];
  value: string;
  onChange: (v: any) => void;
  variant?: Variant;
}

export function SegmentedControl({ options, value, onChange, variant = 'pill' }: Props) {
  const { colors } = useTheme();

  if (variant === 'underline') {
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          marginBottom: 16,
        }}
      >
        {options.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              style={{
                paddingBottom: 10,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: colors.ink,
                marginBottom: -1, // overlap the container hairline on the active tab
              }}
            >
              <Text style={[Type.title14, { color: active ? colors.ink : colors.inkMute, fontSize: 13.5 }]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // pill variant
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 16 }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: active ? colors.ink : 'transparent',
            }}
          >
            <Text style={[Type.meta12, { color: active ? '#FFFFFF' : colors.inkMute }]}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SegmentedControl;

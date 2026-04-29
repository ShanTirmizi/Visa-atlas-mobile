import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { FontFamily } from '@/constants/theme';

export interface MetaItem {
  label: string;
  value: string;
}

interface VisaMetaStripProps {
  items: [MetaItem, MetaItem, MetaItem];
  color: string;
  divider: string;
  style?: StyleProp<ViewStyle>;
}

export function VisaMetaStrip({ items, color, divider, style }: VisaMetaStripProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: divider,
          paddingTop: 16,
        },
        style,
      ]}
    >
      {items.map((item, i) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            paddingLeft: i === 0 ? 0 : 14,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: divider,
          }}
        >
          <Text
            style={{
              fontFamily: FontFamily.monoMedium,
              fontSize: 9,
              fontWeight: '700',
              color,
              opacity: 0.65,
              letterSpacing: 9 * 0.18,
            }}
            numberOfLines={1}
          >
            {item.label.toUpperCase()}
          </Text>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 18,
              fontWeight: '500',
              color,
              letterSpacing: -18 * 0.014,
              lineHeight: 24,
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default VisaMetaStrip;

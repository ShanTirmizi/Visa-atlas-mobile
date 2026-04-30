import React from 'react';
import { Pressable, View, Text, StyleProp, ViewStyle } from 'react-native';
import { ArrowRight, BookOpen } from 'lucide-react-native';
import { FontFamily, Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

interface VisaGuideCTAProps {
  kicker: string;
  label: string;
  accent: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function VisaGuideCTA({ kicker, label, accent, onPress, style }: VisaGuideCTAProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          marginTop: 12,
          paddingTop: 14,
          paddingBottom: 14,
          paddingHorizontal: 16,
          borderRadius: 18,
          backgroundColor: colors.ink,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.9 : 1,
          ...Shadows.cardWarm,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: accent,
          backgroundColor: colors.solidOverlayFaint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BookOpen size={14} color={accent} strokeWidth={2} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FontFamily.monoMedium,
            fontSize: 9,
            fontWeight: '700',
            // Kicker sits on the dark ink card. The visa-category `accent`
            // is tuned for the warm gradient hero above (where it pops),
            // not for dark-on-dark — for e-visa it's literally #3D1810 on
            // colors.ink. Use a soft white instead so it stays legible
            // across all categories.
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: 9 * 0.2,
          }}
          numberOfLines={1}
        >
          {kicker}
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.displayItalic,
            fontStyle: 'italic',
            fontSize: 15,
            color: '#FFFFFF',
            marginTop: 2,
            letterSpacing: -15 * 0.01,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      <View
        style={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowRight size={16} color={colors.ink} strokeWidth={2.25} />
        </View>
      </View>
    </Pressable>
  );
}

export default VisaGuideCTA;

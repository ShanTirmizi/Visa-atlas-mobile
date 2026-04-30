// components/trip/skeletons/TripHeroSkeleton.tsx
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { TypingDots } from '@/components/ui/TypingDots';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Hero placeholder rendered while the trip image is being generated. A
 * shimmering rounded card sits in for the photo, with an "image arriving"
 * pill + bouncing coral dots anchored bottom-left so the user knows real
 * imagery is on its way.
 */
export function TripHeroSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        marginTop: Spacing.md,
        marginHorizontal: Spacing.lg,
        position: 'relative',
      }}
    >
      <Shimmer style={{ height: 220, borderRadius: Radius.lg }} />
      <View
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(255,255,255,0.78)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            letterSpacing: 0.06 * 9,
            textTransform: 'uppercase',
            color: colors.inkMute,
          }}
        >
          image arriving
        </Text>
        <TypingDots color={colors.coral} size="sm" gap={3} />
      </View>
    </View>
  );
}

import React, { useCallback, useEffect } from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { Flag } from '@/components/ui/Flag';
import { Type } from '@/constants/typography';

const THUMB_INACTIVE = 56;
const THUMB_ACTIVE = 72;
const SPRING_CONFIG = { damping: 18, stiffness: 240, mass: 0.8 };

export interface CarouselCountry {
  /** ISO-3 (used as the identity key the parent tracks) */
  code: string;
  /** ISO-2 for rendering the flag */
  iso2?: string;
  name: string;
}

interface CountryCarouselProps {
  countries: CarouselCountry[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

interface ThumbnailProps {
  item: CarouselCountry;
  isActive: boolean;
  onSelect: (code: string) => void;
}

function Thumbnail({ item, isActive, onSelect }: ThumbnailProps) {
  const { colors } = useTheme();
  const size = useSharedValue(isActive ? THUMB_ACTIVE : THUMB_INACTIVE);

  useEffect(() => {
    size.value = withSpring(
      isActive ? THUMB_ACTIVE : THUMB_INACTIVE,
      SPRING_CONFIG,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
    borderRadius: size.value / 2,
  }));

  const handlePress = useCallback(() => {
    onSelect(item.code);
  }, [item.code, onSelect]);

  const iso2 = (item.iso2 ?? item.code).toUpperCase();

  return (
    <View style={{ alignItems: 'center', width: THUMB_ACTIVE + 4 }}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        accessibilityState={{ selected: isActive }}
        style={styles.thumbContainer}
      >
        <Animated.View
          style={[
            animStyle,
            styles.thumbInner,
            {
              borderWidth: isActive ? 3 : 1,
              borderColor: isActive ? colors.ink : colors.line,
              backgroundColor: colors.surface,
            },
          ]}
        >
          {/* Flag fills inside the circle; slight inset so the border reads cleanly */}
          <Flag
            code={iso2}
            size={isActive ? THUMB_ACTIVE - 6 : THUMB_INACTIVE - 2}
          />
        </Animated.View>
      </Pressable>
      <Text
        numberOfLines={1}
        style={[
          Type.meta11,
          {
            marginTop: 6,
            color: isActive ? colors.ink : colors.inkMute,
            maxWidth: THUMB_ACTIVE,
            textAlign: 'center',
          },
        ]}
      >
        {item.name}
      </Text>
    </View>
  );
}

export function CountryCarousel({
  countries,
  selectedCode,
  onSelect,
}: CountryCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      decelerationRate="fast"
    >
      {countries.map((item) => (
        <Thumbnail
          key={item.code}
          item={item}
          isActive={item.code === selectedCode}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 22,
    gap: 10,
    alignItems: 'flex-start',
  },
  thumbContainer: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInner: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

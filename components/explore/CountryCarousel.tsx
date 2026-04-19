import React, { useCallback, useEffect } from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { Photo, PhotoTone } from '@/components/ui/Photo';

const THUMB_INACTIVE = 56;
const THUMB_ACTIVE = 72;
const SPRING_CONFIG = { damping: 18, stiffness: 240, mass: 0.8 };

export interface CarouselCountry {
  code: string;
  name: string;
  photoUri?: string;
  photoTone?: PhotoTone;
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

  // Animate on active change
  useEffect(() => {
    size.value = withSpring(isActive ? THUMB_ACTIVE : THUMB_INACTIVE, SPRING_CONFIG);
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

  return (
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
          isActive && {
            borderWidth: 3,
            borderColor: colors.ink,
          },
        ]}
      >
        <Photo
          uri={item.photoUri}
          tone={item.photoTone ?? 'stone'}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Pressable>
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
    gap: 12,
    alignItems: 'center',
  },
  thumbContainer: {
    // Extra hit area
    padding: 2,
  },
  thumbInner: {
    overflow: 'hidden',
  },
});

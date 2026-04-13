import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/theme-context';

interface DayDeckDotsProps {
  count: number;
  activeIndex: number;
}

function DayDeckDots({ count, activeIndex }: DayDeckDotsProps) {
  const { colors } = useTheme();

  if (count <= 1) return null;

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? colors.foreground : colors.border,
                width: isActive ? 18 : 6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default React.memo(DayDeckDots);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

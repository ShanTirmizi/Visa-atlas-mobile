import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/theme-context';
import { Shadows } from '@/constants/theme';

const CATEGORY_LABELS = [
  'FOOD',
  'ADVENTURE',
  'CULTURE',
  'RELAXATION',
  'NIGHTLIFE',
  'NATURE',
];

// Animated mirrored bar row
function ScoreBarRow({
  scoreA,
  scoreB,
  category,
  colors,
}: {
  scoreA: number;
  scoreB: number;
  category: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const progressA = useSharedValue(0);
  const progressB = useSharedValue(0);

  useEffect(() => {
    progressA.value = withTiming(scoreA / 10, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    progressB.value = withTiming(scoreB / 10, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [scoreA, scoreB]);

  // Left bar — fills from RIGHT to LEFT (using alignSelf: 'flex-end')
  const leftBarStyle = useAnimatedStyle(() => ({
    width: `${progressA.value * 100}%`,
  }));

  // Right bar — fills from LEFT to RIGHT
  const rightBarStyle = useAnimatedStyle(() => ({
    width: `${progressB.value * 100}%`,
  }));

  return (
    <View style={rowStyles.row}>
      {/* Left score */}
      <Text style={[rowStyles.scoreNum, { color: colors.ink }]}>
        {scoreA}
      </Text>

      {/* Left track — coral bar fills from right */}
      <View style={[rowStyles.track, { backgroundColor: colors.line }]}>
        <Animated.View
          style={[
            rowStyles.fillLeft,
            { backgroundColor: colors.coral },
            leftBarStyle,
          ]}
        />
      </View>

      {/* Category label */}
      <Text style={[rowStyles.catLabel, { color: colors.inkMute }]}>
        {category}
      </Text>

      {/* Right track — teal/mint bar fills from left */}
      <View style={[rowStyles.track, { backgroundColor: colors.line }]}>
        <Animated.View
          style={[
            rowStyles.fillRight,
            { backgroundColor: colors.tealSoft },
            rightBarStyle,
          ]}
        />
      </View>

      {/* Right score */}
      <Text style={[rowStyles.scoreNum, { color: colors.ink }]}>
        {scoreB}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scoreNum: {
    fontFamily: 'Fraunces_500Medium_Italic',
    fontStyle: 'italic',
    fontSize: 16,
    fontWeight: '500',
    width: 22,
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fillLeft: {
    height: '100%',
    borderRadius: 3,
    // Right-to-left: use alignSelf flex-end via absolute position
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  fillRight: {
    height: '100%',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  catLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.14,
    textTransform: 'uppercase',
    fontWeight: '600',
    width: 76,
    textAlign: 'center',
  },
});

// ──────────────────────────────────────────────

interface CategoryScoresCardProps {
  scoresA: number[];   // length 6: food, adventure, culture, relaxation, nightlife, nature
  scoresB: number[];
  nameA: string;
  nameB: string;
  categories?: string[];
}

export function CategoryScoresCard({
  scoresA,
  scoresB,
  nameA,
  nameB,
  categories = CATEGORY_LABELS,
}: CategoryScoresCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.cardKicker, { color: colors.inkMute }]}>
          CATEGORY SCORES
        </Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
          <Text style={[styles.legendLabel, { color: colors.inkMute }]}>
            {nameA.toUpperCase()}
          </Text>
          <View style={[styles.legendDot, { backgroundColor: colors.tealSoft }]} />
          <Text style={[styles.legendLabel, { color: colors.inkMute }]}>
            {nameB.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Rows */}
      <View style={styles.rows}>
        {categories.map((cat, i) => (
          <ScoreBarRow
            key={cat}
            category={cat}
            scoreA={scoresA[i] ?? 5}
            scoreB={scoresB[i] ?? 5}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    ...Shadows.subtle,
    shadowColor: '#1F1A14',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardKicker: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 9 * 0.18,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9, // 9pt floor — 8pt mono is below the legibility minimum
    letterSpacing: 9 * 0.18,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rows: {
    gap: 12,
  },
});

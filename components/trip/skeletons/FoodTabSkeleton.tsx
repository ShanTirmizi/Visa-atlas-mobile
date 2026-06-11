import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Skeleton state for the Food tab — mirrors the loaded layout (editorial
 * intro, a horizontal strip of must-try dish cards, then restaurant cards)
 * so the user sees the shape of what's coming, matching the VisaTabSkeleton
 * idiom. No horizontal padding of its own: the tab container already
 * applies the screen's 16px gutter.
 */
export function FoodTabSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 18, marginTop: Spacing.md }}>
      {/* Intro — kicker + editorial paragraph */}
      <View style={{ gap: 10 }}>
        <Shimmer style={{ width: 120, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '95%', height: 13, borderRadius: 4 }} />
        <Shimmer style={{ width: '88%', height: 13, borderRadius: 4 }} />
        <Shimmer style={{ width: '60%', height: 13, borderRadius: 4 }} />
      </View>

      {/* Must-try strip — section header + compact dish cards */}
      <View style={{ gap: 10, marginTop: 4 }}>
        <Shimmer style={{ width: 90, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: 150, height: 22, borderRadius: 6 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 150,
                borderRadius: Radius.md,
                padding: 12,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
                gap: 8,
              }}
            >
              <Shimmer style={{ width: '75%', height: 15, borderRadius: 4 }} />
              <Shimmer style={{ width: '95%', height: 10, borderRadius: 4 }} />
              <Shimmer style={{ width: '60%', height: 10, borderRadius: 4 }} />
            </View>
          ))}
        </View>
      </View>

      {/* Restaurant card placeholders */}
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            borderRadius: 18,
            padding: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 10,
          }}
        >
          <Shimmer style={{ width: 140, height: 9, borderRadius: 4 }} />
          <Shimmer style={{ width: '65%', height: 20, borderRadius: 6 }} />
          <Shimmer style={{ width: '95%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '80%', height: 12, borderRadius: 4 }} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
            <Shimmer style={{ width: 92, height: 24, borderRadius: 999 }} />
            <Shimmer style={{ width: 110, height: 24, borderRadius: 999 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

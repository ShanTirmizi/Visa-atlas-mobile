import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Skeleton state for the Tips tab — mirrors the editorial structure of
 * CountryTipsView (kicker + section title + a paragraph + bullet list +
 * a second sub-section). More substantial than a row of plain rectangles
 * so the user sees real content is loading.
 */
export function TipsTabSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: Spacing.lg,
        gap: 22,
        marginTop: Spacing.md,
      }}
    >
      {/* Section 1 — Packing */}
      <View style={{ gap: 10 }}>
        <Shimmer style={{ width: 90, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '70%', height: 26, borderRadius: 6 }} />
        <View style={{ marginTop: 6, gap: 8 }}>
          <Shimmer style={{ width: '95%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '90%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '85%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '80%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '70%', height: 12, borderRadius: 4 }} />
        </View>
      </View>

      {/* Section 2 — Where to stay */}
      <View
        style={{
          padding: Spacing.lg,
          borderRadius: Radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          gap: 10,
        }}
      >
        <Shimmer style={{ width: 110, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '60%', height: 22, borderRadius: 6 }} />
        <View style={{ marginTop: 4, gap: 6 }}>
          <Shimmer style={{ width: '95%', height: 11, borderRadius: 4 }} />
          <Shimmer style={{ width: '92%', height: 11, borderRadius: 4 }} />
          <Shimmer style={{ width: '88%', height: 11, borderRadius: 4 }} />
          <Shimmer style={{ width: '60%', height: 11, borderRadius: 4 }} />
        </View>
      </View>

      {/* Section 3 — Local essentials */}
      <View style={{ gap: 10 }}>
        <Shimmer style={{ width: 130, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '65%', height: 22, borderRadius: 6 }} />
        <View style={{ marginTop: 6, gap: 8 }}>
          <Shimmer style={{ width: '90%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '82%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '75%', height: 12, borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

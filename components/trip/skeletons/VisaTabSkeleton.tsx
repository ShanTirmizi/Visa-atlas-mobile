import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Skeleton state for the Visa tab — mirrors the editorial layout of
 * VisaHeroCard (tall hero with status pill + headline + subhead) plus
 * a checklist section and a notes section. More substantial than a
 * row of plain rectangles so the user sees that real content is on
 * its way.
 */
export function VisaTabSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: Spacing.lg,
        gap: 18,
        marginTop: Spacing.md,
      }}
    >
      {/* Hero visa card placeholder */}
      <View
        style={{
          borderRadius: Radius.lg,
          padding: Spacing.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          gap: 12,
          minHeight: 180,
          justifyContent: 'space-between',
        }}
      >
        {/* Top: status pill */}
        <Shimmer style={{ width: 120, height: 22, borderRadius: 999 }} />
        {/* Middle: kicker + headline */}
        <View style={{ gap: 10 }}>
          <Shimmer style={{ width: 90, height: 9, borderRadius: 4 }} />
          <Shimmer style={{ width: '85%', height: 28, borderRadius: 6 }} />
          <Shimmer style={{ width: '60%', height: 14, borderRadius: 4 }} />
        </View>
      </View>

      {/* Checklist section */}
      <View style={{ gap: 10 }}>
        <Shimmer style={{ width: 110, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '70%', height: 22, borderRadius: 6 }} />
        <View style={{ marginTop: 4, gap: 8 }}>
          <Shimmer style={{ width: '95%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '90%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '85%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '75%', height: 12, borderRadius: 4 }} />
        </View>
      </View>

      {/* Notes section */}
      <View style={{ gap: 10 }}>
        <Shimmer style={{ width: 90, height: 9, borderRadius: 4 }} />
        <Shimmer style={{ width: '60%', height: 22, borderRadius: 6 }} />
        <View style={{ marginTop: 4, gap: 8 }}>
          <Shimmer style={{ width: '92%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '88%', height: 12, borderRadius: 4 }} />
          <Shimmer style={{ width: '50%', height: 12, borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

// components/trip/skeletons/HighlightsSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Spacing } from '@/constants/theme';

/**
 * Three shimmering pill placeholders for the "highlights" row that sits
 * below the hero. Widths vary slightly so the row reads as natural copy
 * rather than identical placeholders.
 */
export function HighlightsSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: Spacing.lg,
        marginTop: Spacing.md,
      }}
    >
      <Shimmer style={{ width: 90, height: 22, borderRadius: 999 }} />
      <Shimmer style={{ width: 70, height: 22, borderRadius: 999 }} />
      <Shimmer style={{ width: 110, height: 22, borderRadius: 999 }} />
    </View>
  );
}

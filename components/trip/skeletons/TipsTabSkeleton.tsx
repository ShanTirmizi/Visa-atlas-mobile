// components/trip/skeletons/TipsTabSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Skeleton state for the Tips tab on the trip detail screen — a tall lead
 * card followed by two shorter rows.
 */
export function TipsTabSkeleton() {
  return (
    <View
      style={{
        paddingHorizontal: Spacing.lg,
        gap: 12,
        marginTop: Spacing.md,
      }}
    >
      <Shimmer style={{ height: 110, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 80, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 80, borderRadius: Radius.md }} />
    </View>
  );
}

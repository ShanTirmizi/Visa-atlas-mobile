// components/trip/skeletons/VisaTabSkeleton.tsx
import { View } from 'react-native';
import { Shimmer } from './_shimmer';
import { Radius, Spacing } from '@/constants/theme';

/**
 * Skeleton state for the Visa tab on the trip detail screen — a tall hero
 * card followed by three smaller information rows.
 */
export function VisaTabSkeleton() {
  return (
    <View
      style={{
        paddingHorizontal: Spacing.lg,
        gap: 12,
        marginTop: Spacing.md,
      }}
    >
      <Shimmer style={{ height: 90, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
      <Shimmer style={{ height: 60, borderRadius: Radius.md }} />
    </View>
  );
}

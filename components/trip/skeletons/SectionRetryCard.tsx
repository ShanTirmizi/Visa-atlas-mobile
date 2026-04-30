// components/trip/skeletons/SectionRetryCard.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Radius, Spacing } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { RotateCw } from 'lucide-react-native';

interface SectionRetryCardProps {
  tripId: Id<'trips'>;
  section: string;
  /** User-facing label for the failed section, e.g. "visa info" */
  label: string;
}

/**
 * Per-section failure state card surfaced when streamed trip generation
 * fails for one slice (visa, highlights, tips, etc.). Other sections are
 * unaffected — tapping retry re-runs only this slice via the
 * `tripGeneration.retrySection` Convex action.
 */
export function SectionRetryCard({ tripId, section, label }: SectionRetryCardProps) {
  const { colors } = useTheme();
  const retry = useAction(api.tripGeneration.retrySection);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    setRetrying(true);
    setError(null);
    try {
      await retry({ tripId, section });
    } catch {
      setError("Couldn't retry. Try again in a moment.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      style={{
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        padding: 14,
        borderRadius: Radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Text style={[Type.body13, { color: colors.ink, marginBottom: 6 }]}>
        Couldn't generate {label}
      </Text>
      <Text style={[Type.kickerSm, { color: colors.inkMute, fontSize: 11, marginBottom: 12 }]}>
        Tap retry to try again — your other sections are unaffected.
      </Text>
      <Pressable
        onPress={onPress}
        disabled={retrying}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: colors.coral,
          opacity: pressed || retrying ? 0.7 : 1,
        })}
      >
        <RotateCw size={12} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
          {retrying ? 'Retrying...' : 'Retry'}
        </Text>
      </Pressable>
      {error && (
        <Text style={{ color: colors.coral, fontSize: 11, marginTop: 8 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

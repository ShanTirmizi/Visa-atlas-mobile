// components/trip/TripFailedScreen.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';

interface TripFailedScreenProps {
  trip: Doc<'trips'>;
}

/**
 * Full-screen error state shown when trip generation hits the 60s watchdog
 * timeout (status === 'failed'). Offers Try Again — which re-runs the
 * generation pipeline using the saved `originalInputs` and deletes the failed
 * stub once the new trip is created — and Delete — which discards the stub
 * and returns to the trips list.
 *
 * Mounted by the trip detail screen via a status check (Task 4.7); does NOT
 * render its own <TopSafeAreaBlur /> because the parent route already does.
 */
export function TripFailedScreen({ trip }: TripFailedScreenProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const generate = useAction(api.tripGeneration.generateTrip);
  const deleteTrip = useMutation(api.trips.deleteTrip);
  const [retrying, setRetrying] = useState(false);

  const onTryAgain = async () => {
    if (!trip.originalInputs) {
      // No inputs stored — fall back to deleting and asking the user to start again
      await deleteTrip({ id: trip._id });
      router.replace('/(tabs)/trips');
      return;
    }
    setRetrying(true);
    try {
      const inputs = JSON.parse(trip.originalInputs);
      const newTripId = await generate(inputs);
      // Delete the failed stub
      await deleteTrip({ id: trip._id });
      router.replace(`/trip/${newTripId}`);
    } catch {
      setRetrying(false);
    }
  };

  const onDelete = async () => {
    await deleteTrip({ id: trip._id });
    router.replace('/(tabs)/trips');
  };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <AlertTriangle size={42} color={colors.coral} strokeWidth={1.6} />
      <Text
        style={[
          Type.display22Italic,
          {
            color: colors.ink,
            marginTop: 18,
            marginBottom: 6,
            textAlign: 'center',
          },
        ]}
      >
        Couldn't create your trip<Text style={{ color: colors.coral }}>.</Text>
      </Text>
      <Text style={[Type.body13, { color: colors.inkMute, textAlign: 'center', marginBottom: 28 }]}>
        Something went wrong while generating. Your inputs are saved — try again.
      </Text>
      <Pressable
        onPress={onTryAgain}
        disabled={retrying}
        style={({ pressed }) => ({
          paddingHorizontal: 28,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: colors.coral,
          opacity: pressed || retrying ? 0.7 : 1,
          marginBottom: 12,
        })}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
          {retrying ? 'Trying again...' : 'Try again'}
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        style={({ pressed }) => ({
          paddingHorizontal: 28,
          paddingVertical: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.inkMute, fontSize: 13 }}>Delete</Text>
      </Pressable>
    </View>
  );
}

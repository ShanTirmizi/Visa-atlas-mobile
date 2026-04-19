import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';
import { Photo } from '@/components/ui/Photo';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function TripsGreeting() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
      }}
    >
      {/* Left: greeting + atlas title */}
      <View style={{ flex: 1 }}>
        <Text style={[Type.body13, { color: colors.inkMute }]}>
          {getGreeting()}
        </Text>
        <Text style={[Type.display24, { color: colors.ink, marginTop: 2 }]}>
          Your atlas
        </Text>
      </View>

      {/* Right: avatar → settings */}
      <Pressable
        onPress={() => router.push('/more/settings')}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Photo
          tone="warm"
          radius={21}
          style={{ width: 42, height: 42 }}
        />
      </Pressable>
    </View>
  );
}

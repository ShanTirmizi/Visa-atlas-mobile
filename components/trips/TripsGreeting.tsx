import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

function getGreetingParts(): { lead: string; closer: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { lead: 'Good', closer: 'morning' };
  if (hour < 17) return { lead: 'Good', closer: 'afternoon' };
  return { lead: 'Good', closer: 'evening' };
}

export function TripsGreeting() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lead, closer } = getGreetingParts();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[Type.kicker, { color: colors.inkMute }]}>YOUR ATLAS</Text>
        <Text
          style={{
            fontFamily: FontFamily.display,
            fontSize: 30,
            fontWeight: '500',
            letterSpacing: -30 * 0.022,
            lineHeight: 30,
            color: colors.ink,
            marginTop: 4,
          }}
        >
          {lead}{' '}
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
            }}
          >
            {closer}
          </Text>
          <Text style={{ color: colors.coral }}>.</Text>
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/more/settings')}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={({ pressed }) => ({
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 4,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Settings size={18} color={colors.ink} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

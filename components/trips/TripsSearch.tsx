import React from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { Search, Sparkles } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';
import type { TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';

interface TripsSearchProps {
  plannerRef: React.RefObject<TripPlannerSheetRef | null>;
}

export function TripsSearch({ plannerRef }: TripsSearchProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: colors.line,
        gap: 10,
        marginHorizontal: 22,
      }}
    >
      {/* Magnifier */}
      <Search size={16} color={colors.inkMute} />

      {/* Stub input */}
      <TextInput
        placeholder="Search your trips"
        placeholderTextColor={colors.inkFaint}
        editable={false}
        style={[
          Type.body13,
          {
            flex: 1,
            color: colors.ink,
            padding: 0,
            margin: 0,
          },
        ]}
      />

      {/* AI plan pill */}
      <Pressable
        onPress={() => plannerRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel="AI trip planner"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.ink,
          paddingVertical: 6,
          paddingHorizontal: 11,
          borderRadius: 999,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Sparkles size={11} color="#FFFFFF" />
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            fontWeight: '600',
            color: '#FFFFFF',
          }}
        >
          AI plan
        </Text>
      </Pressable>
    </View>
  );
}

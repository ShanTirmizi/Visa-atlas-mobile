import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, Sparkles, X } from 'lucide-react-native';
import { Type } from '@/constants/typography';
import { useTheme } from '@/contexts/theme-context';
import type { TripPlannerSheetRef } from '@/components/trip/TripPlannerSheet';

interface TripsSearchProps {
  plannerRef: React.RefObject<TripPlannerSheetRef | null>;
  /** Live search query — filters the trips list and country results below. */
  value: string;
  onChangeText: (next: string) => void;
}

/** Search input + a separate teal AI orb. Live-filters the trips list and
 *  country results below; the AI orb opens the planner sheet. */
export function TripsSearch({ plannerRef, value, onChangeText }: TripsSearchProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 22,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 22,
          paddingHorizontal: 16,
          height: 44,
          borderWidth: 1,
          borderColor: colors.line,
          gap: 10,
        }}
      >
        <Search size={16} color={colors.inkMute} />
        <TextInput
          placeholder="Search trips & places"
          placeholderTextColor={colors.inkFaint}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[
            Type.body14,
            {
              flex: 1,
              color: colors.ink,
              padding: 0,
              margin: 0,
            },
          ]}
        />
        {value.length > 0 ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8}>
            <X size={14} color={colors.inkMute} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => plannerRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel="AI trip planner"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.teal,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: colors.teal,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 6,
        })}
      >
        <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

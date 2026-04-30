import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { Radius } from '@/constants/theme';
import { Type } from '@/constants/typography';
import { PLANNER_PROMPTS } from '@/constants/plannerPrompts';

const ROTATION_INTERVAL_MS = 3500;
const FADE_DURATION_MS = 200;
const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = 450;
const LINE_HEIGHT = 21; // 14 * 1.5 — matches Type.body14
const MAX_LINES = 5;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
}

export function TripPlannerNotesField({ value, onChangeText }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * PLANNER_PROMPTS.length),
  );
  const opacity = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const isEmpty = value.length === 0;
  const isRotating = isEmpty && !focused;

  useEffect(() => {
    if (!isRotating) return;

    let pendingSwap: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // swap the prompt at the midpoint of the fade (while it's invisible).
      // Track the timeout so cleanup can cancel it — otherwise it can fire
      // after the user focuses or unmounts and bump promptIndex stale.
      if (pendingSwap) clearTimeout(pendingSwap);
      pendingSwap = setTimeout(() => {
        setPromptIndex((i) => (i + 1) % PLANNER_PROMPTS.length);
        pendingSwap = null;
      }, FADE_DURATION_MS);
    }, ROTATION_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (pendingSwap) clearTimeout(pendingSwap);
    };
  }, [isRotating, opacity]);

  const counterVisible = value.length >= COUNTER_THRESHOLD;
  const currentPrompt = PLANNER_PROMPTS[promptIndex];

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={styles.headerRow}>
        <Sparkles size={16} color={colors.inkMute} strokeWidth={2} />
        <Text style={[Type.title14, { color: colors.ink, marginLeft: 6 }]}>
          Anything else?
        </Text>
      </View>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.coralGlow : colors.line,
            borderRadius: Radius.md,
          },
        ]}
      >
        <View style={styles.inputWrap}>
          {/* Placeholder layer — sits behind the input visually */}
          {isEmpty && (
            <Animated.Text
              style={[
                Type.body14,
                styles.placeholderText,
                { color: colors.inkMute, opacity: focused ? 0 : opacity },
              ]}
              pointerEvents="none"
              numberOfLines={1}
            >
              {currentPrompt}
            </Animated.Text>
          )}
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            multiline
            scrollEnabled
            maxLength={MAX_LENGTH}
            style={[
              Type.body14,
              styles.input,
              { color: colors.ink, minHeight: LINE_HEIGHT },
            ]}
            // No `placeholder` prop — we render our own animated layer above
          />
        </View>
        {counterVisible && (
          <Text
            style={[
              Type.body13,
              { color: colors.inkMute, alignSelf: 'flex-end', marginTop: 4 },
            ]}
          >
            {value.length}/{MAX_LENGTH}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  field: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputWrap: {
    position: 'relative',
  },
  placeholderText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  input: {
    padding: 0,
    margin: 0,
    maxHeight: LINE_HEIGHT * MAX_LINES,
  },
});

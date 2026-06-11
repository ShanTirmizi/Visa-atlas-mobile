import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { Id } from '@/convex/_generated/dataModel';
import { Send, Sparkles, ArrowRight } from 'lucide-react-native';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/contexts/theme-context';
import { Squiggle } from '@/components/ui/Squiggle';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';
import { endpoints } from '@/constants/api';
import { FontFamily, Spacing } from '@/constants/theme';

type GuideMessage = {
  _id: string;
  guideId: Id<'visaGuides'>;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

// Cycling thinking copy — visa-flavoured to match the screen's role.
const THINKING_PHRASES = [
  'Thinking',
  'Reading the visa rules',
  'Cross-checking the guide',
  'Looking at fine print',
  'Asking the consul',
  'Stamping the answer',
  'Pulling threads together',
] as const;

export default function VisaChatScreen() {
  const { guideId } = useLocalSearchParams<{ guideId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const { isAuthenticated } = useConvexAuth();

  const guide = useQuery(
    api.visaGuides.getGuide,
    isAuthenticated && guideId ? { id: guideId as Id<'visaGuides'> } : 'skip',
  );
  const messages = useQuery(
    api.visaGuides.listGuideMessages,
    isAuthenticated && guideId ? { guideId: guideId as Id<'visaGuides'> } : 'skip',
  ) as GuideMessage[] | undefined;
  const addGuideMessage = useMutation(api.visaGuides.addGuideMessage);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [thinkTick, setThinkTick] = useState(0);

  // Cycle the thinking phrase every ~2.2s while in flight; reset on send.
  useEffect(() => {
    if (!isSending) {
      setThinkTick(0);
      return;
    }
    const id = setInterval(() => {
      setThinkTick((t) => t + 1);
    }, 2200);
    return () => clearInterval(id);
  }, [isSending]);

  const countryName = guide?.countryName ?? 'your visa';
  const visaType = guide?.visaType ?? '';
  const guideJson = guide?.guide ?? '';
  const alpha2 = toAlpha2(guide?.countryCode ?? '');

  const sendChat = useCallback(
    async (text: string) => {
      if (!text || isSending || !guide) return;

      setIsSending(true);
      setFailedMessage(null);

      await addGuideMessage({
        guideId: guideId as Id<'visaGuides'>,
        role: 'user',
        content: text,
      });

      try {
        const chatHistory = (messages ?? [])
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(endpoints.visaChat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            guideContext: { countryName, visaType, guide: guideJson },
            chatHistory,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { reply?: string; error?: string };
        if (!data.reply) throw new Error('Empty reply');

        await addGuideMessage({
          guideId: guideId as Id<'visaGuides'>,
          role: 'assistant',
          content: data.reply,
        });
      } catch (err) {
        console.warn('visa-chat failed', err);
        setFailedMessage(text);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, guide, guideId, messages, countryName, visaType, guideJson, addGuideMessage],
  );

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    await sendChat(text);
  }, [inputText, sendChat]);

  const retryFailed = useCallback(() => {
    if (failedMessage) void sendChat(failedMessage);
  }, [failedMessage, sendChat]);

  const dismissFailed = useCallback(() => setFailedMessage(null), []);

  const SUGGESTIONS = [
    'Do I need bank statements?',
    visaType ? `How long does the ${visaType} take to process?` : 'How long does the visa take to process?',
    'What photos do I need for my application?',
    'Can I work on this visa?',
  ];

  const renderMessage = useCallback(
    ({ item }: { item: GuideMessage }) => {
      const isAssistant = item.role === 'assistant';

      if (isAssistant) {
        return (
          <View style={styles.aiBubbleWrap}>
            <View
              style={[
                styles.aiBubble,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <View style={styles.aiHeader}>
                <View style={[styles.aiOrb, { backgroundColor: colors.coralBg }]}>
                  <Sparkles
                    size={11}
                    color={colors.coralDeep}
                    strokeWidth={2.2}
                    fill={colors.coralDeep}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: FontFamily.monoMedium,
                    fontSize: 9,
                    fontWeight: '700',
                    letterSpacing: 9 * 0.22,
                    textTransform: 'uppercase',
                    color: colors.coralDeep,
                  }}
                >
                  VISA ATLAS AI
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: FontFamily.regular,
                  fontSize: 14.5,
                  lineHeight: 22,
                  color: colors.ink,
                }}
              >
                {item.content}
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.userBubbleWrap}>
          <View style={[styles.userBubble, { backgroundColor: colors.coral }]}>
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 9 * 0.22,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
                marginBottom: 6,
              }}
            >
              YOU
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 17,
                lineHeight: 22,
                letterSpacing: -17 * 0.014,
                fontWeight: '500',
                color: '#FFFFFF',
              }}
            >
              {item.content}
            </Text>
          </View>
        </View>
      );
    },
    [colors],
  );

  const keyExtractor = useCallback((item: GuideMessage) => item._id, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Editorial header ───────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={{ position: 'absolute', left: Spacing.md, top: insets.top + Spacing.sm }}>
          <BackButton />
        </View>

        <View style={styles.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Sparkles size={9} color={colors.coralDeep} strokeWidth={2.2} fill={colors.coralDeep} />
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 9 * 0.22,
                color: colors.coralDeep,
              }}
            >
              VISA COPILOT
            </Text>
            <Squiggle width={18} height={6} color={colors.coral} />
          </View>
          <Text
            style={{
              fontFamily: FontFamily.displayItalic,
              fontStyle: 'italic',
              fontSize: 22,
              lineHeight: 24,
              letterSpacing: -22 * 0.018,
              fontWeight: '500',
              color: colors.ink,
            }}
            numberOfLines={1}
          >
            {countryName}
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          {visaType ? (
            <Text
              style={{
                fontFamily: FontFamily.monoMedium,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 9 * 0.22,
                textTransform: 'uppercase',
                color: colors.inkMute,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {visaType}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />

      {/* ── Empty state ─────────────────────────────── */}
      {(!messages || messages.length === 0) && !isSending ? (
        <View style={styles.emptyContainer}>
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: colors.coralBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Sparkles
                size={32}
                color={colors.coralDeep}
                strokeWidth={1.8}
                fill={colors.coralDeep}
              />
              {alpha2 ? (
                <View
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: colors.background,
                  }}
                >
                  <Flag code={alpha2} size={28} />
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text
                style={{
                  fontFamily: FontFamily.monoMedium,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 10 * 0.22,
                  color: colors.coralDeep,
                }}
              >
                ASK ANYTHING
              </Text>
              <Squiggle width={28} color={colors.coral} />
            </View>

            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 28,
                lineHeight: 32,
                letterSpacing: -28 * 0.022,
                fontWeight: '500',
                color: colors.ink,
                textAlign: 'center',
              }}
            >
              Visa, decoded
              <Text style={{ color: colors.coral }}>.</Text>
            </Text>
            <Text
              style={{
                fontFamily: FontFamily.regular,
                fontSize: 14,
                lineHeight: 20,
                color: colors.inkSoft,
                textAlign: 'center',
                marginTop: 8,
                paddingHorizontal: 24,
              }}
            >
              I&apos;ve read the {countryName} guide cover to cover. Ask me about documents, timing, or anything in fine print.
            </Text>
          </View>

          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.line,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => {
                  setInputText(s);
                  inputRef.current?.focus();
                }}
              >
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.coral,
                    marginRight: 10,
                  }}
                />
                <Text
                  style={{
                    fontFamily: FontFamily.regular,
                    fontSize: 14,
                    color: colors.ink,
                    flex: 1,
                  }}
                >
                  {s}
                </Text>
                <ArrowRight size={13} color={colors.inkMute} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages ?? []}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isSending ? <ThinkingRow tick={thinkTick} /> : null}
        />
      )}

      {/* Retry banner */}
      {failedMessage ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: Spacing.lg,
            paddingVertical: 10,
            backgroundColor: colors.warningBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.line,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: FontFamily.regular,
              fontSize: 13,
              color: colors.ink,
            }}
            numberOfLines={2}
          >
            Couldn&apos;t reach Visa Atlas. Tap retry to send again.
          </Text>
          <TouchableOpacity onPress={retryFailed} hitSlop={8}>
            <Text style={{ fontFamily: FontFamily.semibold, fontSize: 13, color: colors.coralDeep }}>
              Retry
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismissFailed} hitSlop={8}>
            <Text style={{ fontFamily: FontFamily.medium, fontSize: 13, color: colors.inkMute }}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: colors.line,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.surface,
              borderColor: isFocused ? colors.coral : colors.line,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.ink }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your visa…"
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={500}
            onFocus={() => {
              setIsFocused(true);
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              });
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 280);
            }}
            onBlur={() => setIsFocused(false)}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
        </View>
        <SendButton
          active={inputText.trim().length > 0}
          sending={isSending}
          onPress={sendMessage}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Thinking row + dots
// ─────────────────────────────────────────────────────────────────────────────

function ThinkingRow({ tick }: { tick: number }) {
  const { colors } = useTheme();
  const phrase = THINKING_PHRASES[tick % THINKING_PHRASES.length];
  return (
    <View style={[styles.thinkingRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={[styles.aiOrb, { backgroundColor: colors.coralBg }]}>
        <Sparkles size={11} color={colors.coralDeep} strokeWidth={2.2} fill={colors.coralDeep} />
      </View>
      <Animated.Text
        key={tick}
        entering={FadeIn.duration(280)}
        exiting={FadeOut.duration(180)}
        style={{
          fontFamily: FontFamily.monoMedium,
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 9 * 0.22,
          textTransform: 'uppercase',
          color: colors.coralDeep,
        }}
      >
        {phrase}
      </Animated.Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
        {[0, 1, 2].map((i) => (
          <ThinkingDot key={i} delay={i * 180} color={colors.coral} />
        ))}
      </View>
    </View>
  );
}

function ThinkingDot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
          withTiming(0.3, { duration: 320, easing: Easing.in(Easing.cubic) }),
        ),
      ),
      -1,
    );
  }, [delay, opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }, animStyle]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Send button (persistent — never disappears)
// ─────────────────────────────────────────────────────────────────────────────

function SendButton({
  active,
  sending,
  onPress,
}: {
  active: boolean;
  sending: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isFilled = active || sending;
  const disabled = sending || !active;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Send message"
      style={({ pressed }) => [
        styles.sendButton,
        {
          backgroundColor: isFilled ? colors.coral : colors.surface,
          borderColor: isFilled ? colors.coral : colors.line,
          transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
          opacity: !isFilled ? 0.6 : 1,
        },
      ]}
    >
      {sending ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Send
          size={16}
          color={isFilled ? '#FFFFFF' : colors.inkMute}
          strokeWidth={2.2}
          fill={isFilled ? '#FFFFFF' : 'transparent'}
        />
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { flex: 1, paddingHorizontal: 22, paddingTop: 40 },
  suggestions: { gap: 10 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  messagesList: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 10 },

  userBubbleWrap: { alignItems: 'flex-end', marginVertical: 4 },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomRightRadius: 6,
  },

  aiBubbleWrap: { alignItems: 'flex-start', marginVertical: 4 },
  aiBubble: {
    maxWidth: '92%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiOrb: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    marginVertical: 4,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  input: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 20, minHeight: 24 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});

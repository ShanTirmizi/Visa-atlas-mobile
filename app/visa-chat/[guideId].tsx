import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardEvents,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
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
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
import { Id } from '@/convex/_generated/dataModel';
import { Send, Sparkles } from 'lucide-react-native';
import BackButton from '@/components/ui/BackButton';
import TopSafeAreaBlur from '@/components/ui/TopSafeAreaBlur';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { hapticSelect } from '@/utils/haptics';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { Squiggle } from '@/components/ui/Squiggle';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';
import { FontFamily, Spacing } from '@/constants/theme';

type GuideMessage = {
  _id: string;
  guideId: Id<'visaGuides'>;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

// Cycling thinking copy — visa-flavoured to match the screen's role.
// Cadence matches the trip-chat screen (~2.2s per phrase).
const THINK_TICK_MS = 2200;
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
  // Passport + residence keep the consultant's answers nationality-correct.
  const { passports, residence } = useVisa();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Re-pin the message list to the bottom the moment the keyboard finishes
  // settling — event-driven (KeyboardEvents), never a guessed duration.
  useEffect(() => {
    const sub = KeyboardEvents.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);

  // iMessage input-bar padding: at rest the bar clears the home indicator
  // (insets.bottom); with the keyboard up, KeyboardAvoidingView already
  // lifts the bar, so keeping the inset would double-count it as a dead
  // band above the keyboard. Collapse it on the UI thread as the keyboard
  // animates — also tracks interactive swipe-to-dismiss frame-by-frame.
  const { progress: kbProgress } = useReanimatedKeyboardAnimation();
  const inputBarAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: Spacing.sm + insets.bottom * (1 - kbProgress.value),
  }));

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
  const proxyVisaChat = useAction(api.aiProxy.visaChat);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  // Floating-header height — pre-layout estimate, corrected by onLayout on
  // the first frame (same pattern as app/guide/[id].tsx). Drives the
  // TopSafeAreaBlur `extra` band and the scroll content's top padding.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 70);

  const countryName = guide?.countryName ?? 'your visa';
  const visaType = guide?.visaType ?? '';
  const guideJson = guide?.guide ?? '';
  const alpha2 = toAlpha2(guide?.countryCode ?? '');

  const sendChat = useCallback(
    async (text: string) => {
      if (!text || isSending || !guide) return;

      setIsSending(true);
      setFailedMessage(null);

      try {
        // Inside the try: if this first write fails (offline / socket blip),
        // the catch surfaces the retry banner with the text preserved and
        // `finally` releases the spinner — outside it, a rejection stranded
        // isSending forever and the message was silently lost.
        await addGuideMessage({
          guideId: guideId as Id<'visaGuides'>,
          role: 'user',
          content: text,
        });

        const chatHistory = (messages ?? [])
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        // Authenticated + rate-limited proxy (convex/aiProxy.ts) — the raw
        // Vercel endpoint is being locked down. A dropped socket rejects
        // into the existing catch → retry banner, same as the old fetch.
        const data = (await proxyVisaChat({
          body: JSON.stringify({
            message: text,
            guideContext: { countryName, visaType, guide: guideJson },
            chatHistory,
            passports,
            residence,
          }),
        })) as { reply?: string; error?: string };
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
    [isSending, guide, guideId, messages, countryName, visaType, guideJson, passports, residence, addGuideMessage, proxyVisaChat],
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

  const suggestions = useMemo(
    () => [
      'Do I need bank statements?',
      visaType ? `How long does the ${visaType} take to process?` : 'How long does the visa take to process?',
      'What photos do I need for my application?',
      'Can I work on this visa?',
    ],
    [visaType],
  );

  // Starter chips send straight through sendChat (same guards as the input
  // bar) — never just prefill the input. Matches the trip-chat starter
  // pattern (iMessage / ChatGPT starter suggestions).
  const onStarterPress = useCallback(
    (prompt: string) => {
      hapticSelect();
      void sendChat(prompt);
    },
    [sendChat],
  );

  // Memoized so the FlatList data identity is stable while `messages` is
  // still undefined and the React.memo'd rows can bail out between renders.
  const listMessages = useMemo(() => messages ?? [], [messages]);

  const renderMessage = useCallback(
    ({ item }: { item: GuideMessage }) => <MessageBubble message={item} />,
    [],
  );

  const scrollToEnd = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      // "padding" resizes the container from the bottom and keeps the
      // header pinned — "translate-with-padding" pushed the header above
      // the Dynamic Island on device. See app/chat/[tripId].tsx for the
      // full note. Passed unconditionally: RNKC KAV is a no-op when
      // behavior is undefined.
      behavior="padding"
    >
      {/* ── Editorial header — floats over the list (Apple Mail pattern,
          same recipe as app/guide/[id].tsx and app/chat/[tripId].tsx):
          messages scroll beneath it and fade out under the TopSafeAreaBlur
          mounted as the last child below; zIndex 110 keeps the header text
          crisp above the blur (100). box-none: drags on the empty edges
          fall through to the messages beneath. ── */}
      <View
        pointerEvents="box-none"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
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

      {/* ── Empty state ─────────────────────────────── */}
      {(!messages || messages.length === 0) && !isSending ? (
        // ScrollView (not View) so drag-down dismisses the keyboard
        // interactively, matching the populated FlatList below — iMessage
        // behaves the same on an empty conversation.
        <ScrollView
          contentContainerStyle={[
            styles.emptyContainer,
            { paddingTop: headerHeight + 40 },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

          {/* Starter prompts — soft pills that send on tap. Soft pill =
              bg-tint + coloured text, no leading dot (house rule). Same
              recipe as the trip-chat starter chips. */}
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                disabled={isSending}
                accessibilityRole="button"
                accessibilityLabel={s}
                onPress={() => onStarterPress(s)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.coralBg,
                    opacity: isSending ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: FontFamily.medium,
                    fontSize: 14,
                    lineHeight: 19,
                    color: colors.coralDeep,
                    textAlign: 'center',
                  }}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={listMessages}
          renderItem={renderMessage}
          keyExtractor={messageKeyExtractor}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: headerHeight + 18 },
          ]}
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          ListFooterComponent={isSending ? <ThinkingRow /> : null}
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
      <Animated.View
        style={[
          styles.inputBar,
          inputBarAnimatedStyle,
          {
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
              // Immediate scroll-to-bottom on focus; the component-level
              // keyboardDidShow listener re-pins once the keyboard settles.
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              });
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
      </Animated.View>

      {/* House chrome — LAST child so it frosts everything painted before
          it. Scrolled messages fade out under the safe area + header band
          over an 18px gradient instead of hitting a hard edge. */}
      <TopSafeAreaBlur extra={Math.max(0, headerHeight - insets.top)} />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble — module-level + React.memo so the FlatList re-renders only
// rows whose props changed. The previous inline closure rebuilt every visible
// bubble on each parent state tick (typing, focus, sending).
// ─────────────────────────────────────────────────────────────────────────────

// Module-scope so the FlatList sees one stable function identity.
const messageKeyExtractor = (item: GuideMessage) => item._id;

const MessageBubble = React.memo(function MessageBubble({
  message,
}: {
  message: GuideMessage;
}) {
  const { colors } = useTheme();

  if (message.role === 'assistant') {
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
          <MarkdownText
            text={message.content}
            baseStyle={{
              fontFamily: FontFamily.regular,
              fontSize: 14.5,
              lineHeight: 22,
              color: colors.ink,
            }}
            accentColor={colors.coralDeep}
            mutedColor={colors.inkMute}
            codeBg={colors.surfaceMuted}
          />
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
          selectable
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
          {message.content}
        </Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Thinking row + dots
// ─────────────────────────────────────────────────────────────────────────────

function ThinkingRow() {
  const { colors } = useTheme();
  // The 2.2s phrase cycle lives INSIDE this footer so each tick re-renders
  // only the row — when the interval lived in the screen component, every
  // tick re-rendered the whole message list. The row unmounts when the send
  // settles, so each new send naturally restarts at the plain "Thinking".
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), THINK_TICK_MS);
    return () => clearInterval(id);
  }, []);
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
  // Header floats over the message list; zIndex above TopSafeAreaBlur (100)
  // so the title and BackButton stay crisp on top of the frost.
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 110,
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', justifyContent: 'center' },

  // flexGrow (not flex): it's a ScrollView contentContainerStyle. Top
  // padding is applied inline (headerHeight + 40) since the header floats.
  emptyContainer: { flexGrow: 1, paddingHorizontal: 22 },
  // pills hug their text and sit centered, iMessage-style
  suggestions: { gap: 10, alignItems: 'center' },
  suggestionChip: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22, // full pill
  },

  // Top padding applied inline (headerHeight + 18) since the header floats.
  messagesList: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },

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

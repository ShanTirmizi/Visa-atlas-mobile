import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { TextInput as GestureTextInput } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

const CHAT_SNAP_POINTS = ['90%'];
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { MessageSquare, Send, Bot, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/theme-context';
import { endpoints } from '@/constants/api';
import { FontFamily, FontSize, Spacing, Radius } from '@/constants/theme';

// ── Types ──────────────────────────────────────────────────────────────

interface Props {
  guideId: string;
  countryName: string;
  visaType: string;
  guideJson: string;
}

export interface VisaChatSheetRef {
  open: () => void;
  close: () => void;
}

type GuideMessage = {
  _id: string;
  guideId: Id<'visaGuides'>;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  userId?: Id<'users'>;
};

// ── Component ──────────────────────────────────────────────────────────

const VisaChatSheet = forwardRef<VisaChatSheetRef, Props>(
  ({ guideId, countryName, visaType, guideJson }, ref) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const inputRef = useRef<GestureTextInput | null>(null);
    const flatListRef = useRef<any>(null);

    const { isAuthenticated } = useConvexAuth();

    const messages = useQuery(
      api.visaGuides.listGuideMessages,
      isAuthenticated && guideId
        ? { guideId: guideId as Id<'visaGuides'> }
        : 'skip',
    ) as GuideMessage[] | undefined;

    const addGuideMessage = useMutation(api.visaGuides.addGuideMessage);

    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [failedMessage, setFailedMessage] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.present(),
      close: () => sheetRef.current?.dismiss(),
    }));

    const maxDynamicContentSize =
      Dimensions.get('window').height - insets.top - 10;

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.4}
        />
      ),
      [],
    );

    const sendChat = useCallback(
      async (text: string) => {
        if (!text || isSending) return;

        setIsSending(true);
        setFailedMessage(null);

        // Persist user message immediately
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
              guideContext: {
                countryName,
                visaType,
                guide: guideJson,
              },
              chatHistory,
            }),
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = (await res.json()) as { reply?: string; error?: string };

          if (!data.reply) {
            throw new Error('Empty reply');
          }

          // Persist AI reply
          await addGuideMessage({
            guideId: guideId as Id<'visaGuides'>,
            role: 'assistant',
            content: data.reply,
          });
        } catch (err) {
          console.warn('visa-chat failed', err);
          // Soft retry banner — do NOT persist a fake assistant message
          setFailedMessage(text);
        } finally {
          setIsSending(false);
        }
      },
      [isSending, guideId, messages, countryName, visaType, guideJson, addGuideMessage],
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

    // ── Message bubble renderer ──────────────────────────────────────
    const renderMessage = useCallback(
      ({ item }: { item: GuideMessage }) => {
        const isAssistant = item.role === 'assistant';

        return (
          <View
            style={[
              styles.bubble,
              isAssistant
                ? [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }]
                : [styles.userBubble, { backgroundColor: colors.primary }],
            ]}
          >
            <View style={styles.bubbleHeader}>
              {isAssistant ? (
                <Bot size={12} color={colors.inkMute} />
              ) : (
                <User size={12} color={colors.primaryButtonText ?? '#FFFFFF'} />
              )}
              <Text
                style={[
                  styles.bubbleKicker,
                  {
                    color: isAssistant ? colors.inkMute : (colors.primaryButtonText ?? '#FFFFFF'),
                  },
                ]}
              >
                {isAssistant ? 'VISA ATLAS AI' : 'YOU'}
              </Text>
            </View>
            <Text
              style={[
                styles.bubbleText,
                {
                  color: isAssistant ? colors.foreground : '#FFFFFF',
                },
              ]}
            >
              {item.content}
            </Text>
          </View>
        );
      },
      [colors],
    );

    const keyExtractor = useCallback((item: GuideMessage) => item._id, []);

    // ── Empty state suggestions ──────────────────────────────────────
    const SUGGESTIONS = [
      'Do I need bank statements?',
      `How long does the ${visaType} take to process?`,
      'What photos do I need for my application?',
      'Can I work on this visa?',
    ];

    // ── Render ───────────────────────────────────────────────────────
    return (
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        maxDynamicContentSize={maxDynamicContentSize}
        // 90% snap is the keyboard-extend target so the chat list has room
        // to scroll the latest message above the keyboard. `extend` is more
        // deterministic than `interactive` for dynamic-sized sheets.
        snapPoints={CHAT_SNAP_POINTS}
        topInset={insets.top + 10}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.background, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: colors.inkFaint, width: 36, height: 4 }}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View
            style={[
              styles.headerIconWrap,
              { backgroundColor: colors.primaryBg },
            ]}
          >
            <MessageSquare size={16} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.ink }]}>
              Ask about your visa
            </Text>
            <Text style={[styles.headerSub, { color: colors.inkMute }]}>
              {countryName} · {visaType}
            </Text>
          </View>
        </View>

        {/* Messages or empty state */}
        {(!messages || messages.length === 0) && !isSending ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Ask me anything
            </Text>
            <Text style={[styles.emptySub, { color: colors.inkMute }]}>
              I can answer questions about your {countryName} visa application
            </Text>
            <View style={styles.suggestionsWrap}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.suggestionChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    setInputText(s);
                    inputRef.current?.focus();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.suggestionText, { color: colors.primary }]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <BottomSheetFlatList
            ref={flatListRef}
            data={messages ?? []}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isSending ? (
                <View
                  style={[
                    styles.typingRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.typingText,
                      { color: colors.inkMute },
                    ]}
                  >
                    Thinking...
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Retry banner */}
        {failedMessage ? (
          <View
            style={[
              styles.retryBanner,
              {
                backgroundColor: colors.warningBg,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.retryText, { color: colors.ink }]}
              numberOfLines={2}
            >
              Couldn't reach Visa Atlas. Tap retry to send your message again.
            </Text>
            <TouchableOpacity onPress={retryFailed} hitSlop={8}>
              <Text style={[styles.retryAction, { color: colors.coralDeep }]}>
                Retry
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissFailed} hitSlop={8}>
              <Text style={[styles.retryDismiss, { color: colors.inkMute }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Input row — gorhom's keyboardBehavior="extend" + topInset handle
            keyboard avoidance for the sheet itself; no KeyboardAvoidingView
            needed. The focus handler scrolls the message list to keep the
            latest reply visible above the now-shorter chat area. */}
        <View
          style={[
            styles.inputBar,
            {
              paddingBottom: insets.bottom + Spacing.sm,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <BottomSheetTextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => {
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              });
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 280);
            }}
            placeholder="Ask about your visa..."
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send
                size={18}
                color={inputText.trim() ? '#FFFFFF' : colors.inkFaint}
              />
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    );
  },
);

VisaChatSheet.displayName = 'VisaChatSheet';
export default VisaChatSheet;

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.display,
    fontStyle: 'italic',
    fontSize: FontSize.lg,
    lineHeight: 22,
  },
  headerSub: {
    fontFamily: FontFamily.condensed,
    fontSize: FontSize.xs,
    marginTop: 1,
  },

  // Empty state
  emptyContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  suggestionsWrap: {
    gap: Spacing.sm,
    width: '100%',
  },
  suggestionChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  suggestionText: {
    fontFamily: FontFamily.condensedMedium,
    fontSize: FontSize.sm,
  },

  // Messages
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  bubbleKicker: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bubbleText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  typingText: {
    fontFamily: FontFamily.regular,
    fontStyle: 'italic',
    fontSize: FontSize.sm,
  },

  // Retry banner
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  retryText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },
  retryAction: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
  },
  retryDismiss: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});

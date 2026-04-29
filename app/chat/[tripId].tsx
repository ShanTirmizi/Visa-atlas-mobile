import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOffline } from '@/contexts/offline-context';
import { api } from '@/convex/_generated/api';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { Id } from '@/convex/_generated/dataModel';
import { Send, Bot, User } from 'lucide-react-native';
import BackButton from '@/components/ui/BackButton';
import { useTheme } from '@/contexts/theme-context';
import { endpoints } from '@/constants/api';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from '@/constants/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  userName?: string;
  userId?: string;
}

export default function ChatScreen() {
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  // When opened from a day-detail "Tweak this day" CTA, `day` is the 0-based
  // index of the day. Otherwise the chat is trip-scoped.
  const dayIndex = day !== undefined && day !== '' ? Number(day) : null;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const trip = useOfflineQuery(api.trips.getTrip, {
    id: tripId as Id<'trips'>,
  });
  const { isOffline } = useOffline();

  const { isAuthenticated } = useConvexAuth();
  const convexMessages = useQuery(
    api.trips.getMessages,
    isAuthenticated ? { tripId: tripId as Id<'trips'> } : 'skip',
  );
  const addMessage = useMutation(api.trips.addMessage);
  const currentUser = useQuery(api.trips.getCurrentUser, isAuthenticated ? {} : 'skip');

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  // When a send fails, surface a soft retry banner (not a permanent fake
  // assistant message). Holds the text the user tried to send.
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const updateTripField = useMutation(api.trips.updateTripField);

  const countryName = trip?.countryName ?? 'your trip';

  // Resolve the current day from the trip's itinerary if a dayIndex was
  // provided. Used to scope the chat header/suggestions/payload to a single
  // day rather than the whole trip.
  type ItineraryDay = { day: number; title: string; morning: string; afternoon: string; evening: string };
  const currentDay = useMemo<ItineraryDay | null>(() => {
    if (dayIndex === null || !trip?.itinerary) return null;
    try {
      const arr = JSON.parse(trip.itinerary) as ItineraryDay[];
      return arr[dayIndex] ?? null;
    } catch {
      return null;
    }
  }, [dayIndex, trip?.itinerary]);

  const displayMessages: ChatMessage[] = (convexMessages ?? []).map((m) => ({
    id: m._id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    userName: m.userName ?? undefined,
    userId: m.userId ?? undefined,
  }));

  const sendChat = useCallback(
    async (text: string) => {
      if (isOffline) return;
      if (!text || isSending) return;

      setIsSending(true);
      setFailedMessage(null);

      // Persist user message immediately so it shows up in the conversation.
      await addMessage({
        tripId: tripId as Id<'trips'>,
        role: 'user',
        content: text,
        userId: currentUser?._id,
        userName: currentUser?.name ?? 'You',
      });

      try {
        // Call AI endpoint with the body shape the server actually expects.
        const res = await fetch(endpoints.tripChat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            tripContext: {
              countryName: trip?.countryName ?? '',
              duration: trip?.duration ?? 0,
              region: trip?.region ?? '',
              capital: trip?.capital ?? '',
              currency: trip?.currency ?? '',
              dailyBudget: trip?.dailyBudget ?? '',
              visaCategory: trip?.visaCategory ?? '',
              companions: trip?.companions ?? undefined,
            },
            currentItinerary: trip?.itinerary ?? '[]',
            chatHistory: (convexMessages ?? []).slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          reply?: string;
          itineraryUpdate?: string | null;
        };

        if (!data.reply) {
          throw new Error('Empty reply');
        }

        // Persist the AI's chat reply.
        await addMessage({
          tripId: tripId as Id<'trips'>,
          role: 'assistant',
          content: data.reply,
        });

        // If the AI returned an itinerary update, patch the trip in place
        // so the user sees the new itinerary immediately.
        if (data.itineraryUpdate) {
          try {
            await updateTripField({
              id: tripId as Id<'trips'>,
              field: 'itinerary',
              value: data.itineraryUpdate,
            });
          } catch (err) {
            // Patch failed — leave the chat reply intact and let the user know
            // separately via the retry banner.
            console.warn('itinerary patch failed', err);
          }
        }
      } catch (err) {
        console.warn('trip-chat failed', err);
        // Don't pollute the conversation with a fake "Sorry…" assistant
        // message. Instead, surface a soft retry banner above the input.
        setFailedMessage(text);
      } finally {
        setIsSending(false);
      }
    },
    [
      isOffline,
      isSending,
      tripId,
      currentUser,
      convexMessages,
      trip,
      addMessage,
      updateTripField,
    ],
  );

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    await sendChat(text);
  }, [inputText, sendChat]);

  const retryFailed = useCallback(() => {
    if (failedMessage) {
      void sendChat(failedMessage);
    }
  }, [failedMessage, sendChat]);

  const dismissFailed = useCallback(() => setFailedMessage(null), []);

  // Day-scoped prompts when entering from a specific day; trip-scoped otherwise.
  const suggestions = currentDay
    ? [
        `Suggest a different morning activity for Day ${currentDay.day}`,
        `Add a hidden-gem stop to this day`,
        `Make this day more relaxed`,
        `What should I bring for Day ${currentDay.day}?`,
      ]
    : [
        `What's the best restaurant near Day 1?`,
        `How do I get around ${countryName}?`,
        `What should I pack for this trip?`,
        `Any hidden gems not in the itinerary?`,
      ];

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isAssistant = item.role === 'assistant';
      const isOwnMessage = item.userId === currentUser?._id;
      // A user message from another collaborator (not the current user)
      const isOtherUser = !isAssistant && !isOwnMessage;

      return (
        <View
          style={[
            styles.messageBubble,
            isAssistant
              ? [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }]
              : isOwnMessage
              ? [styles.ownBubble, { backgroundColor: colors.primary }]
              : [styles.otherBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
        >
          {/* Sender name — shown above other users' messages */}
          {isOtherUser && item.userName && (
            <Text
              style={[
                styles.senderName,
                { color: colors.textSecondary },
              ]}
            >
              {item.userName}
            </Text>
          )}

          <View style={styles.messageHeader}>
            {isAssistant ? (
              <Bot color={colors.primary} size={14} />
            ) : isOwnMessage ? (
              <User color={colors.primaryButtonText} size={14} />
            ) : (
              <User color={colors.textSecondary} size={14} />
            )}
            <Text
              style={[
                styles.messageRole,
                {
                  color: isAssistant
                    ? colors.textSecondary
                    : isOwnMessage
                    ? colors.primaryButtonText
                    : colors.textSecondary,
                },
              ]}
            >
              {isAssistant ? 'Visa Atlas AI' : isOwnMessage ? 'You' : (item.userName ?? 'Collaborator')}
            </Text>
          </View>

          <Text
            style={[
              styles.messageText,
              {
                color: isOwnMessage && !isAssistant
                  ? colors.primaryButtonText
                  : colors.foreground,
              },
            ]}
          >
            {item.content}
          </Text>
        </View>
      );
    },
    [colors, currentUser],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <BackButton />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {currentDay ? `Day ${currentDay.day}` : 'Trip Chat'}
          </Text>
          {trip && (
            <Text
              style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {currentDay
                ? `${currentDay.title} · ${trip.countryName}`
                : `${trip.countryName} · ${trip.duration} days`}
            </Text>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      {displayMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bot color={colors.textMuted} size={48} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Ask me anything
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            I know everything about your {countryName} trip
          </Text>

          <View style={styles.suggestions}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setInputText(s);
                  inputRef.current?.focus();
                }}
              >
                <Text style={[styles.suggestionText, { color: colors.primary }]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isSending ? (
              <View style={[styles.typingIndicator, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                  Thinking...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input bar */}
      {isOffline && (
        <View style={{ padding: 16, alignItems: 'center', backgroundColor: colors.card }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: FontFamily.serif }}>
            Chat is unavailable offline
          </Text>
        </View>
      )}
      {!isOffline && failedMessage ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: Spacing.lg,
            paddingVertical: 10,
            backgroundColor: colors.warningBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontFamily: FontFamily.medium,
              fontSize: 13,
              color: colors.ink,
            }}
            numberOfLines={2}
          >
            Couldn't reach Visa Atlas. Tap retry to send your message again.
          </Text>
          <TouchableOpacity onPress={retryFailed} hitSlop={8}>
            <Text
              style={{
                fontFamily: FontFamily.semibold,
                fontSize: 13,
                color: colors.coralDeep,
              }}
            >
              Retry
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismissFailed} hitSlop={8}>
            <Text
              style={{
                fontFamily: FontFamily.medium,
                fontSize: 13,
                color: colors.inkMute,
              }}
            >
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!isOffline && (
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
          <TextInput
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
            placeholder="Ask about your trip..."
            placeholderTextColor={colors.textMuted}
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
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryButtonText} />
            ) : (
              <Send
                color={inputText.trim() ? colors.primaryButtonText : colors.textMuted}
                size={18}
              />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  suggestions: {
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
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderName: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    marginBottom: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  messageRole: {
    fontFamily: FontFamily.condensedSemibold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  typingIndicator: {
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

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQuery } from '@/hooks/use-offline-query';
import { useOffline } from '@/contexts/offline-context';
import { api } from '@/convex/_generated/api';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { Id } from '@/convex/_generated/dataModel';
import {
  Send,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Wand2,
} from 'lucide-react-native';
import BackButton from '@/components/ui/BackButton';
import { ItineraryDiffCard, diffItineraries } from '@/components/chat/ItineraryDiffCard';
import { hapticSelect } from '@/utils/haptics';
import { useTheme } from '@/contexts/theme-context';
import { useVisa } from '@/contexts/visa-context';
import { Squiggle } from '@/components/ui/Squiggle';
import { Flag } from '@/components/ui/Flag';
import { toAlpha2 } from '@/utils/countryCode';
import { endpoints } from '@/constants/api';
import {
  mergeStopsIntoProposal,
  parseItineraryDays,
  type ItineraryDay,
} from '@/types/itinerary';
import {
  FontFamily,
  Spacing,
} from '@/constants/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  userName?: string;
  userId?: string;
}

// Local marker — we remember which assistant message IDs were the result
// of a successful itinerary update so we can decorate the bubble with an
// "Itinerary updated" stamp. Lives in component state (not Convex) so it's
// scoped to the current viewer's session.

// Travel-themed cycle that runs in place of a static "Thinking…". Cycles
// every ~2.2s while the AI is composing — matches the rhythm Claude Code
// and Linear use for streaming status copy.
const THINKING_PHRASES = [
  'Thinking',
  'Consulting the guidebook',
  'Plotting the route',
  'Browsing the maps',
  'Asking the locals',
  'Sketching your day',
  'Pulling threads together',
  'Drafting suggestions',
] as const;

// Starter prompts shown only while the conversation is empty — tapping one
// sends it immediately through the exact same path as typing + send
// (iMessage / ChatGPT starter-suggestion pattern). Copy is deliberately
// destination-agnostic so the same three work for any trip.
const STARTER_PROMPTS = [
  'Make one of the days more relaxed',
  'Add a rainy-day backup plan',
  'Suggest a great dinner spot for the last night',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// regenerateImagesForItinerary
//
// When the AI patches the itinerary, the per-day and per-activity photos that
// were generated at trip creation time go stale (they still depict the old
// activities). Without this the user sees fresh text but old photos and feels
// like nothing changed. This helper rebuilds the same payload the trip
// planner sends at creation time and patches dayImages + activityImages
// once the trip-images endpoint returns.
// ─────────────────────────────────────────────────────────────────────────────
async function regenerateImagesForItinerary(
  itineraryJson: string,
  ctx: { countryName?: string; capital?: string },
  tripId: Id<'trips'>,
  updateTripField: (args: {
    id: Id<'trips'>;
    field: string;
    value: string;
  }) => Promise<unknown>,
): Promise<void> {
  let itineraryDays: ItineraryDay[] = [];
  try {
    itineraryDays = JSON.parse(itineraryJson) as ItineraryDay[];
  } catch {
    return;
  }
  if (!Array.isArray(itineraryDays) || itineraryDays.length === 0) return;

  const activities = itineraryDays
    .flatMap((d) => [
      d.morningPlace ? { name: 'morning', place: d.morningPlace } : null,
      d.afternoonPlace ? { name: 'afternoon', place: d.afternoonPlace } : null,
      d.eveningPlace ? { name: 'evening', place: d.eveningPlace } : null,
    ])
    .filter((a): a is { name: string; place: string } => a !== null);

  const dayHeroSubjects = itineraryDays.map(
    (d) =>
      d.heroSubject ??
      d.morningPlace ??
      d.afternoonPlace ??
      d.eveningPlace ??
      d.title ??
      '',
  );

  try {
    const imgRes = await fetch(endpoints.tripImages, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryName: ctx.countryName ?? '',
        capital: ctx.capital ?? '',
        activities,
        dayHeroSubjects,
      }),
    });
    if (!imgRes.ok) return;
    const imgData = (await imgRes.json()) as {
      activities?: unknown[];
      dayImages?: unknown[];
    };

    // Each field update is wrapped independently so that a stale Convex
    // deploy missing one of the allow-listed fields (e.g. activityImages
    // was added later) doesn't take down the whole regen — dayImages can
    // still patch even if activityImages rejects.
    if (imgData.dayImages?.length) {
      try {
        await updateTripField({
          id: tripId,
          field: 'dayImages',
          value: JSON.stringify(imgData.dayImages),
        });
      } catch (err) {
        console.warn('dayImages patch failed', err);
      }
    }
    if (imgData.activities?.length) {
      try {
        await updateTripField({
          id: tripId,
          field: 'activityImages',
          value: JSON.stringify(imgData.activities),
        });
      } catch (err) {
        console.warn('activityImages patch failed', err);
      }
    }
  } catch (err) {
    console.warn('image regen failed', err);
  }
}

export default function ChatScreen() {
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const dayIndex = day !== undefined && day !== '' ? Number(day) : null;
  const { colors } = useTheme();
  // Passport + residence keep visa-adjacent answers nationality-correct.
  const { passports, residence } = useVisa();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const [isFocused, setIsFocused] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  // Index into THINKING_PHRASES for the cycling "Thinking…" status. Bumped
  // every ~2.2s while a message is in flight; resets to 0 on each send so
  // the user sees the simplest copy first ("Thinking") before the cycle
  // moves on to more flavour-text phrases.
  const [thinkTick, setThinkTick] = useState(0);
  // assistant message IDs that triggered a successful itinerary patch this session
  const [updatedMsgIds, setUpdatedMsgIds] = useState<Set<string>>(new Set());
  // assistant message IDs whose photo regeneration is still in flight — shown
  // as "Refreshing photos…" on the stamp until images come back from the
  // trip-images endpoint and we patch dayImages/activityImages on the trip.
  const [refreshingPhotosFor, setRefreshingPhotosFor] = useState<Set<string>>(new Set());
  // One un-applied AI itinerary proposal at a time, anchored to the assistant
  // message that produced it. Held here (never auto-applied) until the user
  // explicitly accepts or declines via the ItineraryDiffCard — a newer
  // proposal simply replaces this slot, dismissing the previous card.
  const [pendingUpdate, setPendingUpdate] = useState<{
    itinerary: string;
    forMessageId: string;
  } | null>(null);
  const updateTripField = useMutation(api.trips.updateTripField);

  // Cycle the thinking phrase while the AI is composing. Reset to 0 on each
  // new send so it always opens with the plain "Thinking" before drifting
  // into flavour text — keeps things grounded for fast responses.
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

  const countryName = trip?.countryName ?? 'your trip';
  const alpha2 = toAlpha2(trip?.countryCode ?? '');

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

  // The single write path for itinerary updates — used by the silent no-op
  // path in sendChat and by the diff card's "Apply changes". Patches the
  // trip, stamps the originating assistant bubble ("Itinerary updated"),
  // and fires the photo regeneration exactly like the legacy auto-apply flow.
  const applyItineraryUpdate = useCallback(
    async (itinerary: string, stampId: string | null) => {
      // The /api/trip-chat endpoint emits the LEGACY day shape (no `stops`)
      // — writing its proposal verbatim would wipe every day's structured
      // stops on ANY accepted edit, including the zero-diff silent-apply
      // path. Merge the live trip's stops into the proposal first; the
      // per-slot prose-staleness rule lives in mergeStopsIntoProposal.
      // Proposals that aren't a parseable day array keep the verbatim
      // write so the legacy path stays intact.
      let value = itinerary;
      try {
        const raw: unknown =
          typeof itinerary === 'string' ? JSON.parse(itinerary) : itinerary;
        if (Array.isArray(raw)) {
          const proposalDays = raw.filter(
            (d): d is ItineraryDay => !!d && typeof d === 'object',
          );
          const currentDays = parseItineraryDays(trip?.itinerary);
          value = JSON.stringify(mergeStopsIntoProposal(currentDays, proposalDays));
        }
      } catch {
        // Unparseable proposal — fall through to the verbatim write.
      }
      try {
        await updateTripField({
          id: tripId as Id<'trips'>,
          field: 'itinerary',
          value,
        });
        if (stampId) {
          setUpdatedMsgIds((prev) => {
            const next = new Set(prev);
            next.add(stampId);
            return next;
          });
          // Mark photos as refreshing so the stamp shows the loading copy
          // while the trip-images endpoint regenerates images for the new
          // activities.
          setRefreshingPhotosFor((prev) => {
            const next = new Set(prev);
            next.add(stampId);
            return next;
          });
        }

        // Fire-and-forget: regenerate per-day + per-activity images so the
        // user sees fresh photography for the new itinerary the next time
        // they open the trip detail. The text update is done; this just
        // catches the visuals up. Uses the merged value — same days/places,
        // and it's what actually got written.
        void regenerateImagesForItinerary(
          value,
          {
            countryName: trip?.countryName,
            capital: trip?.capital,
          },
          tripId as Id<'trips'>,
          updateTripField,
        ).finally(() => {
          if (stampId) {
            setRefreshingPhotosFor((prev) => {
              const next = new Set(prev);
              next.delete(stampId);
              return next;
            });
          }
        });
      } catch (err) {
        console.warn('itinerary patch failed', err);
      }
    },
    [tripId, trip?.itinerary, trip?.countryName, trip?.capital, updateTripField],
  );

  const sendChat = useCallback(
    async (text: string) => {
      if (isOffline) return;
      if (!text || isSending) return;

      setIsSending(true);
      setFailedMessage(null);

      // Attribution (userId/userName) is derived server-side in addMessage.
      await addMessage({
        tripId: tripId as Id<'trips'>,
        role: 'user',
        content: text,
      });

      try {
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
            passports,
            residence,
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

        const newMessageId = await addMessage({
          tripId: tripId as Id<'trips'>,
          role: 'assistant',
          content: data.reply,
        });

        if (data.itineraryUpdate) {
          const stampId = newMessageId ? String(newMessageId) : null;
          // Never auto-apply a real edit. Diff the proposal against what the
          // user has now: a no-op (or an unparseable payload we can't render
          // a diff for) goes through the legacy silent-apply path, anything
          // else is held in pendingUpdate for an explicit accept/decline via
          // the ItineraryDiffCard under the assistant's reply.
          const diffs = diffItineraries(
            trip?.itinerary ?? '[]',
            data.itineraryUpdate,
          );
          if (diffs === null || diffs.length === 0 || !stampId) {
            await applyItineraryUpdate(data.itineraryUpdate, stampId);
          } else {
            // A newer proposal replaces any previous pending one.
            setPendingUpdate({
              itinerary: data.itineraryUpdate,
              forMessageId: stampId,
            });
          }
        }
      } catch (err) {
        console.warn('trip-chat failed', err);
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
      passports,
      residence,
      addMessage,
      applyItineraryUpdate,
    ],
  );

  // Diff-card actions. Accept clears the card immediately (the "Itinerary
  // updated" stamp takes over once the patch lands); decline just discards
  // the proposal and keeps the user's current itinerary.
  const acceptPendingUpdate = useCallback(() => {
    if (!pendingUpdate) return;
    const { itinerary, forMessageId } = pendingUpdate;
    setPendingUpdate(null);
    void applyItineraryUpdate(itinerary, forMessageId);
  }, [pendingUpdate, applyItineraryUpdate]);

  const declinePendingUpdate = useCallback(() => {
    setPendingUpdate(null);
  }, []);

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

  // Starter chips send straight through sendChat (same guards as the input
  // bar) — never just prefill the input. Dimmed + disabled while offline or
  // while a send is already in flight.
  const startersDisabled = isOffline || isSending;
  const onStarterPress = useCallback(
    (prompt: string) => {
      hapticSelect();
      void sendChat(prompt);
    },
    [sendChat],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isAssistant = item.role === 'assistant';
      const isOwnMessage = item.userId === currentUser?._id;
      const isOtherUser = !isAssistant && !isOwnMessage;
      const wasUpdate = isAssistant && updatedMsgIds.has(item.id);
      const photosRefreshing = isAssistant && refreshingPhotosFor.has(item.id);

      if (isAssistant) {
        return (
          <View style={[styles.aiBubbleWrap]}>
            <View
              style={[
                styles.aiBubble,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ]}
            >
              <View style={styles.aiHeader}>
                <View
                  style={[
                    styles.aiOrb,
                    { backgroundColor: colors.coralBg },
                  ]}
                >
                  <Sparkles size={11} color={colors.coralDeep} strokeWidth={2.2} fill={colors.coralDeep} />
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

              {wasUpdate ? (
                <Pressable
                  onPress={() => router.push(`/trip/${tripId}` as any)}
                  style={({ pressed }) => [
                    styles.updateStamp,
                    {
                      borderColor: colors.coralDeep,
                      backgroundColor: colors.coralBg,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      borderWidth: 1.25,
                      borderColor: colors.coralDeep,
                      backgroundColor: 'rgba(255,255,255,0.65)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [{ rotate: '-4deg' }],
                    }}
                  >
                    <Wand2 size={12} color={colors.coralDeep} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
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
                      {photosRefreshing ? 'REFRESHING PHOTOS' : 'ITINERARY UPDATED'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: FontFamily.displayItalic,
                        fontStyle: 'italic',
                        fontSize: 15,
                        letterSpacing: -15 * 0.014,
                        fontWeight: '500',
                        color: colors.ink,
                        marginTop: 2,
                      }}
                    >
                      {photosRefreshing ? 'Catching the visuals up…' : 'Trip refreshed.'}
                    </Text>
                  </View>
                  {photosRefreshing ? (
                    <ActivityIndicator size="small" color={colors.coralDeep} />
                  ) : (
                    <ArrowRight size={14} color={colors.coralDeep} strokeWidth={2.2} />
                  )}
                </Pressable>
              ) : null}
            </View>

            {/* Pending itinerary proposal — review card anchored under the
                assistant reply that produced it. Only the changed days are
                shown; the trip is untouched until "Apply changes". */}
            {pendingUpdate?.forMessageId === item.id ? (
              <Animated.View
                entering={FadeIn.duration(280)}
                style={{ alignSelf: 'stretch', marginTop: 8 }}
              >
                <ItineraryDiffCard
                  currentItinerary={trip?.itinerary ?? '[]'}
                  proposedItinerary={pendingUpdate.itinerary}
                  onApply={acceptPendingUpdate}
                  onKeep={declinePendingUpdate}
                />
              </Animated.View>
            ) : null}
          </View>
        );
      }

      return (
        <View style={styles.userBubbleWrap}>
          <View
            style={[
              styles.userBubble,
              { backgroundColor: isOwnMessage ? colors.ink : colors.coral },
            ]}
          >
            {isOtherUser && item.userName ? (
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
                {item.userName.toUpperCase()}
              </Text>
            ) : (
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
            )}
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
    [
      colors,
      currentUser,
      updatedMsgIds,
      refreshingPhotosFor,
      router,
      tripId,
      pendingUpdate,
      trip?.itinerary,
      acceptPendingUpdate,
      declinePendingUpdate,
    ],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      // "padding" resizes the container from the bottom and keeps the
      // header pinned. "translate-with-padding" (tried first) translated
      // the WHOLE screen — header included — above the Dynamic Island on
      // device: a harsh jump with the header gone. RNKC's translate
      // pattern fits headerless inverted lists, not this screen. Passed
      // unconditionally: RNKC KAV is a no-op when behavior is undefined.
      behavior="padding"
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
              TRIP COPILOT
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
            {currentDay ? `Day ${currentDay.day}` : trip?.countryName ?? 'Trip Chat'}
            <Text style={{ color: colors.coral }}>.</Text>
          </Text>
          {trip ? (
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
              {currentDay
                ? `${trip.countryName} · DAY ${currentDay.day}`
                : `${trip.duration} DAYS · EDITING`}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Hairline divider */}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />

      {/* ── Messages ───────────────────────────────── */}
      {displayMessages.length === 0 ? (
        // ScrollView (not View) so drag-down dismisses the keyboard
        // interactively, matching the populated FlatList below — iMessage
        // behaves the same on an empty conversation.
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Big AI orb with flag mini-tile */}
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
                READY TO HELP
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
              Ask me anything
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
              I know everything about your {countryName} trip — and I can edit the itinerary live as we go.
            </Text>
          </View>

          {/* Starter prompts — soft pills that send on tap. Soft pill =
              bg-tint + coloured text, no leading dot (house rule). */}
          <View style={styles.suggestions}>
            <Text
              style={{
                fontFamily: FontFamily.displayItalic,
                fontStyle: 'italic',
                fontSize: 17,
                lineHeight: 22,
                letterSpacing: -17 * 0.014,
                fontWeight: '500',
                color: colors.inkSoft,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              Try asking
              <Text style={{ color: colors.coral }}>.</Text>
            </Text>
            {STARTER_PROMPTS.map((s) => (
              <Pressable
                key={s}
                disabled={startersDisabled}
                accessibilityRole="button"
                accessibilityLabel={s}
                onPress={() => onStarterPress(s)}
                style={({ pressed }) => [
                  styles.starterChip,
                  {
                    backgroundColor: colors.coralBg,
                    opacity: startersDisabled ? 0.4 : pressed ? 0.7 : 1,
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
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          ListFooterComponent={isSending ? <ThinkingRow tick={thinkTick} /> : null}
        />
      )}

      {/* Offline / retry banners */}
      {isOffline && (
        <View style={{ padding: 16, alignItems: 'center', backgroundColor: colors.surfaceMuted }}>
          <Text style={{ color: colors.inkMute, fontSize: 13, fontFamily: FontFamily.regular }}>
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

      {/* ── Input bar — paper input + persistent coral send button ── */}
      {!isOffline && (
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
              placeholder="Ask about your trip…"
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
      )}
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated thinking row — three coral dots that pulse in sequence
// ─────────────────────────────────────────────────────────────────────────────

function ThinkingRow({ tick }: { tick: number }) {
  const { colors } = useTheme();
  const phrase = THINKING_PHRASES[tick % THINKING_PHRASES.length];
  return (
    <View style={[styles.thinkingRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View
        style={[
          styles.aiOrb,
          { backgroundColor: colors.coralBg },
        ]}
      >
        <Sparkles size={11} color={colors.coralDeep} strokeWidth={2.2} fill={colors.coralDeep} />
      </View>
      {/* Animate.Text keyed on tick so each new phrase fades in/out — same
          rhythm Claude Code / Linear use for streaming status copy. */}
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
      style={[
        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: color },
        animStyle,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Send button — always visible. Three states: idle (grey on paper),
// active (coral with white arrow), sending (coral with spinner).
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
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state — flexGrow (not flex): it's a ScrollView contentContainerStyle
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 40,
  },
  suggestions: {
    gap: 10,
    alignItems: 'center', // pills hug their text and sit centered, iMessage-style
  },
  starterChip: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22, // full pill
  },

  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
  },

  // User bubbles (right-aligned solid)
  userBubbleWrap: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomRightRadius: 6,
  },

  // AI bubbles (left-aligned paper card)
  aiBubbleWrap: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  aiBubble: {
    maxWidth: '92%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiOrb: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // "Itinerary updated" stamp inside AI bubble
  updateStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },

  // Thinking row (placed in FlatList footer)
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

  // Input bar
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
  input: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 24,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
